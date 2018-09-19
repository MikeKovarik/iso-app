import defaultOptions from './sw-options.mjs'
import {cacheFirst, networkFirst, dynamic, fastest, hybrid} from './sw-strategies.mjs'


var global = self

global.skipWaiting()

function noop() {}

// We don't have access to manifest.json and fetching it would take some time.
// Plus we cannot know for sure it even exists.

class App {

	constructor() {
		this.cacheName = global.registration.scope
			.slice(location.origin.length + 1)
			.replace(/\/$/, '')
		this.cache = undefined
		this.middleware = []

		Object.assign(this, defaultOptions)

		// Install the service worker.
		global.addEventListener('install',  e => e.waitUntil(this.onInstall(e)))
		global.addEventListener('activate', () => global.clients.claim())
		global.addEventListener('fetch',    e => e.respondWith(this.onFetch(e)))

		global.addEventListener('message', ({data}) => {
			switch (data.type) {
				case 'options': this.applyOptions(data.options)
			}
		})
	}

	use(handler) {
		this.middleware.push(handler)
	}

	async onInstall(e) {
		// Force current version of service worker to activate.
		console.log('### INSTALL ###', location.href)
		this.applyOptions(new URL(location).searchParams)
		//console.log('### INSTALL ###', location)
		this.cache = await caches.open(this.cacheName)
		// Path is relative to the origin, not the app directory.
		await this.cache.addAll(['./', './index.html'])
		// Fail silently. manifest.json is just a guess, not a must for app to have.
		await this.cache.add('manifest.json').catch(noop)
		////console.log('cached', this.cache)
		await global.skipWaiting()
	}

	async onFetch(e) {
		if (e.defaultPrevented) return
		if (this.cacheStrategy === false) return
		var req = e.request
		var res = await this.cacheStrategyHandler(req, undefined, e)
		for (var handler of app.middleware)
			res = await handler.call(this, req, res, e) || res
		return res
	}

	applyOptions(newOptions) {
		for (var [key, val] of Object.entries(newOptions))
			if (val === undefined)
				this[key] = defaultOptions[key]
			else
				this[key] = val
		this.cacheStrategyHandler = this.getStrategy()
	}

	getStrategy() {
		switch (this.cacheStrategy) {
			case 'cache-first':   return cacheFirst
			case 'network-first': return networkFirst
			case 'dynamic':       return dynamic
			case 'fastest':       return fastest
			case 'hybrid':        return hybrid
			default:              return hybrid
		}
	}

	async fetchAndCache(req, cachedRes) {
		// We call .clone() on the request since we might use it in a call to cache.put() later on.
		// Both fetch() and cache.put() "consume" the request, so we need to make a copy.
		// (see https://fetch.spec.whatwg.org/#dom-request-clone)
		var res = await fetch(req.clone())

		if (this.isCacheable(req, res)) {
			if (!isCachedResUpToDate(res, cachedRes)) {
				this.cache.put(req, res.clone())
				if (cachedRes) {
					// Resource was previously cached but is obsolete now.
					this.notifyCacheUpdate(res)
				}
			}
		}

		return res
	}

	async notifyCacheUpdate(res) {
		var clients = await global.clients.matchAll()
		var json = JSON.stringify(getUpdateMessage(res))
		clients.forEach(client => client.postMessage(json))
	}

	isCacheable(req, res) {
		var isLocalResource = req.url.startsWith(location.origin)
		return res.ok
			&& res.status < 400
			&& ((this.cacheLocal && isLocalResource) || (!isLocalResource && this.cacheRemote))
			&& this.isCacheableMime(res)
			//&& !res.redirected
	}

	isCacheableMime(res) {
		if (this.cacheMimes === '*') return true
		var mime = res.headers.get('content-type')
		return mime
			&& this.cacheMimes.some(allowed => mime.startsWith(allowed))
	}

}

var app = global.app = new App




// Checks if the freshly fetched data is any newer than cached and notifies app if so.
function isCachedResUpToDate(freshRes, cachedRes) {
	if (!cachedRes) return false
	var cachedHeaders = cachedRes.headers
	var freshHeaders = freshRes.headers
	return cachedHeaders.get('content-length') === freshHeaders.get('content-length')
		&& cachedHeaders.get('last-modified') === freshHeaders.get('last-modified')
		&& cachedHeaders.get('etag') === freshHeaders.get('etag')
}

async function getUpdateMessage(res) {
	var {headers, url} = res
	return {
		type: 'refresh',
		url,
		etag:             headers.get('etag'),
		'content-type':   headers.get('content-type'),
		'content-length': headers.get('content-length'),
		'last-modified':  headers.get('last-modified'),
	}
}