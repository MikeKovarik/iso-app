import platform from 'platform-detect'
import {EventEmitter} from './deps.mjs'
import {nw, electron} from './platforms.mjs'
import {asyncTimeout} from './util.mjs'
import {registerClass} from './plugin-core.mjs'



//nw.App.getDataPath() => 'C:\Users\Mike\AppData\Local\demoapp\User Data\Default'

if (platform.electron)
	var electronApp = electron.app || electron.remote.app


export default class App extends EventEmitter {

	constructor() {
		super()
		// Name of the app. To be replaced by user.
		// NOTE: necessary for discrete BroadcastChannel.
		this.name = undefined
		this._applyPlugins(this)
	}

	// Force kill the app and all it's processes.
	async quit() {
		this.emit('quit')
		await asyncTimeout()
		if (platform.electron)	electronApp.quit()
		else if (platform.nwjs)	nw.App.quit()
	}

}

registerClass(App)