import platform from 'platform-detect'
import {plugin} from './plugin-core.mjs'
import {getAbsolutePath} from './util.mjs'


@plugin
export class PwaPlugin {

	async pluginConstructor() {
		var metas = Array.from(document.getElementsByTagName('meta'))
		var viewport = metas.find(meta => meta.name === 'viewport')

		if (!viewport) {
			createHead('meta', {
				name: 'viewport',
				content: 'width=device-width, initial-scale=1, user-scalable=no',
			})
		}

		var icon = document.querySelector('link[rel="icon"]')
		if (!icon) {
			if (this.plugins.manifest) {
				await this.plugins.manifest
				var iconObject = this.manifest.icons[this.manifest.icons.length - 1]
				createHead('link', {
					rel: 'icon',
					sizes: iconObject.sizes,
					href: getAbsolutePath(this.manifestMeta.href, iconObject.src),
				})
			} else {
				console.warn([
					`Add meta tag 'icon' with a link to high-res png icon.`,
					`such as <link rel="icon" sizes="192x192" href="highres-icon.png">`
				].join('\n'))
			}
		}

		// Don't show warnings in production.
		if (!platform.dev) return
		// No need to show PWA warnings on any non-web platform.
		if (!platform.web && !platform.pwa) return

		//var manifest = metas.find(meta => meta.name === 'manifest')
		// [name]
		var themeColor = metas.find(meta => meta.name === 'theme-color')
		var capable = metas.find(meta => meta.name === 'mobile-web-app-capable')

		if (!themeColor)
			console.warn([
				`Add meta tag 'theme-icon' with your app's accent color.`,
				`<meta name="theme-color" content="#37474F">`,
			].join('\n'))

		if (!capable)
			console.warn([
				`Missing 'mobile-web-app-capable' meta tag. Cannot be registered as PWA app.`,
				`<meta name="mobile-web-app-capable" content="yes">`,
			].join('\n'))

		if (!this.plugins.serviceworker)
			console.warn('PWA app should include service worker script')

		if (!this.plugins.manifest)
			console.warn('PWA app should include manifest.json')
	}

}

function createHead(name, attrs) {
	let node = document.createElement(name)
	for (var [attr, val] of Object.entries(attrs))
		node.setAttribute(attr, val)
	document.head.appendChild(node)
}