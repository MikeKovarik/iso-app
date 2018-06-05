import platform from 'platform-detect'
import {EventEmitter} from './EventEmitter.mjs'


platform.hasWindow = platform.window // TODO delete

if (platform.uwp) {
	var {ApplicationView} = Windows.UI.ViewManagement
}
if (platform.electron) {
	var electron = global.require('electron')
}

// TODO: change emit to local emit

// TODO
//if (platform.electron)
//	var AppWindowSuperClass = electron.BrowserWindow
//else
	var AppWindowSuperClass = EventEmitter

class AppWindow extends AppWindowSuperClass {

	static get() {
		if (platform.nwjs)
			return new this(nw.Window.get())
		else if (platform.electron)
			return new this(electron.remote.getCurrentWindow())
		else if (platform.uwp)
			return new this(ApplicationView.getForCurrentView())
		else if (this.canDetectWindowState)
			return new this(window)
	}

	constructor(arg) {
		super()

		console.log('new AppWindow', arg)

		if (platform.nwjs) {
			var cname = arg.constructor.name
			if (cname === 'NWWindow') {
				this.nwWindow = arg
				this.window = this.nwWindow.window
			} else if (cname === 'Window') {
				this.window = arg
				this.nwWindow = nw.Window.get(this.window)
			}
		} else if (platform.electron) {
			this.browserWin = arg
			console.log('arg is electron BrowserWindow', arg)
		} else if (platform.uwp && false) {
			this.appView = arg // TODO
			//var newId = MSApp.getViewId(win)
		} else {
			this.window = arg
		}
		this.isMain = false
		this.isMainWindow = false
		this.isMainProcess = false
		try {
			// UWP will not permit access to anything on remote window object.
			this.isMainWindow = this.window.opener === null || this.window.opener === undefined
		} catch(err) {}

		if (platform.nwjs) {
			//if (options.x !== undefined || options.y !== undefined)
			//	this.nwWindow.moveTo(options.x, options.y)
		}

		if (platform.electron || (platform.uwp && this.isMainWindow)) {
			// We cannot listen on the remote objects. Fallback to reliance on their IPC feedback.
		} else {
			// We can access the remote window & document objects and listen on them directly.
			this.window.addEventListener('focus', e => console.log('focus'))
			this.window.addEventListener('blur', e => console.log('blur'))
		}

/*
		if (platform.nwjs) {
			this.nwWindow = nw.Window.get()
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






















export default class AppWindowExtension {

	setup() {
		this.windows = []

		if (platform.hasWindow) {
			this.mainWindow = AppWindow.get()
			this.windows.push(this.mainWindow)
		}

	}


	///////////////////////////////////////////////////////////////////////////
	// PROPERTIES
	///////////////////////////////////////////////////////////////////////////

	// WARNING: Chrome uses null, Edge uses undefined.
	// WARNING: NW.JS wraps main script (if used instead of main window) into empty HTML page.
	//          Therefore app's window.opener will link to that hidden window.
	get isMainWindow() {
		var opener = window.opener
		if (platform.nwjs)
			opener = window.opener && window.opener.opener
		return opener === undefined || opener === null
	}

	getMainWindow() {
		return this.windows[0]
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
			var browserWin = new electron.BrowserWindow(options)
			browserWin.loadURL(url)
			//resolve(browserWin)
			return win
		} else if (platform.nwjs) {
			// TODO. MOVE THIS TO CONSTUCTOR
			nw.Window.open(url, options, nwWindow => {
				if (options.x !== undefined || options.y !== undefined)
					nwWindow.moveTo(options.x, options.y)
				// TODO. return nwWindow
				//resolve(nwWindow)
			})
		} else {
			var optionsString = stringifyWindowOptions(options)
			var win = window.open(url, '_blank', optionsString)
			//resolve(win)
			return win
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
		this.windows.push(win)
		console.log(win)
		//win.once('closed', () => remove(this.windows, win)) // TODO: reenable
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