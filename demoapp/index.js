var platform = window['platform-detect']
var app = window['iso-app']
var $ = document.querySelector.bind(document)



if (platform.uwp) {
	var {ApplicationView, ApplicationViewSwitcher} = Windows.UI.ViewManagement
}

function log(...args) {
	console.log(...args)
	$('#log').innerHTML += args.join(' ') + '<br>'
}


log('app.isMainWindow', app.isMainWindow)
log('app.isMainProcess', app.isMainProcess)

if (platform.node)
	log(`Node.js ${process.versions.node}`)
if (platform.nwjs || platform.electron)
	log(`Chromium ${process.versions.chrome || process.versions.chromium}`)
if (platform.nwjs)
	log(`NW.JS ${process.versions.nw}`)
if (platform.electron)
	log(`Electron ${process.versions.electron}`)




/*

window.addEventListener('message', e => {
	console.log('MESSAGE', e.data)
	log(e.data)
})


if (platform.uwp) {

	var appView = ApplicationView.getForCurrentView()

	setTimeout(() => {
		//console.log('parent', parent)
		console.log('appView', appView.id, appView)
	}, 500)

	appView.addEventListener('consolidated', e => {
		console.log('consolidated')
		if (!app.isMainWindow) {
			//window.close()
		}
	})

}
*/




var winOptions = {
	width: 500,
	height: 500,
	x: 10,
	y: 10,
}


$('#open').addEventListener('click', () => app.open(winOptions))
//$('#open').addEventListener('click', () => app.openWindow())
$('#emit').addEventListener('click', () => app.emit('emiting'))
$('#broadcast').addEventListener('click', () => app.broadcast('broadcasting to all'))

$('#to-opener').addEventListener('click', () => opener.postMessage('to opener', location.origin))
$('#to-newWindow').addEventListener('click', () => app.windows[0].postMessage('to newWindow', location.origin))

