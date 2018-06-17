import platform from 'platform-detect'
import {registerPlugin} from './plugin-core.mjs'


registerPlugin('ManagedAppWindow', class SizeAndPosition {

	///////////////////////////////////////////////////////////////////////////
	// POSITION
	///////////////////////////////////////////////////////////////////////////

	// todo move to the other class?
	get x() {return this.getPosition()[0]}
	get y() {return this.getPosition()[1]}
	set x(newValue) {this.setPosition(newValue, undefined)}
	set y(newValue) {this.setPosition(undefined, newValue)}

	// 
	getPosition() {
		if (platform.nwjs)
			return [this.nwWindow.x, this.nwWindow.y]
		else if (platform.electron)
			return this.browserWindow.getPosition()
		return [0, 0]
	}

	// todo move to the other class?
	// WARNING: Electron accepts two ints: x,y; NW.JS Accepts single string (center, mouse) or null
	setPosition(x, y) {
		if (platform.nwjs) {
			if (x !== undefined) this.nwWindow.x = x
			if (y !== undefined) this.nwWindow.y = y
		} else if (platform.electron) {
			// Electron throws if both arguments aren't present
			this.browserWindow.setPosition(x, y)
		}
	}

	///////////////////////////////////////////////////////////////////////////
	// SIZE
	///////////////////////////////////////////////////////////////////////////

	get width()  {return this.getSize()[0]}
	get height() {return this.getSize()[1]}
	set width(newValue)  {return this.setSize(newValue, undefined)}
	set height(newValue) {return this.setSize(undefined, newValue)}

	// https://electronjs.org/docs/api/browser-window#wingetsize
	getSize() {
		if (platform.electron) {
			return this.browserWindow.getSize()
		} else if (platform.nwjs) {
			return [this.nwWindow.width, this.nwWindow.height]
		} else if (this.window) {
			return [this.window.outerWidth, this.window.outerHeight]
		}
		return [0, 0]
	}

	// https://electronjs.org/docs/api/browser-window#winsetsizewidth-height
	setSize(width, height) {
		if (platform.electron) {
		} else if (platform.nwjs) {
			if (width !== undefined)  this.nwWindow.width  = width
			if (height !== undefined) this.nwWindow.height = height
		} else if (platform.uwp) {
			this.appView.tryResizeView({width, height}) // it can fail
		}
	}

	// Proprietary alias for .setSize()
	resize(width, height) {
		this.setSize(width, height)
	}

	///////////////////////////////////////////////////////////////////////////
	// MIN SIZE
	///////////////////////////////////////////////////////////////////////////

	get minWidth() {} // TODO
	get minHeight() {} // TODO

	set minWidth(newValue) {} // TODO
	set minHeight(newValue) {} // TODO

	// https://electronjs.org/docs/api/browser-window#wingetminimumsize
	getMinimumSize() {
	}

	// https://electronjs.org/docs/api/browser-window#winsetminimumsizewidth-height
	setMinimumSize(width, height) {
		if (platform.nwjs)
			return this.nwWindow.setMinimumSize(width, height)
		if (platform.electron)
			return this.browserWindow.setMinimumSize(width, height)
		else if (platform.uwp)
			return this.appView.setPreferredMinSize({width, height})
	}

	///////////////////////////////////////////////////////////////////////////
	// MAX SIZE
	///////////////////////////////////////////////////////////////////////////

	// https://electronjs.org/docs/api/browser-window#wingetmaximumsize
	getMaximumSize() {
	}

	// https://electronjs.org/docs/api/browser-window#winsetmaximumsizewidth-height
	setMaximumSize(width, height) {
		if (platform.nwjs)
			return this.nwWindow.setMaximumSize(width, height)
		if (platform.electron)
			return this.browserWindow.setMaximumSize(width, height)
		// UWP does not support this
	}

})