var app = window['iso-app']


var $log = document.querySelector('#log')
function log(...args) {
	$log.innerHTML += `${args.join(' ')}\n`
}

log('hello from JS', Math.random())

log(window['platform-detect'].dev ? 'DEV' : 'normal')

app.on('sw-register',   url => log('sw-register  ', url))
app.on('sw-registered', url => log('sw-registered', url))
app.on('sw-installing', url => log('sw-installing', url))
app.on('sw-installed',  url => log('sw-installed ', url))
app.on('sw-activating', url => log('sw-activating', url))
app.on('sw-activated',  url => log('sw-activated ', url))
app.on('sw-stopped',    url => log('sw-stopped   ', url))
app.on('sw-update',     url => log('sw-update    ', url))
app.on('sw-updated',    url => log('sw-updated   ', url))


if (navigator.serviceWorker) {
	$uninstall = document.querySelector('#uninstall')
	$uninstall.addEventListener('click', async () => {
		var regs = await navigator.serviceWorker.getRegistrations()
		var promises = regs.map(reg => reg.unregister())
		Promise.all(promises).then(() => console.log('UNREGISTERED ALL'))
	})
} else {
	log('serviceWorker API unavailable')
}

if (window.caches) {
	$clear = document.querySelector('#clear')
	$clear.addEventListener('click', async () => {
		var names = await caches.keys()
		names.forEach(name => caches.delete(name))
	})
} else {
	log('caches API unavailable')
}

$info = document.querySelector('#info')
$info.addEventListener('click', async () => {
	var regs = await navigator.serviceWorker.getRegistrations()
	regs.map(reg => reg.installing || reg.waiting || reg.active)
		.map(sw => {
			log('\nSERVICE WORKER')
			log(sw.scriptURL)
			log('state', sw.state)
		})

	var names = await caches.keys()
	names.forEach(async name => {
		log('\nCACHE:', name)
		var cache = await caches.open(name)
		var reqs = await cache.keys()
		reqs.map(req => req.url)
			.forEach(url => log(url))
	})
})

$reload = document.querySelector('#reload')
$reload.addEventListener('click', async () => {
	location.reload()
})