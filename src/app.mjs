import platform from 'platform-detect'
import {EventEmitter} from './EventEmitter.mjs'


//nw.App.getDataPath() => 'C:\Users\Mike\AppData\Local\demoapp\User Data\Default'

class App extends EventEmitter {

	constructor() {
		super()
		this.canDetectWindowState = true
		this.canDetectSystemTheme = true

		this.workers = [] // web workers, sub processed, background tasks, fulltrust processes

		var key = '__iso-app-preloaded-plugins__'
		if (self[key])
			self[key].forEach(this._importPlugin.bind(this))
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
	kill() {
		if (platform.nwjs)
			nw.App.quit()
	}
/*
	get id() {
		if (platform.uwp)
			return this.appView.id
	}
*/

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
self['__iso-app__'] = app