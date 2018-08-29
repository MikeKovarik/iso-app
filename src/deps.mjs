import platform from 'platform-detect'
import events from 'events'
import {remove} from './util.mjs'


export var EventEmitter


if (typeof events !== 'undefined' && events.EventEmitter !== undefined) {

	// Use Node's or other bundled implementation of EventEmitter
	EventEmitter = events.EventEmitter

} else if (platform.node && typeof require === 'function') {

	EventEmitter = require('events').EventEmitter

	// This looks ugly, but trust me.
	// Transipiling to UMD changes the ESM import to either require() in pure nodejs
	// or lookup in window object if the platform has a window.
	// Problem is when the code is loaded as <script> in electron (and NW.JS) app.
	// UMD doesn't handle that. It will try to look for window['events'] and return undefined
	// instead of doing the require('events').

} else {

	// Custom web based implementation of EventEmitter
	EventEmitter = class EventEmitter {

		constructor() {
			this._events = {}
		}

		__getEventCallbacks(name) {
			return this._events[name] = this._events[name] || []
		}

		on(name, callback) {
			this.__getEventCallbacks(name).unshift(callback)
		}

		once(name, callback) {
			var oneTimeCb = (...args) => {
				this.removeListener(name, oneTimeCb)
				callback(...args)
			}
			this.on(name, oneTimeCb)
		}

		removeAllListeners(name) {
			delete this._events[name]
		}

		removeListener(name, callback) {
			remove(this.__getEventCallbacks(name), callback)
		}

		emit(name, ...args) {
			var callbacks = this.__getEventCallbacks(name)
			var i = callbacks.length
			while (i--) {
				callbacks[i](...args)
			}

		}

	}

}
