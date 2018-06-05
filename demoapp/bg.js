var platform = require('platform-detect')
var {EventEmitter} = require('events')

// Times are rough, everything's trying to kill ya.
// ES Modules are transpiled down to UMD so this hack (like i had a choice, if only there was
// any other way to silently fail importing missing ES Module) will have to do for the time being.


var nw
var electron

if (platform.nwjs)
	nw = require('nw.gui')
if (platform.electron)
	electron = require('electron')

var options = {
	title: 'Anchora',
	position: 'center',
	width: 600,
	height: 500
}

var url = 'index.html'

var openWindow
var app

if (nw) {

	class App extends EventEmitter {
		quit() {
			this.emit('quit')
			nw.App.quit()
		}
	}
	app = new App
	setTimeout(() => app.emit('ready'))

	openWindow = () => {
		var callback = nwWindow => console.log('OPENED', nwWindow)
		nw.Window.open(url, options, callback)
	}

}

if (electron) {

	var {BrowserWindow} = electron
	var electronApp = electron.app

	app = electronApp

	let win

	openWindow = () => {
		win = new BrowserWindow(options)
		win.loadFile(url)
		win.on('closed', function () {
			win = null
		})
	}

	electronApp.on('activate', function () {
		if (win === null) {
			openWindow()
		}
	})

}



// On OS X it is common for applications and their menu bar
// to stay active until the user quits explicitly with Cmd + Q
app.on('window-all-closed', function () {
	app.quit()
})

app.on('ready', openWindow)



/*
class AppWindow {

	constructor() {
		this.visible = false
		this.minimized = false
		this.toggle = this.toggle.bind(this)
		this.show = this.show.bind(this)
		this.hide = this.hide.bind(this)
		this.close = this.close.bind(this)

		nw.Window.open('./index.html', {
			title: 'Anchora',
			position: 'center',
			width: 800,
			height: 550,
			//resizable: true,
			//toolbar: false,
			frame: false,
			//show: true
		}, nwWindow => {
			this.visible = true
			this.nwWindow = nwWindow
			this.window = nwWindow.window
			this.document = nwWindow.window.document
			this.nwWindow.on('close', this.close)
			this.nwWindow.on('minimize', () => this.minimized = true)
			this.nwWindow.on('restore', () => this.minimized = false)
		})
	}

	toggle() {
		if (!this.visible || this.minimized)
			this.show()
		else
			this.hide()
	}

	show() {
		if (this.minimized)
			this.nwWindow.restore()
		if (this.visible) return
		this.nwWindow.setShowInTaskbar(true)
		setTimeout(() => this.nwWindow.show())
		this.visible = true
	}

	hide() {
		if (!this.visible) return
		this.nwWindow.minimize()
		this.nwWindow.setShowInTaskbar(false)
		this.visible = false
	}

	close() {
		if (this.running)
			this.hide()
		else
			this.nwWindow.close(true)
	}

}


var win = new AppWindow()

win.show()
*/


