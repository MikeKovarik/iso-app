import platform from 'platform-detect'
import {registerPlugin} from './plugin-core.mjs'
// TODO: might move arrayDiff here if it's not used by any other file
import {arrayDiff} from './window-util.mjs'


registerPlugin('ManagedAppWindow', class WindowSync {

	pluginConstructor() {
		//console.log('pluginConstructor WindowSync')
	}

})


registerPlugin(class {

	pluginConstructor() {
		//console.log('pluginConstructor Sync')
		this._wbc = new BroadcastChannel('iso-app-win')
		this._wbc.onmessage = this._onBcMessage.bind(this)

		// TODO: some advanced logic to detect if and when to open broadcast channel
		// why? we don't want unnecessary event emitting if the app only ever uses single window and no
		// background process (most UWP and NW.JS* apps).
		// Do not open BC if this is the main window (and somehow detect if there's a background process running, if so, open BC)
		// Open BC if this window was opened by something else
		// Open BC if this window is opening a new one (and BC isn't yet open)
		// IMPORTANT: we also need to open BC to probe surrounding when window starts (reloads)
		this._canSync = platform.web || platform.pwa // TODO

		if (this._canSync)
			this._wrapCurrentWindowForSyncing() // TODO
	}


	_wrapCurrentWindowForSyncing() {
		let {currentWindow} = this
		// NOTE: getOwnPropertyNames ensures we don't get EventEmitter's methods, but the plugin Classes
		//       should not be inheriting from anything.
		// Get list of all variables, functions and getter/setters in current window that needs to be wrapped.
		// Get both instance properties and prototype get/set & functions
		let ManagedAppWindow = currentWindow.constructor
		let properties = uniq(
				...Object.getOwnPropertyNames(currentWindow),
				...Object.getOwnPropertyNames(ManagedAppWindow.prototype)
			)
			// Filter out all the things we don't want to sync
			.filter(name => {
				return !name.startsWith('_')
					&& name !== 'constructor' && name !== 'setup'
					&& name !== 'id' && name !== 'window' && name !== 'document'
			})
		// Wrap all the properties, setters and functions, intercept each call or execution and broadcast it to other windows.
		for (let name of properties) {
			// Get descriptor of the thing.
			let desc = Object.getOwnPropertyDescriptor(currentWindow, name)
					|| Object.getOwnPropertyDescriptor(ManagedAppWindow.prototype, name)
			if (typeof desc.value === 'function') {
				// TODO: currently this captures calling method here and calls in anywhere else. this is backwards
				//       this needs to listen on all other windows than current one and execute it there.
				// Do not sync functions that (educated guess) are just getters and do not actually change any internal value.
				if (name.startsWith('get') && name[3] === name[3].toUpperCase()) continue
				if (name.startsWith('is')  && name[2] === name[2].toUpperCase()) continue
				let origFnKey = '_' + name + '_original'
				currentWindow[origFnKey] = desc.value
				console.log('name', name)
				currentWindow[name] = (...args) => {
					console.log('INTERCEPT', name)
					this._callRemotely(name, args)
					return currentWindow[origFnKey](...args)
				}
			} else if ('value' in desc) {
				// Instance variables.
				let {value, configurable, enumerable} = desc
				Object.defineProperty(currentWindow, name, {
					configurable, enumerable,
					get: () => value,
					set: newValue => {
						this._updateValue(name, newValue)
						value = newValue
					}
				})
			} else if (desc.get && desc.set) {
				// Intercept setters.
				let {get, set, configurable, enumerable} = desc
				let origSetKey = '_' + name + '_setter'
				currentWindow[origSetKey] = set
				Object.defineProperty(currentWindow, name, {
					configurable, enumerable,
					get,
					set: newValue => {
						this._updateValue(name, newValue)
						currentWindow[origSetKey](newValue)
					}
				})
			}
		}
		// Wrap event emitter
		currentWindow.emitLocal = currentWindow.emit
		currentWindow.emit = (name, ...args) => {
			if (args.length) {
				this._emitRemotely(name, args)
				currentWindow.emitLocal(name, ...args)
			} else {
				this._emitRemotely(name)
				currentWindow.emitLocal(name)
			}
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
			this._sendBc({
				_to: data._from,
				_windows: this.windows.map(w => w.id)
			})
		}
	}

	_onBcMessage({data}) {
		// Safety check.
		if (data._from === undefined) return
		if (data._from === this.currentWindow.id) return
		// Skip all messages with recipient that isn't this window.
		if (data._to !== undefined && data._to !== this.currentWindow.id) return
		console.log('----------------- RECEIVED -----------------------------------')
		console.log(data)
		if (Array.isArray(data._windows)) {
			// Some other window notified us its existence (usually right after its opened or refreshed)
			// and includes list of IDs of windows it already has access to (or knows of).
			this._handleWindowScanRequest(data)
			return
		}
		var maw = this._getOrCreateMaw(data._from)
		if (data._call) {
			// Someone wants to remotely call some function on the window it does not have handle for.
			console.log('call', data._call, 'on', data._from)
			maw[data._call](...(data._args || []))
		} else if (data._event) {
			console.log('emit event', data._event, 'on', data._from)
			var args = data._args || []
			if (maw.emitLocal)
				maw.emitLocal(data._event, ...args)
			else if (maw.emit)
				maw.emit(data._event, ...args)
		} else if (data._heartbeat) {
			maw._onHeartbeat()
		} else {
			console.log('apply snapshot of', data._from)
			// Received new values from the remote window. Apply them to local hollow image of the window.
			Object.keys(data)
				.filter(key => !key.startsWith('_') && key !== 'id')
				.forEach(key => maw[key] = data[key])
		}

	}


	_sendBc(data) {
		data._from = this.currentWindow.id
		console.log('posting', data)
		this._wbc.postMessage(data)
	}

	_callRemotely(name, args) {
		console.log('_callRemotely', name, args)
		this._sendBc({
			_call: name,
			_args: args,
		})
	}

	_emitRemotely(name, args) {
		console.log('_emitRemotely', name, args)
		this._sendBc({
			_event: name,
			_args: args,
		})
	}

	_updateValue(name, value) {
		console.log('_updateValue', name, value)
		this._sendBc({
			[name]: value
		})
	}

	_sendSelfSnapshot() {
		// TODO
	}

})

function uniq(...items) {
	return Array.from(new Set(items))
}