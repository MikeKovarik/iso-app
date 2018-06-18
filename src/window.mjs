import platform from 'platform-detect'
import {EventEmitter, nw, electron} from './deps.mjs'
import {registerPlugin, registerClass} from './plugin-core.mjs'
import {
	BrowserWindow,
	ArraySet,
	isAppWindow,
	isNWWindow,
	isBrowserWindow,
	isWindow,
	getWindowOpener,
	getRandomWindowId,
	sanitizeUrl,
} from './window-util.mjs'

// TODO: change emit to local emit

// plot twists
// ELECTRON
// - if we inherit electrons BrowserWindow, how to make classes for existing BrowserWindow instances?
// - we can access all open BrowserWindow instances with BrowserWindow.getAllWindows()
// - we can access current BrowserWindow with remote.getCurrentWindow()
// UWP
// - how to access nested window objects if it throws

// A bit of internal docs:
//var remote = require('electron').remote
// All Electron's BrowserWindow instances
//remote.BrowserWindow.getAllWindows()
// Current Electron's BrowserWindow instances
//remote.getCurrentWindow()

// All Chrome AppWindow instances
//var appWindows = chrome.app.window.getAll()
// All NW.JS NWWindow instances
//var nwWindows = chrome.app.window.getAll().map(appWindow => nw.Window.get(appWindow.contentWindow))
// All web window instances
//var windows = chrome.app.window.getAll().map(appWindow => appWindow.contentWindow)
// web window from NW.JS NWWindow
//var window = nwWindow.window
// web window from Chrome AppWindow
//var window = appWindow.contentWindow
// NW.JS NWWindow from Chrome AppWindow
//var nwWindow = nw.Window.get(appWindow.contentWindow)
// Chrome AppWindow from NW.JS NWWindow
//var appWindow = nwWindow.appWindow
//
//nwWindow.window === nwWindow.appWindow.contentWindow

// NW.JS NWWindow internals
// https://github.com/nwjs/nw.js/blob/nw31/src/resources/api_nw_window.js




var nativeMap = new Map() // TODO
var activeWindows = new ArraySet()
// Needed for UWP BroadcastChannel polyfill.
if (platform.uwp)
	BroadcastChannel._getWindowList = () => windows


// TODO
//if (platform.electron)
//	var ManagedAppWindowSuperClass = BrowserWindow
//else
	var ManagedAppWindowSuperClass = EventEmitter

var ManagedAppWindow = registerClass(class ManagedAppWindow extends ManagedAppWindowSuperClass {

	// Gets ManagedAppWindow instance for current window.
	static get() {
		if (platform.nwjs)
			return this.from(nw.Window.get())
		else if (platform.electron)
			return this.from(electron.remote.getCurrentWindow())
		else if (platform.hasWindow)
			return this.from(window)
	}
	
	// Resolves Window, NwWindow, BrowserWindow, AppWindow objects and string ID into ManagedAppWindow instance.
	static from(arg) {
		if (typeof arg === 'string' || typeof arg === 'number') {
			var id = parseInt(arg)
			var appwin = activeWindows.find(appwin => appwin.id === id)
			return appwin || new this(arg)
		} else {
			return nativeMap.get(arg) || new this(arg)
		}
	}

	// https://electronjs.org/docs/api/browser-window#browserwindowgetallwindows
	static getAllWindows() {
		return activeWindows
	}

	static getFocusedWindow() {
		return activeWindows.find(w => w.focused)
	}

	// https://electronjs.org/docs/api/browser-window#browserwindowfromidid
	static fromId(id) {
		return activeWindows.find(w => w.id === parseInt(id))
	}

	constructor(arg) {
		super()
		console.log('ManagedAppWindow constructor')
		this._detectArgument(arg)

		// Store all various shapes and object pointing to the current window in a map used by
		// static .from() method to prevent creation of new instances of the same window.
		if (this.browserWindow)	{
			nativeMap.set(this.browserWindow, this)
		} else if (this.nwWindow) {
			nativeMap.set(this.nwWindow, this)
			nativeMap.set(this.nwWindow.appWindow, this)
			nativeMap.set(this.nwWindow.window, this)
		} else if (this.window) {
			nativeMap.set(this.window, this)
		}

		// handle IDs
		this._createId()

		// TODO: maybe reintroduce subclassed ActiveWindows that does not do any magic in
		// constructor but takes care of self removal code like this.
		activeWindows.add(this)
		this.once('closed', () => activeWindows.delete(this))

		this._applyPlugins(this)
	}

	_instantiate() {
		// Electron and browser windows can be opened at any positing in any size.
		// NW.JS can't so we have to reposition it after it's opened
		if (platform.nwjs) {
			//if (options.x !== undefined || options.y !== undefined)
			//	this.nwWindow.moveTo(options.x, options.y)
		}
	}

	_detectArgument(arg) {
		this.local = this.remote = false
		if (typeof arg === 'string' || typeof arg === 'number') {
			if (platform.electron) {
				this.browserWindow = BrowserWindow.fromId(arg.toString())
				this.local = true
			} else {
				this.id = parseInt(arg)
				this.remote = true
			}
		} else {
			if (platform.nwjs) {
				if (isNWWindow(arg)) {
					// Default NWWindow instance created by NW.JS APIs.
					this.nwWindow = arg
				} else if (isAppWindow(arg)) {
					// Underlying Chrome's AppWindow API. Convert ti to NW.JS NWWindow.
					this.nwWindow = nw.Window.get(arg.contentWindow)
				} else if (isWindow(arg)) {
					// Default web's Window object. Convert ti to NW.JS NWWindow.
					this.nwWindow = nw.Window.get(arg)
				}
				// TODO: reintroduce this.window and this.document
				// needed to make title work.
				this.local = true
			} else if (platform.electron) {
				if (isBrowserWindow(arg)) {
					this.browserWindow = arg
				} else if (isWindow(arg)) {
					// Electron doesn't support window.opener nor any other properties linking to any other window.
					// Only accessible window object is the current one. Everything else is either inaccessible or BrowserWindowProxy.
					this.browserWindow = electron.remote.getCurrentWindow()
				}
				this.local = true
			} else if (isWindow(arg)) {
				// Use raw web window objects only in case of vanilla web (and PWAs) because we have nothing else to work
				// with. Duh. Also only use the the object for the window this code runs in. Other should be decoupled and
				// handled through IPC to prevent complications with taking hold of the window objects, passing messages
				// to each one. Plus there are the UWP limitations (that require injection).
				if (arg === window) {
					this.window = arg
					this.document = this.window.document
					this.local = true
				} else {
					this.id = parseInt(arg.name)
					this.remote = true
				}
			}
		}
	}


	///////////////////////////////////////////////////////////////////////////
	// IDENTITY
	///////////////////////////////////////////////////////////////////////////

	_createId() {
		if (this.id !== undefined) return
		this.id = 0
		if (platform.electron) {
			this.id = this.browserWindow.id
		} else if (this.nwWindow && this.nwWindow.appWindow.id) {
			this.id = parseInt(this.nwWindow.appWindow.id)
		} else if (this.window && platform.uwp) {
			this.id = MSApp.getViewId(this.window)
		} else if (this.window && this.window.name) {
			this.id = parseInt(this.window.name)
		} else {
			this.id = getRandomWindowId()
		}
		if (this.window)
			this.window.name = this.id
	}

	get title() {
		if (platform.uwp)
			return this.appView.title
		else if (platform.nwjs && this.document.title === '')
			return this.nwWindow.title
		else if (this.document)
			return this.document.title
	}
	set title(newTitle) {
		if (platform.uwp)
			this.appView.title = newTitle
		else if (this.document)
			this.document.title = newTitle
		// https://electronjs.org/docs/api/browser-window#event-page-title-updated
		this.emit('page-title-updated')
	}

	// WARNINGS:
	// - Chrome uses null, Edge uses undefined.
	// - NW.JS wraps main script (if used instead of main window) into empty HTML page.
	//   Therefore app's window.opener will link to that hidden window.
	// - Electron never sets window.opener, not even for child windows.
	// - UWP will not permit access (and throw) to window.sender & window.parent on remote window object.
	get isMainWindow() {
		if (platform.electron) {
			return this.id === 1
		} else if (this.window) {
			var opener = getWindowOpener(this.window)
			return opener === undefined || opener === null
		}
		return false
	}

	// TODO
	get isCurrentWindow() {
		return this.window === window
	}


	///////////////////////////////////////////////////////////////////////////
	// STATE
	///////////////////////////////////////////////////////////////////////////

	destroy() {
		this.destroyed = true
		this.removeAllListeners()
	}

	close() {
		// TODO
		if (this.browserWindow) {
			this.browserWindow.close()
		} else if (this.nwWindow) {
			this.nwWindow.close()
		} else if (this.window) {
			this.window.close()
			// TODO remove all DOM listeners too
		}
		this.once('close', () => this.destroy())
	}

})












registerPlugin(class AppWindows {

	pluginConstructor() {
		this.windows = activeWindows
		
		if (platform.hasWindow)
			this._updateWindows()
	}

	_updateWindows() {
		//console.log('ActiveWindows.update()')
		if (platform.hasWindow && platform.nwjs) {
			chrome.app.window.getAll()
				.map(appWindow => ManagedAppWindow.from(appWindow))
		} else if (platform.hasWindow && platform.electron) {
			electron.remote.BrowserWindow.getAllWindows()
				.map(browserWindow => ManagedAppWindow.from(browserWindow))
		} else if (this._wbcSend) {
			// Fallback to IPC. Broadcast my ID and list of IDs this window already tracks.
			// Ideally the windows that aren't on the list will introduce themselves.
			this._wbcSend({
				_windows: this.windows.map(w => w.id)
			})
		}
	}


	///////////////////////////////////////////////////////////////////////////
	// PROPERTIES
	///////////////////////////////////////////////////////////////////////////

	// instance of ManagedAppWindow of window object.
	get currentWindow() {
		if (platform.hasWindow) {
			return ManagedAppWindow.get()
		}
	}

	// instance of ManagedAppWindow of window.opener. Uses window.opener where available (except for UWP and Electron)
	get parentWindow() {
		if (platform.hasWindow) {
			var opener = getWindowOpener(window)
			// OMG UWP, why do you have to be like this? UWP won't give us openers name (id).
			if (!!opener && opener.name)
				return ManagedAppWindow.from(opener)
		}
	}

	//
	get mainWindow() {
		return this.windows.find(maw => maw.isMainWindow)
	}

	// instance of ManagedAppWindow() wrap around the initial first window opened
	get isMainWindow() {
		return !!this.currentWindow && this.currentWindow.isMainWindow
	}

	_getOrCreateMaw(arg) {
		return ManagedAppWindow.from(arg)
	}


	///////////////////////////////////////////////////////////////////////////
	// METHODS
	///////////////////////////////////////////////////////////////////////////

	// [url] string - url to open
	// [options] object - window size and position
	open(url, options) {
		// Handle arguments
		if (typeof url === 'object') {
			options = url
			url = options.url || 'index.html'
		}
		// Open the window
		var maw = this._openWindow(url, options)
		var e = {} // TODO: event
		this.emit('browser-window-created', e, maw) // shim for electron event
		// custom API, without the events
		this.emit('window-created', maw)
		return maw
	}

	// Opens new window using window.open or proprietary Electrons/NW.JS proprietary API.
	_openWindow(url, options) {
		url = sanitizeUrl(url)
		sanitizeWindowOptions(options)
		if (platform.electron) {
			var browserWindow = new BrowserWindow(options)
			if (url.includes('://'))
				browserWindow.loadURL(url)
			else
				browserWindow.loadFile(url)
			//resolve(browserWindow)
			return new ManagedAppWindow(browserWindow)
		} else {
			var id = getRandomWindowId()
			if (platform.nwjs) {
				// TODO. MOVE THIS TO CONSTUCTOR
				options.id = id.toString()
				nw.Window.open(url, options, nwWindow => {
					if (options.x !== undefined || options.y !== undefined)
						nwWindow.moveTo(options.x, options.y)
					// TODO. return nwWindow
					//resolve(nwWindow)
					return new ManagedAppWindow(nwWindow)
				})
			} else if (platform.hasWindow) {
				try {
					var optionsString = stringifyWindowOptions(options)
					// WARNING: In UWP child window cannot open another one (3rd level deep). It throws as of spring 2018 update.
					//          What works is trying to open it from parent window that can be accessed from window.opener.
					var webWindow = window
					if (platform.uwp && !!window.opener)
						webWindow = window.opener
					// Let's get the party started.
					var newWindow = webWindow.open(url, id.toString(), optionsString)
					//resolve(newWindow)
					return new ManagedAppWindow(newWindow)
				} catch(err) {
					// Swallow the error and don't open the window.
				}
			}
		}
	}

})








function sanitizeWindowOptions(options) {
	if (options.electron) {
		options.alwaysOnTop = options.always_on_top
		options.skipTaskbar = !options.show_in_taskbar
	} else if (options.nwjs) {
		options.always_on_top = options.alwaysOnTop
		options.show_in_taskbar = !options.skipTaskbar
		options.min_width  = options.minWidth
		options.min_height = options.minHeight
		options.max_width  = options.maxWidth
		options.max_height = options.maxHeight
	}
}

function stringifyWindowOptions(options) {
	if (!options) return
	return `width=${options.width},height=${options.height},left=${options.x},top=${options.y}`
		+ ',directories=no,titlebar=no,toolbar=no,location=no,status=no,menubar=no'
}
