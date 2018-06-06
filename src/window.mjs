import platform from 'platform-detect'
import {EventEmitter} from './EventEmitter.mjs'


// plot twists
// ELECTRON
// - if we inherit electrons BrowserWindow, how to make classes for existing BrowserWindow instances?
// - we can access all open BrowserWindow instances with BrowserWindow.getAllWindows()
// - we can access current BrowserWindow with remote.getCurrentWindow()
// UWP
// - how to access nested window objects if it throws

// A bit of internal docs.
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

platform.hasWindow = platform.window // TODO delete

if (platform.uwp) {
	var {ApplicationView} = Windows.UI.ViewManagement
}
if (platform.electron) {
	var electron = global.require('electron')
	if (platform.hasWindow)
		var BrowserWindow = electron.remote.BrowserWindow
	else
		var BrowserWindow = electron.BrowserWindow
}
if (platform.nwjs) {
	var AppWindow = chrome.app.window.getAll()[0].constructor
	var NWWindow = nw.Window.get().constructor
}

// Safe functions for detection of object type across mixed contexts (mainly in NW.JS)
// Tried to use local context's classes and falls back to general object shape detection.
function isAppWindow(object) {
	return object instanceof AppWindow
		|| object.constructor.name === 'AppWindow' && !!object.innerBounds && !!object.setAlwaysOnTop
}
function isNWWindow(object) {
	return object instanceof NWWindow
		|| object.constructor.name === 'NWWindow'
}
function isWindow(object) {
	return object instanceof Window
		|| object.constructor.name === 'Window' && 'HTMLElement' in object
}

// TODO: change emit to local emit

// TODO
//if (platform.electron)
//	var MyAppWindowSuperClass = BrowserWindow
//else
	var MyAppWindowSuperClass = EventEmitter

//static activeWindows = []
var activeWindows// = new ActiveWindows
// experimental, deleteme if needed
var nativeMap = new Map

class MyAppWindow extends MyAppWindowSuperClass {

	static get() {
		if (platform.nwjs)
			return this.from(nw.Window.get())
		else if (platform.electron)
			return this.from(electron.remote.getCurrentWindow())
		//else if (platform.uwp)
		//	return this.from(ApplicationView.getForCurrentView())
		else
			return this.from(window)
	}

	static from(arg) {
		//console.log('FROM', arg, nativeMap.has(arg), nativeMap)
		if (platform.nwjs) {
			// In NW.JS the arg might be NWWindow or Chrome's AppWIndow, use raw window object instead.
			if (isNWWindow(arg))
				arg = arg.window
			else if (isAppWindow(arg))
				arg = arg.contentWindow
		}
		if (nativeMap.has(arg))
			return nativeMap.get(arg)
		else
			return new this(arg)
	}

	constructor(arg) {
		console.log('new MyAppWindow() constructor')
		super()

		if (platform.nwjs) {
			if (isAppWindow(arg))
				arg = arg.contentWindow
			if (isNWWindow(arg)) {
				this.nwWindow = arg
				this.window = this.nwWindow.window
			} else if (isWindow(arg)) {
				this.window = arg
				this.nwWindow = nw.Window.get(this.window)
			}
		} else if (platform.electron) {
			this.browserWindow = arg
		//} else if (platform.uwp && arg instanceof ApplicationView) {
		//	this.appView = arg
		} else {
			this.window = arg
		}

		// TODO: in NWJS child windows are restrictied, ty to get the real window through injection

		// experimental, deleteme if needed
		nativeMap.set(this.window || this.browserWindow, this)
		//activeWindows.add(this)
		//setTimeout(() => {
			console.log('adding', activeWindows)
			activeWindows.add(this)
			console.log('added', activeWindows)
			console.log('activeWindows.length', activeWindows.length)
			try {
				console.log('window.app.windows.length', window.app.windows.length)
				setTimeout(() => {
					console.log('activeWindows.length', activeWindows.length)
					console.log('window.app.windows.length', window.app.windows.length)
				})
				setTimeout(() => {
					console.log('activeWindows.length', activeWindows.length)
					console.log('window.app.windows.length', window.app.windows.length)
				}, 500)
			} catch(err) {}
		//})
		this.once('closed', () => {
			console.log('this closed', this.id, this)
			activeWindows.delete(this)
		}) // TODO: reenable

		// handle IDs
		if (platform.electron) {
			this.id = this.browserWindow.id
		} else if (platform.uwp) {
			this.id = MSApp.getViewId(this.window)
		} else {
			// Retrieve previous id (of the same window) after reload.
			// window.name persists reload and doesn't spill to child windows
			console.log('CREATING or GETTING id', this.window.name)
			if (this.window.name) {
				this.id = parseInt(this.window.name)
			} else {
				var lastId = sessionStorage.lastWindowId ? parseInt(sessionStorage.lastWindowId) : 0
				this.id = lastId + 1
				this.window.name = this.id
				sessionStorage.lastWindowId = this.id
			}
		}

		this.isMain = false // todo: move
		this.isMainProcess = false // todo: move

		// Electron and browser windows can be opened at any positing in any size.
		// NW.JS can't so we have to reposition it after it's opened
		if (platform.nwjs) {
			//if (options.x !== undefined || options.y !== undefined)
			//	this.nwWindow.moveTo(options.x, options.y)
		}

		if (this.window) {
			this.window.addEventListener('load', e => {
				// https://electronjs.org/docs/api/browser-window#event-close
				this.window.addEventListener('beforeunload', e => this.emit('close', e))
				// https://electronjs.org/docs/api/browser-window#event-closed
				this.window.addEventListener('unload', e => this.emit('closed', e))
			})
		}

		if (platform.electron || (platform.uwp && this.isMainWindow)) {
			// We cannot listen on the remote objects. Fallback to reliance on their IPC feedback.
		} else {
			// We can access the remote window & document objects and listen on them directly.
			//this.window.addEventListener('focus', e => console.log('focus'))
			//this.window.addEventListener('blur', e => console.log('blur'))
		}

/*
		if (platform.nwjs) {
			this.nwWindow.on('minimize', e => this.minimized = true)
			this.nwWindow.on('maximize', e => this.maximized = true)
			this.nwWindow.on('restore', e => {
				if (this.minimized)
					this.minimized = false
				else if (this.maximized)
					this.maximized = false
			})
		}

		if (this.canDetectWindowState) {
			this._onNativeFocus = this._onNativeFocus.bind(this)
			this._onNativeBlur = this._onNativeBlur.bind(this)
			this._onNativeVisibilityChange = this._onNativeVisibilityChange.bind(this)
			window.addEventListener('focus', this._onNativeFocus)
			window.addEventListener('blur', this._onNativeBlur)
			document.addEventListener('visibilitychange', this._onNativeVisibilityChange)
			//document.addEventListener('resize', this.onResize, {passive: true})
			this._onNativeFocus()
			this._onNativeVisibilityChange()
		}
*/
	}

	// WARNINGS:
	// - Chrome uses null, Edge uses undefined.
	// - NW.JS wraps main script (if used instead of main window) into empty HTML page.
	//   Therefore app's window.opener will link to that hidden window.
	// - Electron never sets window.opener, not even for child windows.
	// - UWP will not permit access (and throw) to window.sender & window.parent on remote window object.
	get isMainWindow() {
		try {
			if (platform.electron) {
				return this.id === 1
			} else {
				var opener = this.window.opener
				if (platform.nwjs)
					opener = this.window.opener && this.window.opener.opener
				return opener === undefined || opener === null
			}
		} catch(err) {
			return false
		}
	}

	///////////////////////////////////////////////////////////////////////////
	// POSITION & SIZE
	///////////////////////////////////////////////////////////////////////////

	get x() {
		if (platform.nwjs)
			return this.nwWindow.x
	}
	set x(newValue) {
		if (platform.nwjs)
			this.nwWindow.x = newValue
	}

	get y() {
		if (platform.nwjs)
			return this.nwWindow.y
	}
	set y(newValue) {
		if (platform.nwjs)
			this.nwWindow.y = newValue
	}

	get width() {
		if (platform.nwjs)
			return this.nwWindow.width
		// TODO
	}
	set width(newValue) {
		if (platform.nwjs)
			this.nwWindow.width = newValue
	}

	get height() {
		if (platform.nwjs)
			return this.nwWindow.height
		// TODO
	}
	set height(newValue) {
		if (platform.nwjs)
			this.nwWindow.height = newValue
	}

	resize(width, height) {
		if (platform.uwp) {
			this.appView.tryResizeView({width, height}) // it can fail
		} else {
			this.width = width
			this.height = height
		}
		/*
		//appView.setDesiredBoundsMode(Windows.UI.ViewManagement.ApplicationViewBoundsMode.useCoreWindow);

		// If you want to resize the app’s window size you can try to use:
		//appView.tryResizeView({ width: 600, height: 600 });

		//Besides, if you want to resize it when the application launched, try to use this code:
		ApplicationView.preferredLaunchViewSize = { width: 500, height: 500 };
		ApplicationView.preferredLaunchWindowingMode = Windows.UI.ViewManagement.ApplicationViewWindowingMode.preferredLaunchViewSize;
		*/
	}

	get minWidth() {} // TODO
	set minWidth(newValue) {} // TODO

	get minHeight() {} // TODO
	set minHeight(newValue) {} // TODO

	setMinimumSize(width, height) {
		// TODO
		if (platform.uwp)
			appView.setPreferredMinSize({width, height})
	}
	getMinimumSize() {
	}

	setMaximumSize(width, height) {
		// TODO
		if (platform.uwp)
			appView.setPreferredMaxSize({width, height}) // is this a thing?
	}
	getMaximumSize() {
	}

}


window.MyAppWindow = MyAppWindow // todo delete













class OrderedSet extends Array {
	add(item) {
		if (this.includes(item)) return
		this.push(item)
		//this.emit('TODO') // TODO
	}
	delete(item) {
		console.log('delete', item)
		var index = this.indexOf(item)
		if (index === -1) return
		this.splice(index, 1)
		//this.emit('TODO') // TODO
	}
	// Overriding builting methods to prevent further subclassing.
	filter(callback) {
		return [...this].filter(callback)
	}
	map(callback) {
		return [...this].map(callback)
	}
}

var winKeyEcho = 'iso-app-echo'
var winKeyScan = 'iso-app-scan'
class ActiveWindows extends OrderedSet {
	constructor() {
		super()
		console.log('new ActiveWindows()')
		if (platform.hasWindow) {
			this.useStorageEvents = false
			//this.useStorageEvents = !platform.nwjs && !platform.electron
			//this.update()
			//setTimeout(() => this.update())
			if (this.useStorageEvents) {
				window.addEventListener('storage', e => this.onStorageEvent(e))
				// announce self to other existing windows
				var windowId = 42
				var currentlyOpened = 1
				localStorage.setItem(winKeyEcho, [windowId, currentlyOpened, Math.random()].join('|'))
			}
		}
	}
	update() {
		//console.log('ActiveWindows.update()')
		if (!platform.hasWindow) return
		if (platform.nwjs) {
			chrome.app.window.getAll()
				.map(appWindow => MyAppWindow.from(appWindow))
				.forEach(win => this.add(win))
		} else if (platform.electron) {
			electron.remote.BrowserWindow.getAllWindows()
				.map(browserWindow => MyAppWindow.from(browserWindow))
				.forEach(win => this.add(win))
		} else if (this.useStorageEvents) {
			localStorage.setItem(winKeyScan, Math.random())
		}
	}
	inject(remoteWindow) {
		//console.log('ActiveWindows.inject()')
		// TODO
	}
	traverse() {
		this.forEach(win => {
			var nativeWindow = win.window
			while (!!nativeWindow) {
				var newWin = MyAppWindow.from(nativeWindow)
				console.log('found', newWin)
				nativeWindow = nativeWindow.opener
			}
		})
	}
	onStorageEvent(e) {
		console.log('ActiveWindows.onStorageEvent()')
		if (e.key !== winKeyEcho) return
		let [windowId, currentlyOpened] = e.newValue.split('|').map(Number)
		//var win = MyAppWindow.from(e.target)
		//console.log('announcement from', windowId, currentlyOpened, win)
		console.log('announcement')
		this.update()
	}
}















export default class MyAppWindowExtension {

	setup() {
		console.log('MyAppWindowExtension.setup()')
		activeWindows = new ActiveWindows
		activeWindows.update()
		this.windows = activeWindows
		//this.windows = []

		if (platform.hasWindow) {
			//if (!!window.opener)
			//	MyAppWindow.from(window.opener) // todo reenable, throws in NWJS
			this.currentWindow = MyAppWindow.get()
			//this.mainWindow = MyAppWindow.get()
			//this.windows.push(this.mainWindow) // todo. reenable if needed
		}
	}


	///////////////////////////////////////////////////////////////////////////
	// PROPERTIES
	///////////////////////////////////////////////////////////////////////////

	// instance of MyAppWindow() wrap around the initial first window opened
	get isMainWindow() {
		return false
		//return this.currentWindow.isMainWindow
	}

	// instance of MyAppWindow(window.opener). Uses window.opener where available (except for UWP and Electron)
	parentWindow = undefined

	//get mainWindow() {
	//	return this.windows[0]
	//}
	//get currentWindow() {
	//	// TODO
	//	return this.windows[0]
	//}

	get title() {
		if (platform.uwp)
			return this.appView.title
		else if (document.title === '' && platform.nwjs)
			return this.nwWindow.title
		else
			return document.title
	}
	set title(newTitle) {
		if (platform.uwp)
			this.appView.title = newTitle
		else
			document.title = newTitle
		// https://electronjs.org/docs/api/browser-window#event-page-title-updated
		this.emit('page-title-updated')
	}

	//get id() {
	//	if (platform.uwp)
	//		return this.appView.id
	//}



	///////////////////////////////////////////////////////////////////////////
	// STATE & VISIBILITY
	///////////////////////////////////////////////////////////////////////////

	_createWindow(url, options) {
		console.log('_createWindow', url, options)
		url = sanitizeUrl(url)
		sanitizeWindowOptions(options)
		if (platform.electron) {
			var browserWindow = new BrowserWindow(options)
			browserWindow.loadURL(url)
			//resolve(browserWindow)
			return new MyAppWindow(browserWindow)
		} else if (platform.nwjs) {
			// TODO. MOVE THIS TO CONSTUCTOR
			nw.Window.open(url, options, nwWindow => {
				console.log('nwWindow', nwWindow)
				if (options.x !== undefined || options.y !== undefined)
					nwWindow.moveTo(options.x, options.y)
				// TODO. return nwWindow
				//resolve(nwWindow)
				return new MyAppWindow(nwWindow)
			})
		} else {
			var optionsString = stringifyWindowOptions(options)
			var id = this.currentWindow.id + 1 // TODO
			var win = window.open(url, id, optionsString)
			// todo: experimental, delete if needed
			win.addEventListener('load', e => {
				var remoteApp = win['iso-app']
				if (remoteApp)
					remoteApp.windows.inject(window)
			})
			//resolve(win)
			return new MyAppWindow(win)
		}
	}

	// [url] string - url to open
	// [options] object - window size and position
	async open(url, options) {
		// Handle arguments
		if (typeof url === 'object') {
			options = url
			url = options.url || 'index.html'
		}
		// Open the window
		var win = this._createWindow(url, options)
		return win
	}

	// Closes and kills app's (main) window
	close(id) {
		if (id !== undefined) {
		} else {
			// TODO: close given id
			if (platform.nwjs) this.nwWindow.close()
		}
	}

	// Shows the app's window and adds it to taskbar
	show() {
		if (platform.nwjs) this.nwWindow.show()
	}

	// Hides the app's window and removes it from taskbar
	hide() {
		if (platform.nwjs) this.nwWindow.hide()
	}

	focus() {
		// TODO
	}

	blur() {
		// TODO. is this even possible?
	}

	// Describes wheter app window is selected; active; is being interacted with; pressing keys would affect it.
	focused = undefined
	//document.hasFocus()

	// Opposide of focused. Is true when the window is not in focus and interacted with. Winow might or might not be visible.
	get blurred() {return !this.focused}
	set blurred(newValue) {this.focused = !newValue}
	
	// Describes wheter app window (or browser window) can be seen on display
	// If true  the app window is opened and visible
	// If false the app window is opened but cannot be seen, most likely minimized
	// Is affected by window visibility manipulation, minimizing or restoring, .hide() and .show()
	visible = undefined

	// Describes wheter app window exists (regardless of visibility)
	// If true  the app window is opened and visible
	// If false the app window is not opened and is not in taskbar, most likely running in tray
	// Is only affected by .hide() and .show()
	get shown() {return !this.hidden}
	set shown(newValue) {this.hidden = !newValue}

	// Describes wheter app window exists (regardless of visibility)
	// If true  the app window is not opened and is not in taskbar, most likely running in tray
	// If false the app window is opened and visible
	// Is only affected by .hide() and .show()
	hidden = undefined




	minimize() {
		if (platform.nwjs) this.nwWindow.minimize()
	}

	maximize() {
		if (platform.nwjs) this.nwWindow.maximize()
	}

	// (in some environments) alias for restore
	unmaximize() {
		if (platform.nwjs) this.nwWindow.unmaximize()
	}

	// (in some environments) alias for unmaximize
	restore() {
		if (platform.nwjs) this.nwWindow.restore()
	}



	get minimized() {return !!this._minimized}
	set minimized(newValue) {
		if (newValue && !this._minimized)
			this.emit('minimize')
		else if (!newValue && this._minimized)
			this.emit('unminimize')
		this._minimized = newValue
	}

	get maximized() {return !!this._maximized}
	set maximized(newValue) {
		if (newValue && !this._maximized)
			this.emit('maximize')
		else if (!newValue && this._maximized)
			this.emit('unmaximize')
		this._maximized = newValue
	}

	get fullscreen() {return !!this._fullscreen}
	set fullscreen(newValue) {
		this._fullscreen = newValue
		this.emit(newValue ? 'TODO' : 'unTODO')
	}

	// TODO: this may need to be moved elsewhere
	tabletMode = undefined



	///////////////////////////////////////////////////////////////////////////
	// WINDOW STATE HANDLERS
	///////////////////////////////////////////////////////////////////////////

	_onNativeFocus() {
		this.focused = true
		this.scheduleVisibilityUpdate()
		this.emit('focus')
	}

	_onNativeBlur() {
		this.focused = false
		this.scheduleVisibilityUpdate()
		this.emit('blur')
	}

	//onResize() {
	//	console.log(
	//		window.outerWidth, screen.width, document.documentElement.clientWidth,
	//		window.outerHeight, screen.height, document.documentElement.clientHeight
	//	)
	//}

	_onNativeVisibilityChange() {
		// Note: browser's document.hidden is basically false if the browser is minimized
		if (document.hidden) {
			this.visibility = false
			this.minimized = true
		} else {
			this.visibility = true
			this.minimized = false
		}
		this.scheduleVisibilityUpdate()
	}

	scheduleVisibilityUpdate() {
		clearTimeout(this.visibilityUpdateTimeout)
		this.visibilityUpdateTimeout = setTimeout(this.updateVisibility, 50)
	}

}











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

function sanitizeUrl(url) {
	if (!url) return url
	if (!url.includes('://')) {
		if (platform.uwp)
			return `ms-appx:///${url}`
		else if (platform.electron)
			return `file://${__dirname}/${url}`
	}
	return url
}

function remove(array, item) {
	var index = array.indexOf(item)
	if (index !== -1)
		array.splice(index, 1)
}