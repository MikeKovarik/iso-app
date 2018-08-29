import platform from 'platform-detect'
import {registerPlugin} from './plugin-core.mjs'


export default class AppPwa {

	pluginConstructor() {
		console.log('AppPwa constructor')
		if (!('serviceWorker' in navigator)) return
		var manifestPromise = this._getManifest()
		this._readyPromises.push(manifestPromise)
		this.serviceWorker = this.serviceWorker || this.backgroundScripts && this.backgroundScripts[0] || 'serviceworker.js'
		//this._registerServiceWorker()
		//this.isUpdateAvailable.then(result => console.log(result ? 'UPDATE AVAILABLE' : 'UP TO DATE'))
	}

	async _getManifest() {
		var manifestMeta = document.head.querySelector('[rel="manifest"]')
		if (!manifestMeta) return
		this.manifest = await fetch(manifestMeta.href).then(res => res.json())
		this.name = this.manifest.name || this.manifest.short_name
		if (this.manifest.icons)
			this.icon = this.manifest.icons[this.manifest.icons.length - 1]
	}

	get serviceWorker() {
		return this._serviceWorkerPath
	}
	set serviceWorker(newPath) {
		this._serviceWorkerPath = newPath
		this._registerServiceWorker()
	}

	_registerServiceWorker() {
		if (!this.serviceWorker) return
		this.isUpdateAvailable = new Promise(async resolve => {
			var reg = await navigator.serviceWorker.register(this.serviceWorker)
			if (navigator.serviceWorker.controller)
				return resolve(false)
			reg.onupdatefound = () => {
				// Need to cache the object. It will be null on state change.
				var installing = reg.installing
				installing.onstatechange = () => {
					if (installing.state === 'installed') {
						resolve(navigator.serviceWorker.controller !== null)
						installing.onstatechange = null
					}
				}
			}
			this.serviceWorkerReg = reg
		})
	}

}

registerPlugin(AppPwa)

