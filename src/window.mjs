import platform from 'platform-detect'


if (platform.uwp) {
	var {ApplicationView} = Windows.UI.ViewManagement
}

export default SuperClass => class extends SuperClass {

	constructor() {
		super()
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

		if (platform.uwp) {
			this.appView = ApplicationView.getForCurrentView()
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
	}


	///////////////////////////////////////////////////////////////////////////
	// PROPERTIES
	///////////////////////////////////////////////////////////////////////////

	// WARNING: Chrome uses null, Edge uses undefined.
	isMainView = window.opener === undefined || window.opener === null

	get title() {
		if (platform.uwp)
			return this.appView.title
		else
			return document.title
	}
	set title(newTitle) {
		if (platform.uwp)
			this.appView.title = newTitle
		else
			document.title = newTitle
	}

	_minimized = false
	get minimized() {return this._minimized}
	set minimized(minimized) {
		if (minimized === true && this._minimized === false)
			this.emit('minimize')
		else if (minimized === false && this._minimized === true)
			this.emit('unminimize')
		this._minimized = minimized
	}

	_maximized = false
	get maximized() {return this._maximized}
	set maximized(maximized) {
		if (maximized === true && this._maximized === false)
			this.emit('maximize')
		else if (maximized === false && this._maximized === true)
			this.emit('unmaximize')
		this._maximized = maximized
	}

	_fullscreen = false
	get fullscreen() {return this._fullscreen}
	set fullscreen(newValue) {
		this._fullscreen = newValue
		this.emit(newValue ? 'TODO' : 'unTODO')
	}

	// TODO: this may need to be moved elsewhere
	tabletMode = undefined

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
/*
	onResize() {
		console.log(
			window.outerWidth, screen.width, document.documentElement.clientWidth,
			window.outerHeight, screen.height, document.documentElement.clientHeight
		)
	}
*/
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


	///////////////////////////////////////////////////////////////////////////
	// MINUPULATION METHODS
	///////////////////////////////////////////////////////////////////////////

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

	// Closes and kills app's (main) window
	close() {
		if (platform.nwjs) this.nwWindow.close()
	}

	// Shows the app's window and adds it to taskbar
	show() {
		if (platform.nwjs) this.nwWindow.show()
	}

	// Hides the app's window and removes it from taskbar
	hide() {
		if (platform.nwjs) this.nwWindow.hide()
	}

}