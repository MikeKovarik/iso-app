self.skipWaiting()
	.then(() => console.log('service worker restarted'))
	.catch(err => console.log('service worker restart failed', err))


var options = {
	cacheLocal: true,
	cacheRemote: true,

	// Retrieve the resource from cache first and then fallback to network if needed.
	// 'cache-only'    - First looks in the cache, if it fails, fetches from network.
	//                 - Once the file is cached, it is never fetched or updated from network ever again.
	// 'cache-first'   - First looks in the cache, if it fails, fetches from network.
	//                 - Faster when offline because we're not waiting for fetch to fail.
	//                 - Causes the app to lag one refresh behind latest version because 
	// 'network-first' - First tries to fetch from network, if it fails, try retrieving from cache.
	//                 - Faster and reliable when online because we're always getting fresh version of the app)
	//                 - Slower when offline because we need to wait for fetch request to fail first.
	// 'fastest'       - Simultaneously makes both fetch request and cache retrieval
	//                 - and serves the fastest one.
	cacheStrategy: 'offline-first',

	// Mimes of files to cache
	cacheMimes: [
		'application/javascript',
		'application/json',
		'text/', //'text/html', 'text/css', 'text/plain',
		'image/', //'image/png',
		'font/',
	],
}

function noop() {}


var prefferCache
var isOffline
var allowCacheRefresh
if (navigator.connection) {
	// NetworkInformation API available
	var conn = navigator.connection
	conn.addEventListener('change', updateNetInfo)
} else {
	// Not available here. Shim it at least.
	var isMobile
	var conn = {
		saveData: isMobile,
		type: isMobile ? 'cellular' : 'wifi',
		downlink: isMobile ? 2 : 10,
	}
}
updateNetInfo()

function updateNetInfo() {
	isOffline = conn.type === 'none'
			|| conn.downlink === 0
			|| conn.downlinkMax === 0
	prefferCache = isOffline
			|| conn.saveData
			|| conn.type === 'cellular'
			|| conn.type === 'none'
			|| conn.effectiveType === 'slow-2g'
			|| conn.effectiveType === '2g'
			|| conn.downlink < 1
			|| conn.downlinkMax < 1
	allowCacheRefresh = conn.type !== 'cellular'
}


// We don't have access to manifest.json and fetching it would take some time.
// Plus we cannot know for sure it even exists.
var cacheName = self.registration.scope.slice(location.origin.length + 1).replace(/\/$/, '')

var cache


// Install the service worker.
self.addEventListener('install',  e => e.waitUntil(onInstall(e)))
self.addEventListener('activate', onActivate)
self.addEventListener('fetch',    onFetch)

self.addEventListener('message', ({data}) => {
	switch (data.type) {
		case 'options':  return Object.assign(options, data.options)
		//case 'prefetch': return cache.addAll(data.urls).catch(noop)
	}
})

async function notify(res) {
	var clients = await self.clients.matchAll()
	var json = JSON.stringify(getUpdateMessage(res))
	clients.forEach(client => client.postMessage(json))
}


// 'install' event fires when this file changes.
async function onInstall(e) {
	// Force current version of service worker to activate.
	self.skipWaiting()
	console.log('### INSTALL ###', location)
	/*try {
		for (var [key, val] of new URL(location).searchParams)
			options[key] = val
	} catch(err) {
		console.warn('couldnt load url options')
	}*/
	cache = await caches.open(cacheName)
	// Path is relative to the origin, not the app directory.
	await cache.addAll(['./', './index.html'])
	// Fail silently. manifest.json is just a guess, not a must for app to have.
	await cache.add('manifest.json').catch(noop)
	//console.log('cached', cache)
}

async function onActivate() {
	self.clients.claim()
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
	console.log('cacheFirst', req.url)
	try {
		return await caches.match(req)
	} catch(err) {
		return fetchAndCache(req)
	}
}

async function networkFirst(req) {
	console.log('networkFirst', req.url)
	try {
		return await fetchAndCache(req)
	} catch(err) {
		return caches.match(req)
	}
}

async function dynamic(req) {
	console.log('dynamic', req.url)
	if (isOffline || prefferCache)
		return cacheFirst(req)
	else
		return networkFirst(req)
}

// Does both cache lookup and fetch at the same time, returns the fastest response.
// The fastest is usually cache (if previously cached). The fetche response will
// be cached to ensure this strategy is at most one refresh behind latest version.
async function fastest(e) {
	console.log('fastest', req.url)
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
	// Always look in the cache. Prevent unnecessary fetch when we're on cellular or weak connection.
	if (isOffline || prefferCache)
		var promises = [caches.match(e.request)]
	else
		var promises = [caches.match(e.request), fetchAndCache(e.request)]
	// The fastest of the (up to) two methods serves the data.
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