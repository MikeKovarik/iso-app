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
			this.openCache()
			this.precache()
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

	cacheRefresh(force) {
		// TODO: clears cache and refethes all their contents again
		// if force, adds headers with max-age=0, removes etag or something that forces it.
	}

	get cacheName() {
		if (this.swr)
			return this.swr.scope.slice(location.origin.length + 1).replace(/\/$/, '')
	}

	async openCache() {
		return this.cache = await caches.open(this.cacheName)
	}

	async precache(urls) {
		if (!this.cache) await this.openCache()
		if (!urls) {
			var css = Array.from(document.styleSheets).map(s => s.href)
			var scripts = Array.from(document.scripts).map(s => s.src)
			urls = []
				.concat(css, scripts)
				.filter(url => url && url.startsWith(location.origin))
		}
		console.log('precache', urls)
		await this.cache.addAll(urls)
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
		//var urlWithOptions = `${url}?options=${encodeURIComponent(this)}`
		var urlWithOptions = `${url}?${this.getSwOptionsParams()}`
		// NOTE: we have to install SW every time the app loads in order to know if the file changed since
		// the last time we installed it.
		this.emitLocal('sw-register', url)
		//console.log('register', url)
		try {
			var oldSw = this.swr && extractSwFromSwr(this.swr)
			this.swr = await navigator.serviceWorker.register(urlWithOptions)
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

	getSwOptions(keys) {
		if (!keys)
			keys = ['cacheStrategy', 'cacheLocal', 'cacheRemote']
		return pick(this, keys)
	}

	getSwOptionsParams(keys) {
		var params = new URLSearchParams
		for (var [key, val] of Object.entries(this.getSwOptions(keys)))
			params.set(key, val)
		return params.toString()
	}

	updateServiceWorkerSettings(key) {
		var options = key ? this[key] : this.getSwOptions()
		var message = {
			type: 'options',
			options
		}
		this._swSend(message)
	}


	get cacheLocal() {return this._cacheLocal}
	get cacheRemote() {return this._cacheRemote}
	get cacheMimes() {return this._cacheMimes}
	get cacheStrategy() {return this._cacheStrategy}
	set cacheLocal(newVal) {
		this._cacheLocal = newVal
		this.updateServiceWorkerSettings('cacheLocal') 
	}
	set cacheRemote(newVal) {
		this._cacheRemote = newVal
		this.updateServiceWorkerSettings('cacheRemote') 
	}
	set cacheMimes(newVal) {
		this._cacheMimes = newVal
		this.updateServiceWorkerSettings('cacheMimes') 
	}
	set cacheStrategy(newVal) {
		this._cacheStrategy = newVal
		this.updateServiceWorkerSettings('cacheStrategy') 
		if (newVal === false) this.clearCache()
	}


}

function extractSwFromSwr(swr) {
	return swr.installing || swr.waiting || swr.active
}