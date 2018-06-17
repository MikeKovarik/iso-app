import global from './global.mjs'


var keyBase = '__iso-app-preloaded-plugins__'

export function registerPlugin(name, Plugin) {
	if (Plugin === undefined) {
		Plugin = name
		name = 'App'
	}
	var key = keyBase + name
	var plugins = global[key] = global[key] || []
	console.log('registerPlugin', name, plugins)
	plugins.push(Plugin)
}

export function importPlugins(instanceOrClass) {
	if (instanceOrClass.prototype === undefined) {
		var instance = instanceOrClass
		var Class = instance.constructor
	} else {
		var Class = instanceOrClass
	}
	var name = Class.name
	var key = keyBase + name
	var plugins = global[key] = global[key] || []
	console.log('importPlugins', name, plugins)
	let mainProto = Class.prototype
	for (let Plugin of plugins) {
		let pluginProto = Plugin.prototype
		for (let name of Object.getOwnPropertyNames(pluginProto)) {
			if (name === 'constructor') continue
			if (name === 'pluginConstructor') continue
			if (!(name in mainProto)) {
				let desc = Object.getOwnPropertyDescriptor(pluginProto, name)
				Object.defineProperty(mainProto, name, desc)
			}
		}
		if (Plugin.prototype.pluginConstructor && instance)
			Plugin.prototype.pluginConstructor.call(instance)
	}
}
