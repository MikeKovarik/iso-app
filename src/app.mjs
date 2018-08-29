import platform from 'platform-detect'
import {EventEmitter} from './deps.mjs'
import {nw, electron} from './platforms.mjs'
import {asyncTimeout} from './util.mjs'
import {registerClass, registerPlugin} from './plugin-core.mjs'



//nw.App.getDataPath() => 'C:\Users\Mike\AppData\Local\demoapp\User Data\Default'

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

		// app.ready should be a single promise that handles initialization promises of all loaded plugins.
		this._readyPromises = []
		this.ready = new Promise(async resolve => {
			// Plugins can be initialized after this constructor so we have to wait until at least next tick.
			// But since plugins can be loaded even after this main script we need to wait a little longer.
			await asyncTimeout(50)
			await Promise.all(this._readyPromises)
			resolve()
		})

	}

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
