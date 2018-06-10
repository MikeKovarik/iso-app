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
			this.listenerWrappers = new Map
			this.delegate = document.createDocumentFragment()
		}
		on(name, callback) {
			var listener = e => callback(e.data || e.detail)
			this.listenerWrappers.set(callback, listener)
			this.delegate.addEventListener(name, listener)
		}
		once(...args) {
			// TODO. for now
			this.on(...args)
		}
		removeListener(name, callback) {
			var listener = this.listenerWrappers.get(callback)
			if (listener) {
				this.delegate.removeEventListener(name, listener)
				this.listenerWrappers.delete(callback)
			}
		}
		emit(name, detail) {
			this.delegate.dispatchEvent(new CustomEvent(name, {detail}))
		}
	}
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