var platform = require('platform-detect')
var app = require('./node_modules/iso-app/index.js')


app.on('ready', () => {
	var win = app.open({
		url: 'index.html',
		title: 'Anchora',
		position: 'center',
		width: 600,
		height: 500
	})
	/*win.on('closed', () => {
		win = null
	})*/
})

app.on('window-new', win => console.log('window-new', win.id))

if (platform.electron) {
	var electron = require('electron')
	var electronApp = require('electron').app

	electronApp.on('window-all-closed', e => console.log('window-all-closed'))
	electronApp.on('before-quit', e => console.log('before-quit'))
	electronApp.on('will-quit', e => console.log('will-quit'))
	electronApp.on('quit', e => console.log('quit'))
}
