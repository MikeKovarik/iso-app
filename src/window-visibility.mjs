import platform from 'platform-detect'
import {registerPlugin} from './plugin-core.mjs'


registerPlugin('ManagedAppWindow', class Visibility {

	// NOTE: These properties are difficult if not impossible to (accurately and reliable) detect
	// without listening to events that expose their state. Electron has methods like isFocused
	// and isMaximized(), but neither web nor NW.JS does. So we're keeping track of the state
	// instead of just writing getter wrapper around isMaximized().

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

	pluginConstructor() {
		//console.log('pluginConstructor Visibility')
		if (this.local)
			this._setupLocal()
		//else
		//	this._setupRemote()
	}

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
	// LOCAL
	///////////////////////////////////////////////////////////////////////////

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

})