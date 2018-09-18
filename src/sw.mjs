import {isOffline, prefferCache} from './sw-connection.mjs'
import options, {setOptions} from './sw-options.mjs'


self.skipWaiting()

function noop() {}

// We don't have access to manifest.json and fetching it would take some time.
// Plus we cannot know for sure it even exists.
var cacheName = self.registration.scope.slice(location.origin.length + 1).replace(/\/$/, '')

var cache

// Install the service worker.
self.addEventListener('install',  e => e.waitUntil(onInstall(e)))
self.addEventListener('activate', () => self.clients.claim())
self.addEventListener('fetch',    onFetch)

self.addEventListener('message', ({data}) => {
	switch (data.type) {
		case 'options': setOptions(data.options)
	}
})

async function notify(res) {
	var clients = await self.clients.matchAll()
	var json = JSON.stringify(getUpdateMessage(res))
	clients.forEach(client => client.postMessage(json))
}


// 'install' event fires when this file changes.
async function onInstall(e) {
	console.log('### INSTALL ###', location.href)
	setOptions(new URL(location).searchParams)
	// Force current version of service worker to activate.
	self.skipWaiting()
	//console.log('### INSTALL ###', location)
	cache = await caches.open(cacheName)
	// Path is relative to the origin, not the app directory.
	await cache.addAll(['./', './index.html'])
	// Fail silently. manifest.json is just a guess, not a must for app to have.
	await cache.add('manifest.json').catch(noop)
	////console.log('cached', cache)
}

async function onFetch(e) {
	if (e.defaultPrevented) return
	if (options.cacheStrategy === false) return
	switch (options.cacheStrategy) {
		case 'cache-first':   return e.respondWith(cacheFirst(e.request))
		case 'network-first': return e.respondWith(networkFirst(e.request))
		case 'dynamic':       return e.respondWith(dynamic(e.request))
		case 'fastest':       return fastest(e)
		case 'hybrid':        return hybrid(e)
		default:              return hybrid(e)
	}
}

async function cacheFirst(req) {
	//console.log('cacheFirst', req.url)
	try {
		return await caches.match(req)
	} catch(err) {
		return fetchAndCache(req)
	}
}

async function networkFirst(req) {
	//console.log('networkFirst', req.url)
	try {
		return await fetchAndCache(req)
	} catch(err) {
		return caches.match(req)
	}
}

async function dynamic(req) {
	//console.log('dynamic', req.url)
	if (isOffline || prefferCache)
		return cacheFirst(req)
	else
		return networkFirst(req)
}

// Does both cache lookup and fetch at the same time, returns the fastest response.
// The fastest is usually cache (if previously cached). The fetche response will
// be cached to ensure this strategy is at most one refresh behind latest version.
async function fastest(e) {
	//console.log('fastest', req.url)
	// Always look in the cache. Prevent unnecessary fetch when we're offline.
	if (isOffline)
		var promises = [caches.match(e.request)]
	else
		var promises = [caches.match(e.request), fetchAndCache(e.request)]
	// The fastest of the (up to) two methods serves the data.
	e.respondWith(Promise.race(promises))
	// waitUntil() prevents worker from getting killed until the cache is updated.
	if (promises.length > 1)
		e.waitUntil(Promise.all(promises))
}

// Similar to fastest() but only makes the network fetch() on fast connections.
async function hybrid(e) {
	var req = e.request
	console.log('get ', req.url)
	// Always look in the cache. Prevent unnecessary fetch when we're on cellular or weak connection.
	if (isOffline || prefferCache)
		var promises = [caches.match(req)]
	else
		var promises = [caches.match(req), fetchAndCache(req)]
	// The fastest of the (up to) two methods serves the data.
	Promise.race(promises).then(res => console.log('race', req.url, res))
	e.respondWith(Promise.race(promises))
	// waitUntil() prevents worker from getting killed until the cache is updated.
	if (promises.length > 1)
		e.waitUntil(Promise.all(promises))
}


async function fetchAndCache(req, cachedRes) {
	// We call .clone() on the request since we might use it in a call to cache.put() later on.
	// Both fetch() and cache.put() "consume" the request, so we need to make a copy.
	// (see https://fetch.spec.whatwg.org/#dom-request-clone)
	var res = await fetch(req.clone())

	if (isCacheable(req, res)) {
		if (!cachedRes) {
			// Resource was previously cached but is obsolete now.
			cache.put(req, res.clone())
			notify(res)
		} else if (!isCacheUpToDate(res, cachedRes)) {
			// Not cached before. No need to notify because the request is still waiting.
			cache.put(req, res.clone())
		}
	}

	return res
}

function isCacheable(req, res) {
	var isLocalResource = req.url.startsWith(location.origin)
	return res.ok
		&& res.status < 400
		&& ((options.cacheLocal && isLocalResource) || (!isLocalResource && options.cacheRemote))
		&& isCacheableMime(res)
		//&& !res.redirected
}

function isCacheableMime(res) {
	if (options.cacheMimes === '*') return true
	var mime = res.headers.get('content-type')
	return mime
		&& options.cacheMimes.some(allowed => mime.startsWith(allowed))
}

// Checks if the freshly fetched data is any newer than cached and notifies app if so.
function isCacheUpToDate(freshRes, cachedRes) {
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