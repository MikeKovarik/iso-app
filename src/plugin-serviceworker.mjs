import platform from 'platform-detect'
import {plugin} from './plugin-core.mjs'
import {getAbsolutePath} from './util.mjs'


function pick(input, keys) {
	var output = {}
	for (var key of keys)
		output[key] = input[key]
	return output
}

@plugin
export class ServiceWorkerPlugin {

	// NOTE: there can only be one service worker per scope (folder, e.g. per app or project)
	// but there can be multiple workers on the same domain/origin (e.g. localhost/app1, localhost/app2)
	// and they all share the same caches list. So we need to use SW scope to separate them.
	async pluginConstructor() {
		if (!('serviceWorker' in navigator))
			return console.warn('serviceWorker API unavailable')

		this.cacheFirst = true
		this.autoRegister = true

		// Some web apps cache all their files up front and serve them from cache but also silently make fresh fetch
		// requests in the background while doing so. In case some html or css files changed and the app better be reloaded
		// if was served with obsolete cached resources.
		// We can reload the app automatically but it's disabled by default and app dev would want to show some toast message.
		// NOTE: we can only detect change of the serviceworker file, not any of app's html/css/js files unless our own
		//       builtin default (and somewhat configurable) serviceworker is used to handle caching.
		if (this.autoReloadOnUpdate)
			this.on('sw-updated', () => location.reload())

		this.on('sw-registered', () => {
			this.updateServiceWorkerSettings()
			this.cacheAppFiles()
		})


		console.log('this.autoRegister', this.autoRegister)
		if (this.autoRegister) {
			//this._defaultWorkerPath = './serviceworker.js'
			this._defaultWorkerPath = getAbsolutePath('./serviceworker.js')
			this._swRegister(this._defaultWorkerPath)
		}


		var isServiceWorkerActive = navigator.serviceWorker.controller !== null
		console.log('isServiceWorkerActive', isServiceWorkerActive)
		var oldSw = navigator.serviceWorker.controller
		var oldSwr = await navigator.serviceWorker.getRegistration()
		console.log('oldSw', oldSw)
		console.log('oldSwr', oldSwr)


	}

	async uninstallServiceWorker() {
		//TODO
		//swr.unregister()
	}

	async clearCache(version) {
		var names = await caches.keys()
		names = names.filter(name => name.startsWith(this.cacheName))
		if (version !== undefined)
			names = names.filter(name => name.endsWith(version))
		var promises = names.map(name => caches.delete(name))
		await Promise.all(promises)
	}

	get cacheName() {
		if (this.swr)
			return this.swr.scope.slice(location.origin.length + 1).replace(/\/$/, '')
	}

	async cacheAppFiles() {
		if (!this.cache) return
		console.log('cacheAppFiles()')
		var css = Array.from(document.styleSheets).map(s => s.href)
		var scripts = Array.from(document.scripts).map(s => s.src)
		var deps = []
			.concat(css, scripts)
			.filter(url => url)
			.filter(url => url.startsWith(location.origin))
		this.swCache = await caches.open(this.cacheName)
		this.swCache.addAll(deps)
	}

	_swSend(object) {
		if (this.sw)
			this.sw.postMessage(object)
	}

	// Path to serviceworker file. Default builtin is used unless user requests his own.
	// Setting new service worker through this getter/setter installs it automatically.
	get serviceWorker() {
		if (this.sw)
			return this.sw.scriptURL
	}
	set serviceWorker(url) {
		this._swRegister(url)
	}

	get sw() {
		if (this.swr) {
			// Various states of undergoing registration
			return this.swr.installing
				|| this.swr.waiting
				|| this.swr.active
		} else {
			// Fallback to preexisting service worker running from before this app started.
			return navigator.serviceWorker.controller
		}
	}

/*
	get sw() {
		return navigator.serviceWorker.controller
	}

	get swr() {
		var swrs = await navigator.serviceWorker.getRegistrations()
		for (let swr of swrs) {
			var sw = swr.installing || swr.waiting || swr.active
			if (sw === navigator.serviceWorker.controller)
				return swr
		}
	}
*/
	async _swRegister(url) {
		url = getAbsolutePath(url)
		console.log('register', url)
		// NOTE: we have to install SW every time the app loads in order to know if the file changed since
		// the last time we installed it.
		this.emitLocal('sw-register', url)
		//console.log('register', url)
		try {
			var registration = await navigator.serviceWorker.register(url)
			this._swCheckRegistration(registration)
			this.emitLocal('sw-registered', url)
		} catch(err) {
			console.warn('registering service worker failed', url, err)
			this.emitLocal('sw-register-failed', err)
		}
	}

	_swCheckRegistration(registration) {
		this.swr = registration
		var url = this.sw.scriptURL
		this.sw.addEventListener('statechange', e => {
			var sw = this.sw
			if (sw) {
				this.emitLocal(`sw-${sw.state}`, sw.scriptURL)
			} else {
				this.emitLocal(`sw-stopped`)
				this.emitLocal(`sw-unregistered`)
			}
		})
		//if (navigator.serviceWorker.controller)
		//	return resolve(false)
		this.swr.onupdatefound = () => {
			this.emitLocal('sw-update', url)
			// Need to cache the object. It will be null on state change.
			var sw = this.swr.installing
			sw.onstatechange = () => {
				console.log('ONSTATE CHANGE', sw.state)
				if (sw.state === 'installed') {
					console.log('ONSTATE INSTALLED')
					var oldsw = navigator.serviceWorker.controller
					console.log('oldsw', oldsw)
					console.log('newsw', sw)
					console.log('oldsw === newsw', oldsw === sw)
					if (navigator.serviceWorker.controller !== null) {
						console.log('EMITTING sw-updated', url)
						this.emitLocal('sw-updated', url)
					}
					sw.onstatechange = null
				}
			}
		}
	}



	get cache() {
		return this._cache === undefined ? true : this._cache 
	}
	set cache(newVal) {
		this._cache = newVal
		this.updateServiceWorkerSettings('cache') 
		if (newVal === false)
			this.clearCache()
	}

	updateServiceWorkerSettings(key) {
		if (key)
			var keys = [key]
		else
			var keys = ['cache', 'cacheFirst', 'cacheLocalFiles', 'cacheRemoteFiles', 'cacheContinuousUpdate']
		var options = pick(this, keys)
		this._swSend(options)
	}


}