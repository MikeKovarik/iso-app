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
function isBrowserWindowProxy(object) {
	return object.constructor.name === 'BrowserWindowProxy'
		&& !!object.postMessage && !!object.focus && !!object.blur && !!object.close
}
function isWindow(object) {
	return object instanceof Window
		|| object.constructor.name === 'Window' && 'HTMLElement' in object
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
		//console.log('FROM', arg, nativeMap.has(arg), nativeMap)
		if (platform.nwjs) {
			// In NW.JS the arg might be NWWindow or Chrome's AppWIndow, use raw window object instead.
			if (isNWWindow(arg))
				arg = arg.window
			else if (isAppWindow(arg))
				arg = arg.contentWindow
		}
		if (platform.electron) {
			// TODO: this should handle both BrowserWindow and Window.
		}
		if (nativeMap.has(arg))
			return nativeMap.get(arg)
		else
			return new this(arg)
	}

	constructor(arg) {
		//console.log('new MyAppWindow() constructor')
		super()
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
				if (isNWWindow(arg))
					this.nwWindow = arg
				else if (isAppWindow(arg))
					this.nwWindow = nw.Window.get(arg.contentWindow)
				else if (isWindow(arg))
					this.nwWindow = nw.Window.get(arg)
			} else if (platform.electron) {
				if (isBrowserWindow(arg)) {
					this.browserWindow = arg
				} else if (isWindow(arg)) {
					// Electron doesn't support window.opener nor any other properties linking to any other window.
					// Only accessible window object is the current one. Everything else is either inaccessible or proxy.
					this.browserWindow = electron.remote.getCurrentWindow()
				} else if (isBrowserWindowProxy(arg)) {
					// Sometimes Electron gives you proxy object with just a .postMessage() and nothing else.
					var myid = electron.remote.getCurrentWindow().id
					var eventName = 'iso-app-get-id'
					arg.eval(`
						electron.remote
							.BrowserWindow.fromId(${myid})
							.webContents.send('${eventName}', electron.remote.getCurrentWindow().id)
					`)
					var id = await new Promise(resolve => {
						electron.ipcRenderer.on(eventName, (e, id) => resolve(id))
					})
					console.log('GOT the id X', id)
					this.browserWindow = BrowserWindow.fromId(id)
				}
			} else if (isWindow(arg)) {
				this.window = arg
			}
			this.setupLocal()
		}

		// TODO: maybe reintroduce subclassed ActiveWindows that does not do any magic in
		// constructor but takes care of self removal code like this.
		activeWindows.add(this)
		this.once('closed', () => {
			console.log('this closed', this.id)
			activeWindows.delete(this)
		})

		// handle IDs
		this._setupId()

		this.isMain = false // todo: move
		this.isMainProcess = false // todo: move
	}

	setupLocal() {

		// TODO: in NWJS child windows are restrictied, ty to get the real window through injection

		// experimental, deleteme if needed
		if (this.window)		nativeMap.set(this.window, this)
		if (this.browserWindow)	nativeMap.set(this.browserWindow, this)
		if (this.nwWindow)		nativeMap.set(this.nwWindow, this)
		
		// Electron and browser windows can be opened at any positing in any size.
		// NW.JS can't so we have to reposition it after it's opened
		if (platform.nwjs) {
			//if (options.x !== undefined || options.y !== undefined)
			//	this.nwWindow.moveTo(options.x, options.y)
		}

		if (this.window) {
			var attachWindowListeners = () => {
				// https://electronjs.org/docs/api/browser-window#event-close
				this.window.addEventListener('beforeunload', e => this.emit('close', e))
				// https://electronjs.org/docs/api/browser-window#event-closed
				this.window.addEventListener('unload', e => this.emit('closed', e))
			}
			if (this.window.document.readyState === 'loading')
				this.window.addEventListener('load', attachWindowListeners)
			else
				attachWindowListeners()
		}

		if (platform.electron || (platform.uwp && this.isMainWindow)) {
			// We cannot listen on the remote objects. Fallback to reliance on their IPC feedback.
		} else {
			// We can access the remote window & document objects and listen on them directly.
			//this.window.addEventListener('focus', e => console.log('focus'))
			//this.window.addEventListener('blur', e => console.log('blur'))
		}

/*
		console.log('this.nwWindow', this.nwWindow)
		console.log('this.browserWindow', this.browserWindow)
		console.log('this.window', this.window)
		if (this.nwWindow) {
			console.log('LISTENING: NWJS')
			this.nwWindow.on('minimize', e => console.log('NW minimize'))
			this.nwWindow.on('maximize', e => console.log('NW maximize'))
			this.nwWindow.on('unmaximize', e => console.log('NW unmaximize'))
			this.nwWindow.on('restore', e => console.log('NW restore'))
			this.nwWindow.on('blur', e => console.log('NW blur'))
			this.nwWindow.on('focus', e => console.log('NW focus'))
			this.nwWindow.on('show', e => console.log('NW show'))
			this.nwWindow.on('hide', e => console.log('NW hide'))
		}
		if (this.browserWindow) {
			console.log('LISTENING: ELECTRON')
			console.log('this.browserWindow.on', this.browserWindow.on)
			this.browserWindow.on('minimize', e => console.log('EL minimize'))
			this.browserWindow.on('maximize', e => console.log('EL maximize'))
			this.browserWindow.on('unmaximize', e => console.log('EL unmaximize'))
			this.browserWindow.on('restore', e => console.log('EL restore'))
			this.browserWindow.on('blur', e => console.log('EL blur'))
			this.browserWindow.on('focus', e => console.log('EL focus'))
			this.browserWindow.on('show', e => console.log('EL show'))
			this.browserWindow.on('hide', e => console.log('EL hide'))
		}
		if (this.window) {
			console.log('LISTENING: WEB')
			this.window.addEventListener('minimize', e => console.log('-- minimize'))
			this.window.addEventListener('maximize', e => console.log('-- maximize'))
			this.window.addEventListener('unmaximize', e => console.log('-- unmaximize'))
			this.window.addEventListener('restore', e => console.log('-- restore'))
			this.window.addEventListener('blur', e => console.log('-- blur'))
			this.window.addEventListener('focus', e => console.log('-- focus'))
			this.window.addEventListener('show', e => console.log('-- show'))
			this.window.addEventListener('hide', e => console.log('-- hide'))
		}
*/
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
		*/
/*
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


window.MyAppWindow = MyAppWindow // todo delete


















export default class MyAppWindowExtension {

	setup() {
		console.log('MyAppWindowExtension.setup()')
		activeWindows = new OrderedSet
		this.windows = activeWindows
		
		if (platform.hasWindow) {
			this.currentWindow = MyAppWindow.get()
			if (!!window.opener)
			this.parentWindow = MyAppWindow.from(window.opener) // todo reenable, throws in NWJS
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
				.forEach(appwin => activeWindows.add(appwin))
		} else if (platform.electron) {
			electron.remote.BrowserWindow.getAllWindows()
				.map(browserWindow => MyAppWindow.from(browserWindow))
				.forEach(appwin => activeWindows.add(appwin))
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

	// instance of MyAppWindow() wrap around the initial first window opened
	get isMainWindow() {
		return false
		//return this.currentWindow.isMainWindow
	}

	// instance of MyAppWindow(window.opener). Uses window.opener where available (except for UWP and Electron)
	parentWindow = undefined // todo

	//get mainWindow() {
	//	return this.windows[0]
	//}
	//get currentWindow() {
	//	// TODO
	//	return this.windows[0]
	//}

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

/*

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
*/
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