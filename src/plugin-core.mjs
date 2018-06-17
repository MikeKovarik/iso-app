import global from './global.mjs'


var keyBase = '__iso-app-preloaded-plugins__'

function getPlugins(name) {
	var key = keyBase + name
	return global[key] = global[key] || []
}

// All plugins have to be pre-registered before the target class is registered (and used)
export function registerPlugin(name, Plugin) {
	if (Plugin === undefined)
		[Plugin, name] = [name, 'App']
	var plugins = getPlugins(name)
	plugins.push(Plugin)
}

// Register class and extend it with all pre-registered plugins
export function registerClass(Class) {
	var plugins = getPlugins(Class.name)
	for (let Plugin of plugins)
		extendClass(Class, Plugin)
	Class.prototype._applyPlugins = function() {
		for (let Plugin of plugins) {
			if (Plugin.prototype.pluginConstructor && this)
				Plugin.prototype.pluginConstructor.call(this)
		}
	}
	return Class
}

function extendClass(Class, Plugin) {
	let mainProto = Class.prototype
	for (let key of Object.getOwnPropertyNames(Plugin.prototype)) {
		if (key === 'constructor') continue
		if (key === 'pluginConstructor') continue
		if (!(key in mainProto)) {
			let desc = Object.getOwnPropertyDescriptor(Plugin.prototype, key)
			Object.defineProperty(mainProto, key, desc)
		}
	}
}
