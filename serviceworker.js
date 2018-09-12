self.skipWaiting()
	.then(() => console.log('service worker restarted'))
	.catch(err => console.log('service worker restart failed', err))

var cache

var opts = {
	cacheLocalFiles: true,
	cacheRemoteFiles: true,
	// Retrieve the resource from cache first and then fallback to network if needed.
	cacheFirst: true,
	// Keep making file requests and cache them if they changed
	cacheContinuousUpdate: true,
	cacheOnce: false,
	// Mimes of files to cache
	cacheMimes: [
		'application/javascript',
		'application/json',
		'text/',
		'image/',
		//'font/',
		//'text/html',
		//'text/css',
		//'text/plain',
		//'image/png',
	],
}


// We don't have access to manifest.json and fetching it would take some time.
// Plus we cannot know for sure it even exists.
var cacheName = self.registration.scope.slice(location.origin.length + 1).replace(/\/$/, '')
console.log('## NAME', cacheName)

// Install the service worker.
self.addEventListener('install',  e => e.waitUntil(onInstall(e)))
self.addEventListener('activate', onActivate)
self.addEventListener('fetch',    e => e.respondWith(onFetch(e)))

self.addEventListener('message', e => {
	var newOptions = Object.assign({}, e.data)
	for (var [key, val] of Object.entries(newOptions))
		if (val == undefined)
			delete newOptions[key]
	//console.log('SW Received options', newOptions)
	Object.assign(opts, newOptions)
})

// 'install' event fires when this file changes.
async function onInstall(e) {
	// Force current version of service worker to activate.
	self.skipWaiting()
	console.log('### INSTALL ###')
	cache = await caches.open(cacheName)
	await cache.addAll([
		// Path is relative to the origin, not the app directory.
		'./',
		'./index.html',
		'./manifest.json',
		// this serviceworker file
		//location.pathname,
	])
}

async function onActivate() {
	self.clients.claim()
}

// Define what happens when a resource is requested.
// For our app we do a Cache-first approach.
async function onFetch(e) {
	var req = e.request
	// Try retrieving resource from cache.
	var cachedRes, freshRes
	if (opts.cacheFirst) {
		//console.log('try cached    ', req.url)
		cachedRes = await caches.match(req)
		//if (cachedRes)
		//	console.log('return cached ', req.url)
	}
	// Fallback to network if resource not stored in cache or if we want to keep updating it.
	if (!cachedRes) {
		//console.log('fetching fresh', req.url)
		freshRes = await fetch(req)
		if (opts.cacheOnce || opts.cacheContinuousUpdate)
			maybeCache(req, freshRes, cachedRes)
	} else if (opts.cacheContinuousUpdate) {
		// We already retrieved (and are about to return) cached response
		// but we still want to fetch fresh resource silently in the background.
		// We won't be able to return it right away, but it'll be cached for the next time.
		fetch(req)
			.then(freshRes => maybeCache(req, freshRes, cachedRes))
			.catch(err => console.warn('cannot cache/fetch', url, err))
	}
	return cachedRes || freshRes
}

function maybeCache(req, res, cachedRes) {
	if (res.redirected) return
	if (!res.ok) return
	if (res.status !== 200) return
	if (!opts.cacheLocalFiles && !opts.cacheRemoteFiles) return

	var mime = res.headers.get('content-type')
	if (mime) {
		var isCacheableMime = opts.cacheMimes.some(allowedMime => mime.startsWith(allowedMime))
		if (!isCacheableMime) return
	}
	/*if (res.headers) {
		for (var [key, val] of res.headers.entries()) {
		}
	}*/

	if (isCacheUpToDate(res, cachedRes)) {
		//console.log('up to date    ', req.url)
		return
	} else {
		//console.log('obsolete      ', req.url)
	}

	var isLocalResource = req.url.startsWith(location.origin)
	if (isLocalResource && opts.cacheLocalFiles) {
		//console.log('CACHING local ', req.url)
		cache.put(req, res.clone())
	} else if (!isLocalResource && opts.cacheRemoteFiles) {
		//console.log('CACHING remote', req.url)
		cache.remote.put(req, res.clone())
	}
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

function notifyParentAboutUpdate(res, cachedRes) {
	self.postMessage(`${fresh.url} is obsolete`)
}
