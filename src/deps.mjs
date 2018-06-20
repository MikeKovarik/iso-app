import platform from 'platform-detect'
import events from 'events'
import {remove} from './util.mjs'


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
