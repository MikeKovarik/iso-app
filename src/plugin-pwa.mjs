import platform from 'platform-detect'
import {registerPlugin} from './plugin-core.mjs'


export default class AppPwa {

	pluginConstructor() {
		this._getManifest()
		//this.serviceWorker = this.serviceWorker || this.backgroundScripts && this.backgroundScripts[0]
		//this._registerServiceWorker()
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

	async _registerServiceWorker() {
		if (!('serviceWorker' in navigator)) return
		if (!this.serviceWorker) return
		var reg = this.serviceWorkerReg = await navigator.serviceWorker.register(this.serviceWorker)
		console.log('reg.scope', reg.scope)
		window.isUpdateAvailable = new Promise(resolve => {
			reg.onupdatefound = () => {
				console.log('reg.onupdatefound', reg.onupdatefound)
				console.log('reg.installing', reg.installing)
				console.log('reg.installing.state', reg.installing.state)
				reg.installing.onstatechange = () => {
					console.log('reg.installing.onstatechange', reg.installing.onstatechange)
					console.log('reg.installing.state', reg.installing.state)
					if (reg.installing.state === 'installed') {
						if (navigator.serviceWorker.controller) {
							// new update available
							resolve(true)
						} else {
							// no update available
							resolve(false)
						}
					}
				}
			}
		})
	}

}

registerPlugin(AppTheme)

