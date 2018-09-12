import platform from 'platform-detect'
import {EventEmitter} from './deps.mjs'
import {moduleName, remove} from './util.mjs'
import {electron} from './platforms.mjs'
import {plugin} from './plugin-core.mjs'


var EVENT = '__event__'
var ARGS = '__args__'
var MESSAGE = '__message__'
var electronEventName = `__${moduleName}__ipc__`


/*
╔══════════╗                  ╔══════════╗
║          ╟──────────────────╢          ║
║  window  ║ BroadcastChannel ║  window  ║
║          ╟──────────────────╢          ║
╚═══╤═══╤══╝                  ╚══╤═══╤═══╝
    │IPC│                        │IPC│
╔═══╧═══╧════════════════════════╧═══╧═══╗
║          electron main process         ║
╚════════════════════════════════════════╝
*/


@plugin
export class AppIpc {

	pluginConstructor() {
		this.emitLocal = EventEmitter.prototype.emit
		this._parseMessage = this._parseMessage.bind(this)
		if (typeof BroadcastChannel !== 'undefined') {
			this._bc = new BroadcastChannel(`${moduleName}-${this.name}`)
			this._bc.onmessage = e => this._parseMessage(e.data, e)
		}
		if (platform.electron) {
			// WARNING: Electron's IPC objects are not like any other node process, stream or emitter.
			// ipc.send takes two arguments (eventname and data) and behaves like usual emit() would.
			this.electronIpc = electron.ipcRenderer || electron.ipcMain
			this.electronIpc.on(electronEventName, (e, data) => this._parseMessage(data, e))
		}
		this._nodeEndpoints = []

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
		if (data[EVENT]) {
			this.emitLocal(data[EVENT], ...(data[ARGS] || []))
		} else {
			if (data[MESSAGE])
				data = data[MESSAGE]
			this.emitLocal('message', data)
			if (this.onmessage)
				this.onmessage(e || {data})
		}
	}

	_send(data) {
		if (this._bc)
			this._bc.postMessage(data)
		if (this.electronIpc && this.electronIpc.send)
			this.electronIpc.send(electronEventName, data)
		if (this._nodeEndpoints.length)
			this._nodeEndpoints.forEach(endpoint => endpoint.send(data))
	}

	// EventEmitter API

	emit(event, ...args) {
		this._send({
			[EVENT]: event,
			[ARGS]: args
		})
		this.emitLocal(event, ...args)
	}

	// Node IPC API

	send(message) {
		this._send({
			[MESSAGE]: message
		})
	}

	// EventTarget API

	postMessage(message) {
		this.send(message)
	}

}