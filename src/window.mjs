import platform from 'platform-detect'
import {EventEmitter, nw, electron} from './deps.mjs'
import {registerPlugin, importPlugins} from './plugin-core.mjs'
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
	arrayDiff
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




var nativeMap = new Map()
var activeWindows = new ArraySet()
// Needed for UWP BroadcastChannel polyfill.
if (platform.uwp)
	BroadcastChannel._getWindowList = () => windows


// TODO
//if (platform.electron)
//	var ManagedAppWindowSuperClass = BrowserWindow
//else
	var ManagedAppWindowSuperClass = EventEmitter

class ManagedAppWindow extends ManagedAppWindowSuperClass {

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

	constructor(arg) {
		super()
		//console.log('new ManagedAppWindow() constructor', arg)
		if (typeof arg === 'string' || typeof arg === 'number') {
			if (platform.electron) {
				this.browserWindow = BrowserWindow.fromId(arg.toString())
				this._setupLocal()
			} else {
				console.log('_setupRemoteFromId(arg)', arg)
				this._setupRemoteFromId(arg)
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
				this._setupLocal()
			} else if (platform.electron) {
				if (isBrowserWindow(arg)) {
					this.browserWindow = arg
				} else if (isWindow(arg)) {
					// Electron doesn't support window.opener nor any other properties linking to any other window.
					// Only accessible window object is the current one. Everything else is either inaccessible or BrowserWindowProxy.
					this.browserWindow = electron.remote.getCurrentWindow()
				}
				this._setupLocal()
			} else if (isWindow(arg)) {
				// Use raw web window objects only in case of vanilla web (and PWAs) because we have nothing else to work
				// with. Duh. Also only use the the object for the window this code runs in. Other should be decoupled and
				// handled through IPC to prevent complications with taking hold of the window objects, passing messages
				// to each one. Plus there are the UWP limitations (that require injection).
				if (arg === window) {
					console.log('open this window', arg.name, arg)
					this.window = arg
					this.document = this.window.document
					this._setupLocal()
				} else {
					try {
						console.log('open remote window')
						console.log('window.name', arg.name)
						//console.log('window', arg)
					} catch(err) {
						console.error(err)
					}
					console.log('_setupRemoteFromId(arg.name)', arg.name)
					this._setupRemoteFromId(arg.name)
				}
			}

			importPlugins(this)
		}

		//console.log('setup() B')

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

		//console.log('setup() C')

		// TODO: maybe reintroduce subclassed ActiveWindows that does not do any magic in
		// constructor but takes care of self removal code like this.
		activeWindows.add(this)
		this.once('closed', () => {
			console.log('this closed', this.id)
			activeWindows.delete(this)
		})

		// handle IDs
		this._createId()
	}

	_instantiate() {
		// Electron and browser windows can be opened at any positing in any size.
		// NW.JS can't so we have to reposition it after it's opened
		if (platform.nwjs) {
			//if (options.x !== undefined || options.y !== undefined)
			//	this.nwWindow.moveTo(options.x, options.y)
		}
	}

	_setupLocal() {	
		if (this.window) {
			// TODO: re-enable ----------------------------------------------------------------------------------
			//this.window.addEventListener('focus', e => this.emit('focus'))
			//this.window.addEventListener('blur',  e => this.emit('blur'))
			this._onVisibilityChange = this._onVisibilityChange.bind(this)
			this.document.addEventListener('visibilitychange', this._onVisibilityChange)
			this._onResize = this._onResize.bind(this)
			this.window.addEventListener('resize', this._onResize, {passive: true})
			// https://electronjs.org/docs/api/browser-window#event-close
			// https://electronjs.org/docs/api/browser-window#event-closed
			this.window.addEventListener('beforeunload', e => this.emit('close'))
			this.window.addEventListener('unload', e => this.emit('closed'))
			//this.window.addEventListener('beforeunload', e => this.emit('close', e))
			//this.window.addEventListener('unload', e => this.emit('closed', e))
			// Kickstart it with default values.
			this.focused = this.document.hasFocus()
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
		var {availWidth, availHeight} = this.window.screen
		var {outerWidth, outerHeight} = this.window
		if (platform.edge) {
			// Edge adds 16px to outher sizes (most of the time, though it can vary with different pixel densities)
			return (availWidth - (outerWidth - 16)) < 2
				&& (availHeight - (outerHeight - 16)) < 2
		} else {
			return (outerWidth === availWidth)
				&& (outerHeight === availHeight)
		}
	}

	_onResize() {
		var maximized = this._isMaximized()
		if (maximized && !this.maximized)
			this.emit('maximize')
		else if (!maximized && this.maximized)
			this.emit('unmaximize')
	}




	// string or number
	_setupRemoteFromId(id) {
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
		} else if (this.window) {
			var opener = getWindowOpener(this.window)
			return opener === undefined || opener === null
		}
		return false
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
		} else {
			/*ipc.emit({
				id: this.id,
				method: 'close'
			})*/
		}
		this.once('close', () => this.destroy())
	}


	// to be deleted!
	bark() {
		console.log('BARK!')
	}
	get deleteme() {
		return this._deleteme
	}
	set deleteme(newValue) {
		this._deleteme = newValue
	}


}












export default class ManagedAppWindowExtension {

	pluginConstructor() {
		//console.log('ManagedAppWindowExtension.setup()')
		this.windows = activeWindows
		
		if (platform.hasWindow) {
			this.currentWindow = ManagedAppWindow.get()
			var opener = getWindowOpener(window)
			// OMG UWP, why do you have to be like this? UWP won't give us openers name (id).
			if (!!opener && opener.name)
				this.parentWindow = ManagedAppWindow.from(opener) // todo reenable, throws in NWJS
		}

		// TODO: some advanced logic to detect if and when to open broadcast channel
		// why? we don't want unnecessary event emitting if the app only ever uses single window and no
		// background process (most UWP and NW.JS* apps).
		// Do not open BC if this is the main window (and somehow detect if there's a background process running, if so, open BC)
		// Open BC if this window was opened by something else
		// Open BC if this window is opening a new one (and BC isn't yet open)
		// IMPORTANT: we also need to open BC to probe surrounding when window starts (reloads)
		this._canSync = platform.web || platform.pwa // TODO

		this._wbc = new BroadcastChannel('iso-app-win')
		this._wbc.onmessage = this._onBcMessage.bind(this)

		if (this._canSync)
			this._wrapCurrentWindowForSyncing() // TODO
		
		if (platform.hasWindow) {
			this._updateWindows()
		}

	}

	_updateWindows() {
		//console.log('ActiveWindows.update()')
		if (platform.hasWindow && platform.nwjs) {
			chrome.app.window.getAll()
				.map(appWindow => ManagedAppWindow.from(appWindow))
				//.forEach(appwin => activeWindows.add(appwin))
		} else if (platform.hasWindow && platform.electron) {
			electron.remote.BrowserWindow.getAllWindows()
				.map(browserWindow => ManagedAppWindow.from(browserWindow))
				//.forEach(appwin => activeWindows.add(appwin))
		} else {
			// Fallback to IPC. Broadcast my ID and list of IDs this window already tracks.
			// Ideally the windows that aren't on the list will introduce themselves.
			//var message = `${this.id}|${activeWindows.map(w => w.id)}`
			this._sendBc({
				_windows: activeWindows.map(w => w.id)
			})
			// TODO send
		}
	}

	_onBcMessage({data}) {
		var {_from, _to} = data
		// Safety check.
		if (_from === undefined) return
		if (_from === this.currentWindow.id) return
		// Skip all messages with recipient that isn't this window.
		if (_to !== undefined && _to !== this.currentWindow.id) return
		console.log('----------------- RECEIVED -----------------------------------')
		console.log(data)
		if (Array.isArray(data._windows)) {
			// Some other window notified us its existence (usually right after its opened or refreshed)
			// and includes list of IDs of windows it already has access to (or knows of).
			var hisIds = data._windows
			var myIds = this.windows.map(maw => maw.id)
			// Create new windows from IDs we've received and come to know.
			// The ManagedAppWindow will be hollow (not based on actual web window object, because we can't get hold of it)
			// and change its state based on broadcasted messages.
			var myMissingIds = arrayDiff(hisIds, myIds)
			if (myMissingIds.length)
				myMissingIds.map(id => ManagedAppWindow.from(id))
			// Notify the other side of windows we know of (and have access to).
			var hisMissingIds = arrayDiff(myIds, hisIds)
			if (hisMissingIds.length) {
				this._sendBc({
					_to: _from,
					_windows: activeWindows.map(w => w.id)
				})
			}
			return
		}
		var maw = ManagedAppWindow.from(data._from)
		if (data._call) {
			// Someone wants to remotely call some function on the window it does not have handle for.
			console.log('call', data._call, 'on', data._from)
			maw[data._call](...(data._args || []))
		} else if (data._event) {
			console.log('emit event', data._event, 'on', data._from)
			var args = data._args || []
			if (maw.emitLocal)
				maw.emitLocal(name, ...args)
			else if (maw.emit)
				maw.emit(name, ...args)
		} else if (data._heartbeat) {
			maw._onHeartbeat()
		} else {
			console.log('apply snapshot of', data._from)
			// Received new values from the remote window. Apply them to local hollow image of the window.
			Object.keys(data)
				.filter(key => !key.startsWith('_') && key !== 'id')
				.forEach(key => maw[key] = data[key])
		}

	}

	_wrapCurrentWindowForSyncing() {
		let {currentWindow} = this
		// NOTE: getOwnPropertyNames ensures we don't get EventEmitter's methods, but the plugin Classes
		//       should not be inheriting from anything.
		// Get list of all variables, functions and getter/setters in current window that needs to be wrapped.
		function uniq(...items) {
			return Array.from(new Set(items))
		}
		// Get both instance properties and prototype get/set & functions and 
		let properties = uniq(
				...Object.getOwnPropertyNames(currentWindow),
				...Object.getOwnPropertyNames(ManagedAppWindow.prototype)
			)
			// Filter out all the things we don't want to sync
			.filter(name => {
				return !name.startsWith('_')
					&& name !== 'constructor' && name !== 'setup'
					&& name !== 'id' && name !== 'window' && name !== 'document'
			})
		// Wrap all the properties, setters and functions, intercept each call or execution and broadcast it to other windows.
		for (let name of properties) {
			// Get descriptor of the thing.
			let desc = Object.getOwnPropertyDescriptor(currentWindow, name)
					|| Object.getOwnPropertyDescriptor(ManagedAppWindow.prototype, name)
			if (typeof desc.value === 'function') {
				// TODO: currently this captures calling method here and calls in anywhere else. this is backwards
				//       this needs to listen on all other windows than current one and execute it there.
				// Do not sync functions that (educated guess) are just getters and do not actually change any internal value.
				if (name.startsWith('get') && name[3] === name[3].toUpperCase()) continue
				if (name.startsWith('is')  && name[2] === name[2].toUpperCase()) continue
				let origFnKey = '_' + name + '_original'
				currentWindow[origFnKey] = desc.value
				console.log('name', name)
				currentWindow[name] = (...args) => {
					console.log('INTERCEPT', name)
					this._callRemotely(name, args)
					return currentWindow[origFnKey](...args)
				}
			} else if ('value' in desc) {
				// Instance variables.
				let {value, configurable, enumerable} = desc
				Object.defineProperty(currentWindow, name, {
					configurable, enumerable,
					get: () => value,
					set: newValue => {
						this._updateValue(name, newValue)
						value = newValue
					}
				})
			} else if (desc.get && desc.set) {
				// Intercept setters.
				let {get, set, configurable, enumerable} = desc
				let origSetKey = '_' + name + '_setter'
				currentWindow[origSetKey] = set
				Object.defineProperty(currentWindow, name, {
					configurable, enumerable,
					get,
					set: newValue => {
						this._updateValue(name, newValue)
						currentWindow[origSetKey](newValue)
					}
				})
			}
		}

		currentWindow.emitLocal = currentWindow.emit
		currentWindow.emit = (name, ...args) => {
			if (args.length) {
				this._emitRemotely(name, args)
				currentWindow.emitLocal(name, ...args)
			} else {
				this._emitRemotely(name)
				currentWindow.emitLocal(name)
			}
		}
	}

	_sendBc(data) {
		data._from = this.currentWindow.id
		console.log('posting', data)
		this._wbc.postMessage(data)
	}

	_callRemotely(name, args) {
		console.log('_callRemotely', name, args)
		this._sendBc({
			_call: name,
			_args: args,
		})
	}

	_emitRemotely(name, args) {
		console.log('_emitRemotely', name, args)
		this._sendBc({
			_emit: name,
			_args: args,
		})
	}

	_updateValue(name, value) {
		console.log('_updateValue', name, value)
		this._sendBc({
			[name]: value
		})
	}

	_sendSelfSnapshot() {
		// TODO
	}


	///////////////////////////////////////////////////////////////////////////
	// PROPERTIES
	///////////////////////////////////////////////////////////////////////////

	//
	get mainWindow() {
		return this.windows.find(win => win.isMainWindow)
	}

	// instance of ManagedAppWindow(window.opener). Uses window.opener where available (except for UWP and Electron)
	parentWindow = undefined // todo

	//
	mainWindow = undefined // todo

	// instance of ManagedAppWindow() wrap around the initial first window opened
	get isMainWindow() {
		return this.currentWindow.isMainWindow
	}

	_createWindow(url, options) {
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

	// [url] string - url to open
	// [options] object - window size and position
	open(url, options) {
		// Handle arguments
		if (typeof url === 'object') {
			options = url
			url = options.url || 'index.html'
		}
		// Open the window
		var win = this._createWindow(url, options)
		var e = {} // TODO: event
		this.emit('browser-window-created', e, win)
		// custom API, without the events
		this.emit('window-created', win)
		return win
	}

	// TODO: this may need to be moved elsewhere
	tabletMode = undefined


}









//global.ManagedAppWindow = ManagedAppWindow // todo delete

registerPlugin(ManagedAppWindowExtension)









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
