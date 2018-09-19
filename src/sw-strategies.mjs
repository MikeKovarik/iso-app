import {isOffline, prefferCache} from './sw-connection.mjs'


// TODO: properly handle cached response and pass it to fetchAndCache()

export async function cacheFirst(req, res, e) {
	//console.log('cacheFirst', req.url)
	try {
		return await this.cache.match(req)
	} catch(err) {
		return this.fetchAndCache(req)
	}
}

export async function networkFirst(req, res, e) {
	//console.log('networkFirst', req.url)
	try {
		return await this.fetchAndCache(req)
	} catch(err) {
		return this.cache.match(req)
	}
}

export async function dynamic(req, res, e) {
	//console.log('dynamic', req.url)
	if (isOffline || prefferCache)
		return cacheFirst(req, res, e)
	else
		return networkFirst(req, res, e)
}

// Does both cache lookup and fetch at the same time, returns the fastest response.
// The fastest is usually cache (if previously cached). The fetche response will
// be cached to ensure this strategy is at most one refresh behind latest version.
export async function fastest(req, res, e) {
	//console.log('fastest', req.url)
	// Always look in the cache. Prevent unnecessary fetch when we're offline.
	if (isOffline)
		var promises = [this.cache.match(e.request)]
	else
		var promises = [this.cache.match(e.request), this.fetchAndCache(e.request)]
	// The fastest of the (up to) two methods serves the data.
	e.respondWith(Promise.race(promises))
	// waitUntil() prevents worker from getting killed until the cache is updated.
	if (promises.length > 1)
		e.waitUntil(Promise.all(promises))
}

// Similar to fastest() but only makes the network fetch() on fast connections.
export async function hybrid(req, res, e) {
	//console.log('get ', req.url)
	// Always look in the cache. Prevent unnecessary fetch when we're on cellular or weak connection.
	if (isOffline || prefferCache)
		var promises = [this.cache.match(req)]
	else
		var promises = [this.cache.match(req), this.fetchAndCache(req)]
	// waitUntil() prevents worker from getting killed until the cache is updated.
	if (promises.length > 1)
		e.waitUntil(Promise.all(promises))
	// The fastest of the (up to) two methods serves the data.
	// Cache resolves with undefined if the file is not cached. Fallback to fetch().
	// WARNING: We cannot return undefined in e.respondWith().
	return await Promise.race(promises)
		|| (await Promise.all(promises)).find(isNotUndefined)
}

function isNotUndefined(arg) {
	return arg !== undefined
}
