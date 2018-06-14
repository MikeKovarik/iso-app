var platform = window['platform-detect']
var $ = document.querySelector.bind(document)



var $winCount = $('#win-count')
var $windows = $('#windows')
var $log = $('#log')



var log
if (platform.hasWindow) {
	log = function(...args) {
		//console.log(...args)
		$log.innerHTML += args
			.map(obj => obj !== undefined && obj !== null && JSON.stringify(obj))
			.join(' ') + '<br>'
	}
} else {
	log = console.log.bind(console)
}

class OrderedSet extends Array {
	add(item) {
		if (this.includes(item)) return
		this.push(item)
	}
	has(item) {
		return this.includes(item)
	}
	delete(item) {
		var index = this.indexOf(item)
		if (index === -1) return
		this.splice(index, 1)
	}
	get size() {
		return this.length
	}
}


///////////////////////////////////////////////
// UWP WINDOWS FIRE NO EVENTS
///////////////////////////////////////////////



try {
	window.name = MSApp.getViewId(window)
} catch(err) {
	window.name = Math.round(Math.random() * 10000)
}

log('this id', getId(window))
if (window.opener)
	log('parent id', getId(window.opener))

function getId(win) {
	if (platform.uwp)
		return MSApp.getViewId(win)
	else if (win.name)
		return parseInt(win.name)
}

var platform = {
	uwp: typeof MSApp !== 'undefined',
	web: typeof MSApp === 'undefined'
}





window.injectWindow = function injectWindow(win, id) {
	log('injectWindow()', typeof win, typeof id, id)
	addWindow(win, id)
}

function addWindow(win, id = getId(win)) {
	log(id, 'adding')
	if (windows.has(win)) log(id, 'DUPLICATE WINDOW')
	if (windows.find(maw => maw.id === id)) log(id, 'DUPLICATE ID')
	if (windows.has(win)) return
	if (windows.find(maw => maw.id === id)) return
	log(id, 'added')

	var maw = {
		id,
		window: win,
	}

	windows.add(maw)

	win.addEventListener('beforeunload', e => {
		log(id, 'beforeunload')
		windows.delete(maw)
		updateWinCount()
	})
	win.addEventListener('unload', e => {
		log(id, 'unload')
		windows.delete(maw)
		updateWinCount()
	})
	updateWinCount()
	return maw
}

async function updateWinCount() {
	await new Promise(resolve => setTimeout(resolve))
	var ids = Array.from(windows).map(maw => maw.id)
	$winCount.innerHTML = `${windows.size} [${ids}]`	
	$windows.innerHTML = ''
	$windows.append(...windows.map(maw => {
		var div1 = document.createElement('div')
		div1.classList.add('window')
		var div2 = document.createElement('div')
		div1.append(div2)
		div2.append(
			maw.id,
			createButton('close',    e => maw.window.close()),
			//createButton('win.post', e => maw.window.postMessage('clicked from ' + currentWindow.id, '*')),
		)
		return div1
	}))
	function createButton(text, callback) {
		var node = document.createElement('button')
		node.innerText = text
		node.addEventListener('click', callback)
		return node
	}
}






var windows = new OrderedSet()
if (platform.uwp)
	BroadcastChannel._getWindowList = () => windows
var currentWindow = addWindow(window)
if (window.opener)
	addWindow(window.opener)
log('------------------------------------')


updateWinCount()





function getWindow(win) {
	if (!win) return
	try {
		let getWindow = Symbol()
		win[getWindow] = function() {return this}
		let unrestricted = win[getWindow]()
		if (unrestricted)
			return unrestricted
	} catch(err) {}
	return win
}

// "You used document.readyState, it was not very effective."
// Chrome fires 'unload' before 'load' even for newly created window WTF
// UWP denies permissions to read document.readyState (both on remote and actual window object)
// and readyState is unreliable anyway.
// UWP doesn't fire the 'load' event for newly created window and because missing already-loaded API
// it's safer o just wait it out with short timer
// Oh and removing event listener on remote window in Edge does nothing, hence the resolved variable.
// Welcome to web development where everything's made up standards don't matter.
function promiseLoadEvent(win) {
	return new Promise(resolve => {
		var millis = platform.web ? 1000 : 200
		var timeout
		var resolved = false
		function restartTimer() {
			if (resolved) return
			clearTimeout(timeout)
			timeout = setTimeout(handler, millis)
		}
		function handler(e) {
			if (resolved) return
			clearTimeout(timeout)
			win.removeEventListener('unload', restartTimer)
			win.removeEventListener('load', handler)
			resolve(e)
			resolved = true
		}
		var now = Date.now()
		win.addEventListener('unload', restartTimer)
		win.addEventListener('load', handler)
		restartTimer()
	})
}


var newWin
$('#open').addEventListener('click', e => {
	customOpenWindow('index.html', '', 'width=400,height=500')
})

async function customOpenWindow(url, name, options) {
	if (platform.uwp && !!window.opener) {
		window.opener.customOpenWindow(url, name, options)
		return
	}
	newWin = window.open(url, name, options)
	await promiseLoadEvent(newWin)
	log('opened', typeof newWin.name, newWin.name, getId(newWin))
	console.log('newWin ready', newWin.name)
	//console.log('injecting current windows to new one')
	var ids = windows.map(maw => maw.id).join(', ')
	try {
		log(`injecting existing windows (${ids}) to new window (${getId(newWin)})`)
		if (newWin.injectWindow)
			for (var maw of windows)
				newWin.injectWindow(maw.window, maw.id)
	} catch(err) {
		console.error(err)
	}
	try {
		log(`injecting new window (${getId(newWin)}) to existing windows (${ids})`)
		for (var maw of windows.filter(maw => maw.window !== self))
			maw.window.injectWindow(newWin, getId(newWin))
	} catch(err) {
		console.error(err)
	}
	addWindow(newWin)
}
window.customOpenWindow = customOpenWindow



var bc = new BroadcastChannel('test_channel')

bc.onmessage = e => {
	log('received:', e.data)
}

$('#send').addEventListener('click', e => {
	bc.postMessage('this is the message')
})
