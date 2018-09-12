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

		this.monitoredServiceWorkers = []

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

		//var isServiceWorkerActive = navigator.serviceWorker.controller !== null
		//console.log('isServiceWorkerActive', isServiceWorkerActive)
		//var oldSw = navigator.serviceWorker.controller
		this.swr = await navigator.serviceWorker.getRegistration()
		if (this.swr)
			this._handleServiceWorkerReg(this.swr)

		console.log('this.autoRegister', this.autoRegister)
		if (this.autoRegister) {
			//this._defaultWorkerPath = './serviceworker.js'
			this._defaultWorkerPath = getAbsolutePath('./serviceworker.js')
			this.registerServiceWorker(this._defaultWorkerPath)
		}
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
		if (this.serviceWorker)
			this.serviceWorker.postMessage(object)
	}

	// Path to serviceworker file. Default builtin is used unless user requests his own.
	// Setting new service worker through this getter/setter installs it automatically.
	get serviceWorkerUrl() {
		var sw = this.serviceWorker
		return sw && sw.scriptURL
	}
	set serviceWorkerUrl(url) {
		this.registerServiceWorker(url)
	}

	get serviceWorker() {
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

	async registerServiceWorker(url) {
		url = getAbsolutePath(url)
		// NOTE: we have to install SW every time the app loads in order to know if the file changed since
		// the last time we installed it.
		this.emitLocal('sw-register', url)
		//console.log('register', url)
		try {
			var oldSw = this.swr && extractSwFromSwr(this.swr)
			this.swr = await navigator.serviceWorker.register(url)
			var newSw = extractSwFromSwr(this.swr)
			if (oldSw && newSw && oldSw !== newSw) {
				// Detected change of URL of the worker. Completely different service worker is being installed.
				// NOTE: This condition is true only is URL changes. It is false if the same worker
				//       is just updated - new version of existing worker is loaded.
				this.emit('sw-change', newSw.scriptURL, oldSw.scriptURL)
			}
			this._handleServiceWorkerReg(this.swr, true)
			this.emitLocal('sw-registered', url)
		} catch(err) {
			this.emitLocal('sw-not-registered', err)
		}
	}

	_handleServiceWorkerReg(swr, isNewReg = false) {
		this._handleServiceWorker(extractSwFromSwr(swr))
		swr.onupdatefound = () => {
			if (swr.installing && swr.active) {
				// New versions of currently running service worker is being installed.
				// Added custom 'sw-updating' event to signify that.
				this.emit('sw-update', swr.installing.scriptURL)
				this._handleServiceWorker(swr.installing)
			}
		}
	}

	_handleServiceWorker(sw) {
		if (sw === undefined || sw === null) return
		if (this.monitoredServiceWorkers.includes(sw)) return
		this.monitoredServiceWorkers.push(sw)
		sw.onstatechange = e => this.emitLocal(`sw-${sw.state}`, sw.scriptURL)
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

function extractSwFromSwr(swr) {
	return swr.installing || swr.waiting || swr.active
}