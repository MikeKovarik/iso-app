import platform from 'platform-detect'
import {registerPlugin} from './plugin-core.mjs'
import {
	BrowserWindow,
	getRandomWindowId,
} from './window-util.mjs'

// Plugin for ManagedAppWindow instances.
registerPlugin('ManagedAppWindow', class {

	pluginConstructor() {
		//console.log('pluginConstructor Visibility')
		if (this.local && this.window) {
			this.window.addEventListener('beforeunload', e => this.emit('close'))
			this.window.addEventListener('unload', e => this.emit('closed'))
		}
		if (platform.electron) {
			this.browserWindow.once('close', () => this.emit('close'))
			this.browserWindow.once('closed', () => this.emit('closed'))
			// Electron's remote windows are goddamn unreliable! It fires no events if you listen on it within
			// the first 500ms after creation.
			setTimeout(() => {
				this.browserWindow.once('close', () => this.emit('close'))
				this.browserWindow.once('closed', () => this.emit('closed'))
			}, 1000)
		}
	}

})


// Plugin for app object.
registerPlugin(class {

	pluginConstructor() {
		var {ManagedAppWindow} = this.constructor
		if (platform.electron) {
			var eapp = electron.app || electron.remote.app
			eapp.on('browser-window-created', (e, bw) => {
				var maw = ManagedAppWindow.from(bw)
				this._emitNewWindowEvents(maw)
			})
		}
	}

	_emitNewWindowEvents(maw) {
		setTimeout(() => {
			// shim for electron event
			this.emit('browser-window-created', {}, maw)
			// custom API, without the events
			this.emit('window-created', maw)
		})
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
		var maw = this._openWindow(url, options)
		this._emitNewWindowEvents(maw)
		return maw
	}

	// Opens new window using window.open or proprietary Electrons/NW.JS proprietary API.
	_openWindow(url, options) {
		var {ManagedAppWindow} = this.constructor
		console.log('_openWindow(url, options)')
		url = sanitizeUrl(url)
		sanitizeWindowOptions(options)
		if (platform.electron) {
			var browserWindow = new BrowserWindow(options)
			if (url.includes('://'))
				browserWindow.loadURL(url)
			else
				browserWindow.loadFile(url)
			//resolve(browserWindow)
			return ManagedAppWindow.from(browserWindow)
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
					return ManagedAppWindow.from(nwWindow)
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
					return ManagedAppWindow.from(newWindow)
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

function sanitizeUrl(url) {
	if (!url) return url
	if (!url.includes('://')) {
		if (platform.uwp)
			return `ms-appx:///${url}`
		//else if (platform.electron)
		//	return `file://${__dirname}/${url}`
	}
	return url
}