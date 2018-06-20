// Based on work of inexorabletash
// https://gist.github.com/inexorabletash/52f437d1451d12145264
// Improved by Mike Kovarik to extended with support for UWP.
// For UWP to work, user has to manually keep track of opened windows and
// override static function _getWindowList() with function that returns list
// of open subscribed windows.
;(function() {

	if (window.BroadcastChannel) return

	window.BroadcastChannel = class BroadcastChannel {

		constructor(name) {
			this._name = String(name)
			this._KEY = `BC_SHIM_${this._name}`
			this._closed = false
			var mc = new MessageChannel()
			this._port1 = mc.port1
			this._port2 = mc.port2
			this._port1.start()
			this._port2.start()
			this._isUwp = typeof MSApp !== 'undefined' && typeof Windows !== 'undefined'
			if (this._isUwp) {
				this._thisWinId = MSApp.getViewId(window)
				window.addEventListener('message', this._onMessageEvent.bind(this))
			} else {
				window.addEventListener('storage', this._onStorageEvent.bind(this))
			}
		}

		_onMessageEvent(e) {
			if (this._KEY in e.data)
				this._port2.postMessage(e.data[this._KEY])
			// this is a master window, only one capable of receiving messages from child and posting messages to them.
			// chilren cannot communicate among themselves even if they get hold of each other's window object.
			// Passing the window object is possible through injecting code and calling methods on main window object
			// but it no messages will be passed.
			// Only way for children is to send messages to parent and the parent then redistributes them.
			// Also children cannot create sub children windows so there is always only one parent main window
			// capable of spawning and communicating.
			if (!window.opener)
				this._distributeMessage(e.data)
		}

		_onStorageEvent(e) {
			//if (e.storageArea !== localStorage) return
			if (!e.newValue || e.newValue.length === 0) return
			if (e.key.substring(0, this._KEY.length) !== this._KEY) return
			var data = JSON.parse(e.newValue)
			this._port2.postMessage(data)
		}

		_distributeMessage(data) {
			var windows = BroadcastChannel._getWindowList()
			console.log('windows', windows.length)
			for (var winDescriptor of windows) {
				if (winDescriptor.id !== data.from && winDescriptor.id != this._thisWinId)
					winDescriptor.window.postMessage(data, location.origin)
			}
		}

		// For use in UWP. User of shim has to replace this function
		static _getWindowList() {
			//return windows
			return [] // TODO
		}

		// BroadcastChannel API
		get name() {
			return this._name
		}

		postMessage(message) {
			if (this._closed)
				throw new Error('InvalidStateError')
			if (this._isUwp) {
				var data = {
					[this._KEY]: message,
					from: this._thisWinId
				}
				if (window.opener)
					window.opener.postMessage(data, location.origin)
				else
					this._distributeMessage(data)
			} else {
				var value = JSON.stringify(message)
				// Broadcast to other contexts via storage events...
				var key = `${this._KEY}_${Date.now()}_${Math.random().toString().slice(-4)}`
				localStorage.setItem(key, value)
				setTimeout(() => localStorage.removeItem(key), 500)
			}
		}

		close() {
			if (this._closed) return
			this._closed = true
			this._port1.close()
			this._port2.close()
		}

		// EventTarget API
		get onmessage() {
			return this._port1.onmessage
		}

		set onmessage(callback) {
			this._port1.onmessage = callback
		}

		addEventListener(...args) {
			return this._port1.addEventListener(...args)
		}

		removeEventListener(...args) {
			return this._port1.removeEventListener(...args)
		}

		dispatchEvent(...args) {
			return this._port1.dispatchEvent(...args)
		}

	}

}(self));