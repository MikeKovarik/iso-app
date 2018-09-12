console.log('loaded dummy.js')
self.skipWaiting()
	.then(() => console.log('service worker restarted'))
	.catch(err => console.log('service worker restart failed', err))

//self.addEventListener('install', e => e.waitUntil(onInstall(e)))
self.addEventListener('fetch',   e => e.respondWith(onFetch(e)))

var cache

async function onInstall(e) {
	console.log('# dummy sw install')
	cache = await caches.open('dummy')
	await cache.addAll([
		'./',
		//'./index.html',
		//'./manifest.json',
	])
}

async function onFetch(e) {
	var req = e.request
	return fetch(req)
	console.log('req', req)
	var res = await caches.match(req) || await fetch(req)
	console.log('res', res)
	return res
}