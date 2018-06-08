import platform from 'platform-detect'
import {EventEmitter} from './EventEmitter.mjs'


// TODO: change emit to local emit

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


if (platform.uwp) {
	var {ApplicationView} = Windows.UI.ViewManagement
}
if (platform.electron) {
	var electron = global.require('electron')
	if (platform.hasWindow)
		var BrowserWindow = electron.remote.BrowserWindow
	else
		var BrowserWindow = electron.BrowserWindow
	// https://github.com/electron/electron/issues/3778#issuecomment-164135757
	if (platform.hasWindow)
		electron.remote.getCurrentWindow().removeAllListeners()
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
		|| object.constructor.name === 'NWWindow' && typeof object.setAlwaysOnTop === 'function'
}
function isBrowserWindow(object) {
	return object instanceof BrowserWindow
		|| object.constructor.name === 'BrowserWindow' && typeof object.setAlwaysOnTop === 'function'
}
function isWindow(object) {
	return object instanceof Window
		|| object.constructor.name === 'Window' && 'HTMLElement' in object
}

function getWindowOpener(win) {
	if (platform.nwjs)
		return window.opener && window.opener.opener
	else
		return window.opener
}

function getRandomWindowId() {
	return parseInt(Date.now().toString().slice(-4))
	//return Math.floor(Math.random() * 10000)
}


class OrderedSet extends Array {
	add(item) {
		if (this.includes(item)) return
		this.push(item)
		//this.emit('TODO') // TODO
	}
	delete(item) {
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


var BC_IPC = 'iso-app-ipc'
var BC_WIN = 'iso-app-win'
var bcIpc = new BroadcastChannel(BC_IPC) // todo deleteme
var bcWin // todo deleteme
var activeWindows = new OrderedSet() // todo deleteme ?
var nativeMap = new Map()


// TODO
//if (platform.electron)
//	var MyAppWindowSuperClass = BrowserWindow
//else
	var MyAppWindowSuperClass = EventEmitter

class MyAppWindow extends MyAppWindowSuperClass {

	// Gets MyAppWindow instance for current window.
	static get() {
		if (platform.nwjs)
			return this.from(nw.Window.get())
		else if (platform.electron)
			return this.from(electron.remote.getCurrentWindow())
		else
			return this.from(window)
	}
	
	// Resolves Window, NwWindow, BrowserWindow, AppWindow objects and string ID into MyAppWindow instance.
	static from(arg) {
		if (typeof arg === 'string' || typeof arg === 'number') {
			var id = parseInt(arg)
			var appwin = activeWindows.find(appwin => appwin.id === id)
			return appwin || new this(arg)
		} else {
			return nativeMap.get(arg) || new this(arg)
		}
	}

	constructor(arg) {
		super()
		//console.log('new MyAppWindow() constructor', arg)
		this.setup(arg)
	}

	async setup(arg) {
		if (typeof arg === 'string' || typeof arg === 'number') {
			if (platform.electron) {
				this.browserWindow = BrowserWindow.fromId(arg.toString())
				this.setupLocal()
			} else {
				this.setupRemote(arg)
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
			} else if (platform.electron) {
				if (isBrowserWindow(arg)) {
					this.browserWindow = arg
				} else if (isWindow(arg)) {
					// Electron doesn't support window.opener nor any other properties linking to any other window.
					// Only accessible window object is the current one. Everything else is either inaccessible or BrowserWindowProxy.
					this.browserWindow = electron.remote.getCurrentWindow()
				}
			} else if (isWindow(arg)) {
				// Only in case of vanilla web (or PWAs) use raw window. Because we have nothing else to work with, duh.
				this.window = arg
				this.document = this.window.document
			}
			this.setupLocal()
		}

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

		// TODO: maybe reintroduce subclassed ActiveWindows that does not do any magic in
		// constructor but takes care of self removal code like this.
		activeWindows.add(this)
		this.once('closed', () => {
			console.log('this closed', this.id)
			activeWindows.delete(this)
		})
		/*
		this.on('minimize', e => this.minimized = true)
		this.on('maximize', e => this.maximized = true)

		this.on('restore', e => {
			if (this.minimized)
				this.minimized = false
			else if (this.maximized)
				this.maximized = false
		})
*/
		// handle IDs
		this._setupId()

		this.isMain = false // todo: move
		this.isMainProcess = false // todo: move
	}

	instantiate() {
		// Electron and browser windows can be opened at any positing in any size.
		// NW.JS can't so we have to reposition it after it's opened
		if (platform.nwjs) {
			//if (options.x !== undefined || options.y !== undefined)
			//	this.nwWindow.moveTo(options.x, options.y)
		}
	}

	setupLocal() {	
		if (this.window) {
			this.window.addEventListener('focus', e => this.emit('focus'))
			this.window.addEventListener('blur',  e => this.emit('blur'))
			this._onVisibilityChange = this._onVisibilityChange.bind(this)
			this.document.addEventListener('visibilitychange', this._onVisibilityChange)
			this._onResize = this._onResize.bind(this)
			this.window.addEventListener('resize', this._onResize, {passive: true})
			// https://electronjs.org/docs/api/browser-window#event-close
			// https://electronjs.org/docs/api/browser-window#event-closed
			this.window.addEventListener('beforeunload', e => this.emit('close', e))
			this.window.addEventListener('unload', e => this.emit('closed', e))
			// Kickstart it with default values.
			this.focused = true
			this.visible = !this.document.hidden // rough estimate
			this.minimized = this.document.hidden // rough estimate
			this.maximized = this._isMaximized()
			this.fullscreen = false // can we get initial value?
		}

		this._exposeEventStates()	
	}

	// Whether the window is focused.
	// Shortcut for .isFocused()	
	focused = undefined

	// is true all the time, no matter if the window is minimized or not.
	// is false when the window is explicitly hidden with .hide().
	// Shortcut for .isVisible()	
	visible = undefined

	// Whether the window is minimized.
	// Shortcut for .isMinimized()	
	minimized = undefined

	// Whether the window is maximized.
	// Shortcut for .isMaximized()
	maximized = undefined

	// Whether the window is in fullscreen mode.
	// Shortcut for .isFullScreen()
	fullscreen = undefined

	_exposeEventStates() {
		// https://electronjs.org/docs/api/browser-window#event-blur
		// https://electronjs.org/docs/api/browser-window#event-focus
		this.on('blur',  e => this.focused = false)
		this.on('focus', e => this.focused = true)
		// https://electronjs.org/docs/api/browser-window#event-show
		// https://electronjs.org/docs/api/browser-window#event-hide
		this.on('show', e => this.visible = true)
		this.on('hide', e => this.visible = false)
		// https://electronjs.org/docs/api/browser-window#event-maximize
		// https://electronjs.org/docs/api/browser-window#event-unmaximize
		this.on('maximize',   e => this.maximized = true)
		this.on('unmaximize', e => this.maximized = false)
		// https://electronjs.org/docs/api/browser-window#event-minimize
		// https://electronjs.org/docs/api/browser-window#event-restore
		this.on('minimize', e => this.minimized = true)
		this.on('restore',  e => this.minimized = false)
		// https://electronjs.org/docs/api/browser-window#event-enter-full-screen
		// https://electronjs.org/docs/api/browser-window#event-leave-full-screen
		this.on('enter-full-screen', e => this.fullscreen)
		this.on('leave-full-screen', e => this.fullscreen)
	}

	///////////////////////////////////////////////////////////////////////////
	// WINDOW STATE HANDLERS
	///////////////////////////////////////////////////////////////////////////


	// https://electronjs.org/docs/api/browser-window#event-minimize
	// https://electronjs.org/docs/api/browser-window#event-restore
	_onVisibilityChange() {
		// NOTE: Browser's document.hidden is false when the browser is minimized.
		if (this.document.hidden && !this.minimized)
			this.emit('minimize')
		else if (!this.document.hidden && this.minimized)
			this.emit('restore')
	}

	// NOTE: solely based on window object which is quirky at best. Do not use if there's better API available in NW.JS or Electron.
	_isMaximized() {
		var adjustment = platform.edge ? 16 : 0
		return (this.window.outerWidth - adjustment === this.window.screen.availWidth)
			&& (this.window.outerHeight - adjustment === this.window.screen.availHeight)
		//var docEl = document.documentElement
		//console.log(window.outerWidth, window.outerWidth - 16, screen.width, window.innerWidth, docEl.clientWidth, screen.availWidth)
		//console.log(window.outerHeight, window.outerHeight - 16, screen.height, window.innerHeight, docEl.clientHeight, screen.availHeight)
		//console.log('window.screenX', window.screenX)
		//console.log('window.screenY', window.screenY)
	}

	_onResize() {
		var maximized = this._isMaximized()
		if (maximized && !this.maximized)
			this.emit('maximize')
		else if (!maximized && this.maximized)
			this.emit('unmaximize')
	}






	// string or number
	setupRemote(id) {
		this.id = parseInt(id)
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
		} else {
			var opener = getWindowOpener(this.window)
			return opener === undefined || opener === null
		}
	}

	///////////////////////////////////////////////////////////////////////////
	// IDENTITY
	///////////////////////////////////////////////////////////////////////////

	_setupId() {
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
	}

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

	// Proprietary alias for .setSize()
	resize(width, height) {
		this.setSize(width, height)
	}

	get minWidth() {} // TODO
	set minWidth(newValue) {} // TODO

	get minHeight() {} // TODO
	set minHeight(newValue) {} // TODO


	close() {
		// TODO
		this.removeAllListeners()
		// TODO remove all DOM listeners too
	}

}


window.MyAppWindow = MyAppWindow // todo delete





class BrowserWindowAdditionalPolyfill {

	///////////////////////////////////////////////////////////////////////////
	// STATE
	///////////////////////////////////////////////////////////////////////////

	destroy() {
	}

	close() {
		if (this.nwWindow) this.nwWindow.close()
	}


	///////////////////////////////////////////////////////////////////////////
	// VISIBILITY
	///////////////////////////////////////////////////////////////////////////

	// https://electronjs.org/docs/api/browser-window#winisfocused
	isFocused() {return this.focused}

	// True all the times except when .hide() is called.
	// https://electronjs.org/docs/api/browser-window#winisvisible
	isVisible() {return this.visible}

	// https://electronjs.org/docs/api/browser-window#winismaximized
	isMaximized() {return this.maximized}

	// https://electronjs.org/docs/api/browser-window#winisminimized
	isMinimized() {return this.minimized}

	// https://electronjs.org/docs/api/browser-window#winisfullscreen
	isFullScreen() {return this.fullscreen}

	// https://electronjs.org/docs/api/browser-window#winisresizable
	isResizeable() {}

	focus() {
	}

	blur() {
	}

	show() {
		if (this.nwWindow) this.nwWindow.show()
	}

	hide() {
		if (this.nwWindow) this.nwWindow.hide()
	}

	maximize() {
		if (this.nwWindow) this.nwWindow.maximize()
	}

	unmaximize() {
		if (this.nwWindow) this.nwWindow.unmaximize()
	}

	minimize() {
		if (this.nwWindow) this.nwWindow.minimize()
	}

	restore() {
		if (this.nwWindow) this.nwWindow.restore()
	}

	setFullScreen(flag) {
	}


	///////////////////////////////////////////////////////////////////////////
	// POSITION & SIZE
	///////////////////////////////////////////////////////////////////////////

	// https://electronjs.org/docs/api/browser-window#winsetsizewidth-height
	setSize(width, height) {
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

	// https://electronjs.org/docs/api/browser-window#wingetsize
	getSize() {
		return [this.width, this.height]
	}

	// https://electronjs.org/docs/api/browser-window#winsetminimumsizewidth-height
	setMinimumSize(width, height) {
		// TODO
		if (platform.uwp)
			appView.setPreferredMinSize({width, height})
	}

	// https://electronjs.org/docs/api/browser-window#wingetminimumsize
	getMinimumSize() {
	}

	// https://electronjs.org/docs/api/browser-window#winsetmaximumsizewidth-height
	setMaximumSize(width, height) {
		// TODO
		if (platform.uwp)
			appView.setPreferredMaxSize({width, height}) // is this a thing?
	}

	// https://electronjs.org/docs/api/browser-window#wingetmaximumsize
	getMaximumSize() {
	}

}

Object.getOwnPropertyNames(BrowserWindowAdditionalPolyfill.prototype)
	.filter(name => name !== 'constructor')
	.forEach(name => {
		if (!MyAppWindow.prototype[name])
			MyAppWindow.prototype[name] = BrowserWindowAdditionalPolyfill.prototype[name]
	})














export default class MyAppWindowExtension {

	setup() {
		//console.log('MyAppWindowExtension.setup()')
		activeWindows = new OrderedSet
		this.windows = activeWindows
		
		if (platform.hasWindow) {
			this.currentWindow = MyAppWindow.get()
			// NOTE: Can't directly go after window.opener due to NW.JS
			var opener = getWindowOpener(window)
			if (!!opener)
				this.parentWindow = MyAppWindow.from(opener) // todo reenable, throws in NWJS
		}
		
		if (platform.hasWindow) {
			this._updateWindows()
		}

		// TODO: some advanced logic to detect if and when to open broadcast channel
		// why? we don't want unnecessary event emitting if the app only ever uses single window and no
		// background process (most UWP and NW.JS* apps).
		// Do not open BC if this is the main window (and somehow detect if there's a background process running, if so, open BC)
		// Open BC if this window was opened by something else
		// Open BC if this window is opening a new one (and BC isn't yet open)
		// IMPORTANT: we also need to open BC to probe surrounding when window starts (reloads)
		//this.openBroadcastChannel() // TODO

	}

	_updateWindows() {
		//console.log('ActiveWindows.update()')
		if (!platform.hasWindow) return
		if (platform.nwjs) {
			chrome.app.window.getAll()
				.map(appWindow => MyAppWindow.from(appWindow))
				//.forEach(appwin => activeWindows.add(appwin))
		} else if (platform.electron) {
			electron.remote.BrowserWindow.getAllWindows()
				.map(browserWindow => MyAppWindow.from(browserWindow))
				//.forEach(appwin => activeWindows.add(appwin))
		}
	}

	openBroadcastChannel() {
		console.log('openBroadcastChannel()', this.id)
		window.bcWin = bcWin = new BroadcastChannel(BC_WIN)
		bcIpc.onmessage = e => log('IPC Received', e.data)
		bcWin.onmessage = e => log('WIN received', e.data)
		var oldEmit = this.currentWindow.emit
		/*this.currentWindow.emit = (event, ...args) => {
			this.sendWin(event, ...args)
			oldEmit.call(this.currentWindow, event, ...args)
		}*/
		console.log('sending ipc')
		this.sendIpc(`Hai, I'm alive ${this.currentWindow.id}`)
		this.sendWin('ready')
	}
	
	sendIpc(name, data) {
		var from = this.currentWindow.id
		var obj = {
			isoAppMsg: {name, data, from}
		}
		bcIpc.postMessage(obj)
	}
	sendWin(name, data) {
		var id
		bcWin.postMessage({id, name, data})
	}


	///////////////////////////////////////////////////////////////////////////
	// PROPERTIES
	///////////////////////////////////////////////////////////////////////////

	//
	get mainWindow() {
		return this.windows.find(win => win.isMainWindow)
	}

	// instance of MyAppWindow(window.opener). Uses window.opener where available (except for UWP and Electron)
	parentWindow = undefined // todo

	//
	mainWindow = undefined // todo

	// instance of MyAppWindow() wrap around the initial first window opened
	get isMainWindow() {
		return this.currentWindow.isMainWindow
	}

	_createWindow(url, options) {
		console.log('_createWindow', url, options)
		url = sanitizeUrl(url)
		sanitizeWindowOptions(options)
		if (platform.electron) {
			var browserWindow = new BrowserWindow(options)
			browserWindow.loadURL(url)
			//resolve(browserWindow)
			return new MyAppWindow(browserWindow)
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
					return new MyAppWindow(nwWindow)
				})
			} else {
				var optionsString = stringifyWindowOptions(options)
				var newWindow = window.open(url, id.toString(), optionsString)
				//resolve(newWindow)
				return new MyAppWindow(newWindow)
			}
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

	// TODO: this may need to be moved elsewhere
	tabletMode = undefined

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