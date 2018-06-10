import platform from 'platform-detect'
import {EventEmitter, nw, electron} from './deps.mjs'


if (typeof self !== 'undefined' && typeof global === 'undefined')
	self.global = self

if (platform.electron) {
	// TODO: base the class on electrons? so the electron.app.something() thing can be replace with this.something()
	var electronApp = electron.app || electron.remote.app
	// https://github.com/electron/electron/issues/3778#issuecomment-164135757
	if (platform.hasWindow)
		electron.remote.getCurrentWindow().removeAllListeners()
}

//nw.App.getDataPath() => 'C:\Users\Mike\AppData\Local\demoapp\User Data\Default'


class App extends EventEmitter {

	constructor() {
		super()

		this.workers = [] // web workers, sub processed, background tasks, fulltrust processes

		var key = '__iso-app-preloaded-plugins__'
		if (global[key])
			global[key].forEach(this._importPlugin.bind(this))

		if (platform.electron && !platform.hasWindow) {
			this.autoClose = true
			// On OS X it is common for applications and their menu bar
			// to stay active until the user quits explicitly with Cmd + Q
			electronApp.on('window-all-closed', () => {
				if (this.autoClose)
					this.quit()
			})
		}
	}

	_importPlugin(Class) {
		var proto = Class.prototype
		var descriptors = Object.getOwnPropertyDescriptors(proto)
		delete descriptors.constructor
		delete descriptors.setup
		Object.defineProperties(this, descriptors)
		if (proto.setup)
			proto.setup.call(this)
	}

	// Force kill the app and all it's processes.
	quit() {
		this.emit('quit')
		setTimeout(() => {
			if (platform.nwjs)
				nw.App.quit()
			else if (platform.electron)
				electronApp.quit()
		})
	}

	// this should be moved to separate processes.js file (in a way windows.js works)
	get isMainProcess() {
		if (platform.nwjs) {
			// WARNING: NW.JS wraps main script (if used instead of main window) into empty HTML page.
			//          Even the main script has window, document and navigator object.
			return window.opener === undefined || window.opener === null
		} else if (platform.electron) {
			// TODO
			if (!platform.hasWindow)
				return undefined // TODO
			return false
		} else if (platform.node) {
			// TODO node
		} else {
			// No WebWorker is the main one.
			return false
		}
	}

}


// This library is a singleton
var app = new App
// Export as default
export default app
// Yeah I know. Each time you pollute global a kitten get strangled. I don't like it either,
// but this is required in order to make this lib modular without forcing the plugins to
// writing hundreds of code to handle UMD/require/ES import/import().
// JS Modules are hell. Deal with it.
global['__iso-app__'] = app