import platform from 'platform-detect'
import {plugin} from './plugin-core.mjs'


@plugin
export class ManifestPlugin {

	async pluginConstructor() {
		await this.loadManifest()
		this._readyPromises.push()
		if (platform.dev)
			this._manifestSanityCheck()
	}

	async loadManifest() {
		this.manifestMeta = document.head.querySelector('[rel="manifest"]')
		if (!this.manifestMeta) return
		this.manifest = await fetch(this.manifestMeta.href).then(res => res.json())
		if (!this.manifest) return
		this.name = this.manifest.short_name || this.manifest.name
		this.accent = this.manifest.theme_color || this.manifest.background_color
		if (this.manifest.icons)
			this.icon = this.manifest.icons.map(i => parseInt(i.sizes)).sort((a, b) => b - a).shift()
	}

	// Making Android's chrome happy can drive you mad. We're helping you check all
	// the boxes needed for the app to be installed as PWA, not just a bookmark.
	_manifestSanityCheck() {
		if (!this.manifest) return
		var {icons} = this.manifest
		if (!icons || !icons.some(i => i.sizes === '512x512'))
			console.warn(`manifest.json: property 'icons' should contain at least one icon of size 512x512.`)
		if (this.manifest.display !== 'standalone')
			console.warn(`manifest.json: property 'display' should be 'standalone'`)
		if (!this.manifest.name && !this.manifest.short_name)
			console.warn(`manifest.json should include property 'name' or 'short_name'`)
	}

}
