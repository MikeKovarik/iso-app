import {registerPlugin} from './plugin-core.mjs'


registerPlugin('ManagedAppWindow', class ElectronStub {
	static fromWebContents(webContents) {}
	static fromBrowserView(browserView) {}
	static addExtension(path) {}
	static removeExtension(name) {}
	static getExtensions() {}
	static addDevToolsExtension(path) {}
	static removeDevToolsExtension(name) {}
	static getDevToolsExtensions() {}
	get webContents() {return null}
	setSimpleFullScreen(flag) {}
	isSimpleFullScreen(flag) {}
	setAspectRatio(aspectRatio, extraSize) {}
	previewFile(path, displayName) {}
	closeFilePreview() {}
})


registerPlugin('ManagedAppWindow', class ElectronPolyfill {

	///////////////////////////////////////////////////////////////////////////
	// STATIC
	///////////////////////////////////////////////////////////////////////////

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

	///////////////////////////////////////////////////////////////////////////
	// STATE
	///////////////////////////////////////////////////////////////////////////

	destroy() {
	}

	close() {
		if (this.nwWindow) this.nwWindow.close()
	}

	// https://electronjs.org/docs/api/browser-window#winisdestroyed
	isDestroyed() {
		// TODO
	}

	setEnabled(enable) {}

	///////////////////////////////////////////////////////////////////////////
	// VISIBILITY
	///////////////////////////////////////////////////////////////////////////

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


	///////////////////////////////////////////////////////////////////////////
	// POSITION & SIZE
	///////////////////////////////////////////////////////////////////////////


	setBounds(bounds, animate) {
		if (bounds.width !== undefined && bounds.height !== undefined)
			this.setSize(bounds.width, bounds.height)
		if (bounds.x !== undefined && bounds.y !== undefined)
			this.setPosition(bounds.x, bounds.y, animate)
	}
	getBounds() {
		var {width, height, x, y} = this
		return {width, height, x, y}
	}


	// The ugly ducklings
	setContentBounds(bounds, animate) {
		this.setBounds(bounds, animate)
	}
	getContentBounds() {
		return this.getBounds()
	}
	setContentSize(width, height, animate) {
		this.setSize(width, height, animate)
	}
	getContentSize() {
		return this.getSize()
	}





	resizable = true // todo
	setResizable(resizable) {
		this.resizable = resizable
	}
	isResizable() {
		return this.resizable
	}

	movable = true // todo
	setMovable(movable) {
		this.movable = movable
	}
	isMovable() {
		return this.movable
	}

	minimizable = true // todo
	setMinimizable(minimizable) {
		this.minimizable = minimizable
	}
	isMinimizable() {
		return this.minimizable
	}

	maximizable = true // todo
	setMaximizable(maximizable) {
		this.maximizable = maximizable
	}
	isMaximizable() {
		return this.maximizable
	}

	fullscreenable = true // todo
	setFullScreenable(fullscreenable) {
		this.fullscreenable = fullscreenable
		//if (platform.uwp)
		//	this.appView.tryEnterFullScreenMode
	}
	isFullScreenable() {
		return this.fullscreenable
	}

	closable = true // todo
	setClosable(closable) {
		this.closable = closable
	}
	isClosable() {
		return this.closable
	}

})
