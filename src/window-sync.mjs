import platform from 'platform-detect'
import {registerPlugin} from './plugin-core.mjs'
// TODO: might move arrayDiff here if it's not used by any other file
import {arrayDiff} from './window-util.mjs'


// TODO: some advanced logic to detect if and when to open broadcast channel
// why? we don't want unnecessary event emitting if the app only ever uses single window and no
// background process (most UWP and NW.JS* apps).
// Do not open BC if this is the main window (and somehow detect if there's a background process running, if so, open BC)
// Open BC if this window was opened by something else
// Open BC if this window is opening a new one (and BC isn't yet open)
// IMPORTANT: we also need to open BC to probe surrounding when window starts (reloads)

// TODO: heartbeat?


var wbc
if (typeof BroadcastChannel !== 'undefined')
	wbc = new BroadcastChannel('iso-app-win')
//var wbc = new BroadcastChannel('iso-app-win')

// TODO: figure out behavior for when to command is called from windoless process
var currentWindowId

function wbcSend(data) {
	data._from = currentWindowId
	wbc.postMessage(data)
}


registerPlugin('ManagedAppWindow', class WindowSync {

	pluginConstructor() {
		//console.log('pluginConstructor WindowSync')
		if (platform.electron || platform.nwjs)
			return
		//console.log('this.local', this.local)
		//console.log('this.isCurrentWindow', this.isCurrentWindow)
		if (this.local && this.isCurrentWindow) {
			this._wrapEventsForLocalSync()
			this._wrapMethodsForLocalSync()
		} else if (this.remote) {
			this._wrapEventsForRemoteSync()
			this._wrapMethodsForRemoteSync()
		}
	}

	_wrapEventsForLocalSync() {
		// Wrap event emitter
		this.emitLocal = this.emit
		this.emit = (name, ...args) => {
			//console.log('emit caught a', name)
			wbcSend({
				_from: this.id,
				_event: name,
				_args: args,
			})
			this.emitLocal(name, ...args)
		}
	}
	_wrapEventsForRemoteSync() {
		// Wrap event emitter
		this.emitLocal = this.emit
		this.emit = (name, ...args) => {
			//console.log('emit caught b', name)
			wbcSend({
				_from: currentWindowId,
				_to: this.id,
				_event: name,
				_args: args,
			})
			this.emitLocal(name, ...args)
		}
	}


	///////////////////////////////////////////////////////////////////////////
	// LOCAL
	///////////////////////////////////////////////////////////////////////////

	_wrapMethodsForLocalSync() {
		// NOTE: getOwnPropertyNames ensures we don't get EventEmitter's methods, but the plugin Classes
		//       should not be inheriting from anything.
		// Get list of all variables, functions and getter/setters in current window that needs to be wrapped.
		// Get both instance properties and prototype get/set & functions
		var properties = uniq(
				...Object.getOwnPropertyNames(this),
				...Object.getOwnPropertyNames(this.constructor.prototype)
			)
			// Filter out all the things we don't want to sync
			.filter(filterSyncableProperties)

		// Wrap all the properties, setters and functions, intercept each call or execution and broadcast it to other windows.
		for (let name of properties) {
			// Get descriptor of the thing.
			let desc = Object.getOwnPropertyDescriptor(this.constructor.prototype, name)
					|| Object.getOwnPropertyDescriptor(this, name)

			if ('value' in desc && typeof desc.value !== 'function') {

				// Instance variables.
				let {value, configurable, enumerable} = desc
				Object.defineProperty(this, name, {
					configurable, enumerable,
					get: () => value,
					set: newValue => {
						wbcSend({[name]: newValue})
						value = newValue
					}
				})

			} else if (desc.get && desc.set) {

				// Intercept setters.
				let {get, set, configurable, enumerable} = desc
				Object.defineProperty(this, name, {
					configurable, enumerable,
					get,
					set: newValue => {
						wbcSend({[name]: newValue})
						set.call(this, newValue)
					}
				})

			}

		}
	}


	///////////////////////////////////////////////////////////////////////////
	// REMOTE
	///////////////////////////////////////////////////////////////////////////

	_wrapMethodsForRemoteSync() {
		//console.log('_wrapRemoteForSync()')
		var proto = this.constructor.prototype
		Object.getOwnPropertyNames(proto)
			.filter(filterSyncableProperties)
			.filter(filterSyncableMethods)
			.forEach(name => {
				var desc = Object.getOwnPropertyDescriptor(proto, name)
				if ('value' in desc && typeof desc.value === 'function') {
					var method = desc.value
					this[name] = (...args) => {
						//console.log('INTERCEPT', name)
						wbcSend({
							_to: this.id,
							_call: name,
							_args: args,
						})
						return method.call(this, ...args)
					}
				}
			})
	}



})




registerPlugin(class {

	pluginConstructor() {
		//console.log('pluginConstructor Sync')
		if (wbc) {
			if (this.currentWindow)
				currentWindowId = this.currentWindow.id
			this._wbc = wbc
			this._wbc.onmessage = this._onBcMessage.bind(this)
			this._wbcSend = wbcSend
		}
	}

	_handleWindowScanRequest(data) {
		var hisIds = data._windows
		var myIds = this.windows.map(maw => maw.id)
		// Create new windows from IDs we've received and come to know.
		// The ManagedAppWindow will be hollow (not based on actual web window object, because we can't get hold of it)
		// and change its state based on broadcasted messages.
		var myMissingIds = arrayDiff(hisIds, myIds)
		if (myMissingIds.length)
			myMissingIds.map(id => this._getOrCreateMaw(id))
		// Notify the other side of windows we know of (and have access to).
		var hisMissingIds = arrayDiff(myIds, hisIds)
		if (hisMissingIds.length) {
			wbcSend({
				_to: data._from,
				_windows: this.windows.map(w => w.id)
			})
		}
	}

	_onBcMessage({data}) {
		// Safety check.
		// TODO: figure out behavior for when to command is called from windoless process
		//if (data._from === undefined) return
		if (data._from === this.currentWindow.id)
			return
		// Skip all messages with recipient that isn't this window.
		if (data._to !== undefined && data._to !== this.currentWindow.id)
			return

		//console.log('----------------- RECEIVED -----------------------------------')
		//console.log(data)

		// Some other window notified us its existence (usually right after its opened or refreshed)
		// and includes list of IDs of windows it already has access to (or knows of).
		if (Array.isArray(data._windows))
			return this._handleWindowScanRequest(data)
		if (data._to !== undefined)
			var maw = this._getOrCreateMaw(data._to)
		else if (data._from !== undefined)
			var maw = this._getOrCreateMaw(data._from)
		else
			return

		if (data._call) {
			// Someone wants to remotely call some function on the window it does not have handle for.
			//console.log('call', data._call, 'on', data._from)
			safeCall(maw, data._call, data._args)
		} else if (data._event) {
			//console.log('emit event', data._event, 'on', data._from)
			safeEmit(maw, data._event, data._args)
		} else {
			//console.log('apply snapshot of', data._from)
			// Received new values from the remote window. Apply them to local hollow image of the window.
			Object.keys(data)
				.filter(key => !key.startsWith('_') && key !== 'id')
				.forEach(key => maw[key] = data[key])
		}

	}

})

function safeCall(target, name, args = []) {
	if (target[name])
		target[name](...args)
}

function safeEmit(emitter, name, args = []) {
	if (emitter.emitLocal)
		emitter.emitLocal(name, ...args)
	else if (emitter.emit)
		emitter.emit(name, ...args)
}


// Do not sync functions that (educated guess) are just getters and do not actually change any internal value.
function filterSyncableMethods(name) {
	return !name.startsWith('get')
		&& !name.startsWith('is')
	//if (name.startsWith('get') && name[3] === name[3].toUpperCase()) return false
	//if (name.startsWith('is')  && name[2] === name[2].toUpperCase()) return false
	//return true
}

function filterSyncableProperties(name) {
	return !name.startsWith('_')
		&& name !== 'constructor'
		&& name !== 'setup'
		&& name !== 'id'
		&& name !== 'window'
		&& name !== 'document'
}

function uniq(...items) {
	return Array.from(new Set(items))
}