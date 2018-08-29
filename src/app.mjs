import platform from 'platform-detect'
import {EventEmitter} from './deps.mjs'
import {nw, electron} from './platforms.mjs'
import {asyncTimeout} from './util.mjs'
import {registerClass, registerPlugin} from './plugin-core.mjs'



//nw.App.getDataPath() => 'C:\Users\Mike\AppData\Local\demoapp\User Data\Default'

if (platform.electron) {
	var electronApp = electron.app || electron.remote.app
	var BrowserWindow = electron.BrowserWindow || electron.remote.BrowserWindow
}

// TERMINOLOGY:

// This module:
// - window = environment with window and GUI.
//   that is: window or as called in electron a renderer
// - background script (or just script) = environment without window/renderer
//   that is: web worker, node console application, electron's main script, NW.JS background script

// electron:
// - renderer = window
// - main script = background script without gui

// UWP:
// - view = window

export default class App extends EventEmitter {

	constructor() {
		super()

		// Name of the app. To be replaced by user.
		// NOTE: necessary for discrete BroadcastChannel.
		this._applyPlugins(this)

		var emitReady = () => this.emitLocal('ready')
		if (platform.electron)
			electronApp.once('ready', emitReady)
		else
			setTimeout(emitReady)

		// Handle window related events when to code is executed in window (instead of background script).
		if (this.currentWindow) {
			// TODO: this event will probably be replaces when windows will be reimplemented
			//       but having single IPC event as opposed to multiple instructions for all windows
			//       seems more efficient.
			this.on('__close-all-windows', () => this.currentWindow.close())
		}
	}

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

	// Shows all app windows.
	//show() {}

	// Hides all app windows.
	//show() {}

	// Exits immediately with exitCode. exitCode defaults to 0.
	// https://electronjs.org/docs/api/app#appexitexitcode
	exit(exitCode = 0) {
		// All windows will be closed immediately without asking user and
		// the before-quit and will-quit events will not be emitted.
		if (platform.electron) {
			electronApp.exit(exitCode)
		} else if (platform.nwjs) {
			// NOTE: NWJS quit() does not sends 'close' event to windows.
			// TODO: investigate if electron does it the same way. Unify if not.
			nw.App.quit()
		} else if (platform.uwp) {
			// todo
		}
	}

	// Force kills the app and all it's processes.
	// https://electronjs.org/docs/api/app#appquit
	async quit() {
		// TODO: there's a lot to figure out.
		//       - What should happen when .quit() is called from bg script, main window, any other window?
		//       - Should 'before-quit' and 'will-quit' events show up in windows or only bg script?
		//       - How to sync all the events (and the event object) through IPC and ensure preventability?
		if (platform.electron) {
			electronApp.quit()
		} else {
			// Recreate electron's quit flow and events.
			// First 'before-quit' is emitted before windows start closing. User can prevent it through the event.
			var willQuitEvent = new CustomEvent('will-quit', {cancelable: true})
			this.emitLocal('quit', quitEvent, exitCode)
			if (willQuitEvent.defaultPrevented) return
			// Then 'will-quit' is emitted after all windows are closed (and only the background script is running)
			// Which can still be prevented by calling .preventDefault() on the event object.
			var beforeQuitEvent = new CustomEvent('before-quit', {cancelable: true})
			this.emitLocal('quit', quitEvent, exitCode)
			if (beforeQuitEvent.defaultPrevented) return
			// If nothing is prevented, app proceeds to quit right after the 'quit' is emitted.
			var exitCode = 0
			var quitEvent = new CustomEvent('quit')
			this.emitLocal('quit', quitEvent, exitCode)
			await asyncTimeout()
			this.exit(exitCode)
		}
	}

	get name() {
		this.getName()
	}
	set name(name) {
		this.setName(name)
	}

	get id() {
		if (platform.uwp)
			return Windows.ApplicationModel.Package.current.id.name
	}


	// ELECTRON SHIM

	isReady() {
		if (platform.electron)
			return electronApp.isReady()
		else
			return this.ready
	}

	getName() {
		if (platform.electron)
			return electronApp.getName()
		else if (platform.uwp)
			return Windows.ApplicationModel.Package.current.displayName
	}
	setName(name) {
		if (platform.electron)
			return electronApp.setName(name)
	}

	// The current application directory.
	// https://electronjs.org/docs/api/app#appgetapppath
	getAppPath() {
		if (platform.electron)
			return electronApp.getAppPath()
		else if (platform.uwp)
			return Windows.ApplicationModel.Package.current.installedLocation.path
	}

	// https://electronjs.org/docs/api/app#appgetpathname
	getPath(name) {
		if (platform.electron) {
			return electronApp.getPath(name)
		} else if (platform.uwp) {
			switch (name) {
				// User's home directory.
				case 'home':      return Windows.Storage.ApplicationData.current.localFolder.path.split('\\').slice(0, 3).join('\\')
				// Per-user application data directory, which by default points to %APPDATA%
				case 'appData':   return undefined
				// The directory for storing your app's configuration files, which by default it is the appData directory appended with your app's name.
				// electron: C:\Users\Mike\AppData\Roaming\demoapp
				// UWP:      C:\Users\Mike\AppData\Local\Packages\65e03ac3-8c98-4f3e-b1c9-786ff0f9c692_dg3rhm3j3sdc0\LocalState
				case 'userData':  return Windows.Storage.ApplicationData.current.localFolder.path
			}

		}
	}


	// events
	// 'ready' - iso-app and underlying platform's standard libraries are ready. Fires only once.
	// 'window-all-closed' - electron
	// 'window-closed' - custom
	// 'window-new' - custom

}

// emit() broadcasts the event through IPC across other windows and processes (if IPC plugin is used).
// emitLocal() ensures the event is emitted only locally.
// The method is defined here instead of in IPC plugin to save ourself from runtime checks.
App.prototype.emitLocal = EventEmitter.prototype.emit

registerClass(App)


class AppWindows {

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

registerPlugin(AppWindows)