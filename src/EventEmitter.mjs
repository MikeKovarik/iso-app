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