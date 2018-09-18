var defaultOptions = {
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

var options = Object.assign({}, defaultOptions)

export default options

export function setOptions(newOptions) {
	for (var [key, val] of Object.entries(newOptions))
		if (val === undefined)
			options[key] = defaultOptions[key]
		else
			options[key] = val
}