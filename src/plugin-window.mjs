import platform from 'platform-detect'
import {nw, electron, BrowserWindow} from './platforms.mjs'
import {plugin} from './plugin-core.mjs'


@plugin
export class AppWindow {

	pluginConstructor() {
		// Handle window related events when to code is executed in window (instead of background script).
		if (this.currentWindow) {
			// TODO: this event will probably be replaces when windows will be reimplemented
			//       but having single IPC event as opposed to multiple instructions for all windows
			//       seems more efficient.
			this.on('__close-all-windows', () => this.currentWindow.close())
		}
	}

	// Shows all app windows.
	//show() {}

	// Hides all app windows.
	//show() {}

	openWindow(url = 'index.html', options) {
		// Handle arguments. If url is not explicit, it might be in options object.
		// Otherwise fallback to index.html.
		if (typeof url === 'object')
			[url, options] = [url.url || 'index.html', url]
		this.emit('open', url, options)
		var win = this._openWindow(url, options)
		// TODO: figure out how to filter the window when the event is broadcasted over IPC.
		this.emit('window-new', win)
		return win
	}
	_openWindow(url, options) {
		if (platform.electron) {
			let win = new BrowserWindow({width: 800, height: 600})
			if (url.includes('://'))
				win.loadURL(url)
			else
				win.loadFile(url)
			return win
		}
	}

	// Opens app, or focuses main window if there is one.
	// Does not create more than one window (if the app supports multi windowing or multi instance).
	open(url, options) {
		// TODO
		if (this.windows.length) {
			// Focus existing window.
		} else {
			// Open new window because the only one was closed.
			this.openWindow(url, options)
		}
	}

	// Peacefuly closes all app windows.
	// Similar to .quit() but leaves the background script running (if there is any)
	// without having to prevent 'will-quit' events.
	close() {
		if (platform.electron) {
			// TODO: some more research and testing.
			if (platform.hasWindow) {
				// It does not work from window.
				// Electron's background script has to prevent 'will-quit'.
			} else {
				// TODO: the event probably won't fire if user prevents 'before-quit' prior to this.
				// It works from background script.
				electronApp.once('will-quit', e => e.preventDefault())
				electronApp.quit()
			}
		} else {
			// TODO: reimplement window list again and close one by one.
			this.emit('__close-all-windows')
			this.windows.clear()
		}
	}

}




@plugin
export class AppWindows {

	pluginConstructor() {
		// TODO: reimplement
		// Very crude
		this.windows = []
		if (platform.hasWindow) {
			if (platform.nwjs)
				this.currentWindow = nw.Window.get()
			else if (platform.electron)
				this.currentWindow = electron.remote.getCurrentWindow()
			else
				this.currentWindow = window
		}
		if (this.currentWindow)
			this.windows.push(this.currentWindow)

		app.on('window-new', win => this.windows.push(win))
		app.on('window-closed', win => {
			// TODO: FIND THE WINDOW THAT HAS BEEN CLOSED AND REMOVE IT FROM THE LIST
		})
	}

}
