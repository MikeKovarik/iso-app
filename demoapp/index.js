var platform = window['platform-detect']
var app = window['iso-app']
var $ = document.querySelector.bind(document)



if (platform.uwp) {
	var {ApplicationView, ApplicationViewSwitcher} = Windows.UI.ViewManagement
}

var log
if (platform.hasWindow) {
	log = function(...args) {
		//console.log(...args)
		$('#log').innerHTML += args
			.map(obj => !!obj && JSON.stringify(obj))
			.join(' ') + '<br>'
	}
} else {
	log = console.log.bind(console)
}

if (platform.hasWindow) {
	log('id', app.currentWindow.id)
	logWindow(app.currentWindow)
}
log('isMainWindow', app.isMainWindow)
log('isMainProcess', app.isMainProcess)

if (platform.node)
	log(`Node.js ${process.versions.node}`)
if (platform.nwjs || platform.electron)
	log(`Chromium ${process.versions.chrome || process.versions.chromium}`)
if (platform.nwjs)
	log(`NW.JS ${process.versions.nw}`)
if (platform.electron)
	log(`Electron ${process.versions.electron}`)


var winOptions = {
	width: 500,
	height: 500,
	x: 10,
	y: 10,
}

function openWindow() {
	var win = app.open(winOptions)
	logWindow(win)
}
function logWindow(win = app.currentWindow) {
	log('logging for', win.id)
	//win.on('blur', e => log(win.id, 'blur'))
	//win.on('focus', e => log(win.id, 'focus'))
	win.on('show', e => log(win.id, 'show'))
	win.on('hide', e => log(win.id, 'hide'))
	win.on('maximize', e => log(win.id, 'maximize'))
	win.on('unmaximize', e => log(win.id, 'unmaximize'))
	win.on('minimize', e => log(win.id, 'minimize'))
	win.on('restore', e => log(win.id, 'restore'))
	win.on('enter-full-screen', e => log(win.id, 'enter-full-screen'))
	win.on('leave-full-screen', e => log(win.id, 'leave-full-screen'))
	win.on('close', e => log(win.id, 'close'))
	win.on('closed', e => log(win.id, 'closed'))

	/*
	win.on('blur',  e => log('win blur'))
	win.on('focus', e => log('win focus'))
	win.on('minimize', e => log('win minimize'))
	win.on('restore',  e => log('win restore'))
	win.on('maximize',   e => log('win maximize'))
	win.on('unmaximize', e => log('win unmaximize'))
	win.on('restore',  e => log('win restore'))

	if (win.browserWindow) {
		win.browserWindow.on('blur',  e => log('win blur'))
		win.browserWindow.on('focus', e => log('win focus'))
		win.browserWindow.on('minimize', e => log('win minimize'))
		win.browserWindow.on('restore',  e => log('win restore'))
		win.browserWindow.on('maximize',   e => log('win maximize'))
		win.browserWindow.on('unmaximize', e => log('win unmaximize'))
		win.browserWindow.on('restore',  e => log('win restore'))
	}
	if (win.nwWindow) {
		win.nwWindow.on('blur',  e => log('win blur'))
		win.nwWindow.on('focus', e => log('win focus'))
		win.nwWindow.on('minimize', e => log('win minimize'))
		win.nwWindow.on('restore',  e => log('win restore'))
		win.nwWindow.on('maximize',   e => log('win maximize'))
		win.nwWindow.on('unmaximize', e => log('win unmaximize'))
		win.nwWindow.on('restore',  e => log('win restore'))
	}
	*/
}

var $winCount = $('#win-count')
var $windows = $('#windows')
function updateWinCount() {
	$winCount.textContent = `${app.windows.length} [${app.windows.map(w => w.id).join(', ')}]`
	$windows.innerHTML = app.windows.map(win => `
	<div class="window">
		<div>
			<button onclick="app.windows.find(w => w.id === ${win.id}).close()">close</button>
			<button onclick="app.windows.find(w => w.id === ${win.id}).maximize()">maximize</button>
			<button onclick="app.windows.find(w => w.id === ${win.id}).minimize()">minimize</button>
			<button onclick="app.windows.find(w => w.id === ${win.id}).restore()">restore</button>
			<button onclick="app.windows.find(w => w.id === ${win.id}).focus()">focus</button>
		</div>
		<div>
			<div>id: ${win.id}</div>
			<div>isMainWindow: ${win.isMainWindow}</div>
			<div>maximized: ${win.maximized}</div>
			<div>minimized: ${win.minimized}</div>
			<div>fullscreen: ${win.fullscreen}</div>
			<div>x: ${win.x}, y: ${win.y}</div>
			<div>w: ${win.width}, h: ${win.height}</div>
		</div>
	</div>
	`).join('\n')
}
updateWinCount()
setInterval(updateWinCount, 1000)


$('#open').addEventListener('click', openWindow)
//$('#open').addEventListener('click', () => app.openWindow())
/*
$('#emit').addEventListener('click', () => app.emit('emiting'))
$('#broadcast').addEventListener('click', () => app.broadcast('broadcasting to all'))
*/