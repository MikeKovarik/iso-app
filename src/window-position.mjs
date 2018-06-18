import platform from 'platform-detect'
import {registerPlugin} from './plugin-core.mjs'


registerPlugin('ManagedAppWindow', class Position {

	///////////////////////////////////////////////////////////////////////////
	// POSITION
	///////////////////////////////////////////////////////////////////////////

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

})