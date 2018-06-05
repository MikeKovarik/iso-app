class AppPlugin {
	setup() {
		// used instead of constructor()
	}
	bark() {
		console.log('bark')
	}
}

if (self['__iso-app__']) {
	// iso-app has been loaded, extend it.
	self['__iso-app__']._importPlugin(AppPlugin)
} else {
	// iso-app has not yet been loaded. Be there when it does.
	let key = '__iso-app-preloaded-plugins__'
	self[key] = self[key] || []
	self[key].push(AppPlugin)
}