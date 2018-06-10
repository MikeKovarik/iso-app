import platform from 'platform-detect'
import events from 'events'


export var EventEmitter

if (typeof events !== 'undefined' && events.EventEmitter !== undefined) {
	// Use Node's or other bundled implementation of EventEmitter
	EventEmitter = events.EventEmitter
} else {
	// Custom web based implementation of EventEmitter
	EventEmitter = class EventEmitter {
		constructor() {
			this._map = new Map
		}
		_getEventCallbacks(name) {
			if (!this._map.has(name))
				this._map.set(name, [])
			return this._map.get(name)
		}
		on(name, callback) {
			this._getEventCallbacks(name).unshift(callback)
		}
		once(name, callback) {
			var oneTimeCb = (...args) => {
				this.removeListener(name, oneTimeCb)
				callback(...args)
			}
			this.on(name, oneTimeCb)
		}
		removeAllListeners(name) {
			if (name)
				this._map.delete(name)
			else
				this._map.clear()
		}
		removeListener(name, callback) {
			remove(this._getEventCallbacks(name), callback)
		}
		emit(name, ...args) {
			var callbacks = this._getEventCallbacks(name)
			var i = callbacks.length
			while (i--) {
				callbacks[i](...args)
			}
		}
	}
}

function remove(array, item) {
	var index = array.indexOf(item)
	if (index !== -1)
		array.splice(index, 1)
}

// Times are rough, everything's trying to kill ya.
// ES Modules are transpiled down to UMD so this hack (like i had a choice, if only there was
// any other way to silently fail importing missing ES Module) will have to do for the time being.

export var nw
export var electron

if (platform.electron) {
	if (global && global.require)
		electron = global.require('electron')
	else if (typeof require === 'function')
		electron = require('electron')
}
if (platform.nwjs) {
	if (platform.hasWindow)
		nw = window.nw || require('nw.gui')
	else
		nw = global.nw
}