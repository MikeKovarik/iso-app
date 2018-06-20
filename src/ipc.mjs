import platform from 'platform-detect'
import {registerPlugin} from './plugin-core.mjs'
import {EventEmitter} from './deps.mjs'
import {moduleName, remove} from './util.mjs'


class AppIpc {

	pluginConstructor() {
		this.emitLocal = EventEmitter.prototype.emit
		this._parseMessage = this._parseMessage.bind(this)
		if (typeof BroadcastChannel !== 'undefined') {
			this._bc = new BroadcastChannel(`${moduleName}-${this.name}`)
			this._bc.onmessage = e => this._parseMessage(e.data, e)
		}
		this._nodeEndpoints = []
		// additional API for plugins.
		this.on('_internal_ipc_', data => this._parseMessage(data))
	}

	// Register Node.js process or IPC object (or similarly shaped object).
	_registerNodeEndpoint(endpoint) {
		this._nodeEndpoints.push(endpoint)
		var killback = () => {
			remove(this._nodeEndpoints, endpoint)
			endpoint.removeListener('message', this._parseMessage)
		}
		endpoint.once('exit', killback)
		endpoint.once('close', killback)
		endpoint.on('message', this._parseMessage)
	}

	_parseMessage(data, e) {
		if (data._message) {
			this.emitLocal('message', data._message)
		} else if (data._event) {
			this.emitLocal(data._event, ...(data._args || []))
		} else {
			if (this.onmessage)
				this.onmessage(e || {data})
		}
	}

	_send(data) {
		if (this._bc)
			this._bc.postMessage(data)
		if (this._nodeEndpoints.length)
			this._nodeEndpoints.forEach(endpoint => endpoint.send(data))
	}

	// EventEmitter API

	emit(event, ...args) {
		this._send({_event: event, _args: args})
	}

	// Node IPC API

	send(message) {
		this._send({_message: message})
	}

	// EventTarget API

	postMessage(message) {
		this._send({_message: message})
	}

}

registerPlugin(AppIpc)