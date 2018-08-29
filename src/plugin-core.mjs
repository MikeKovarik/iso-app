import global from './global.mjs'
import {moduleName} from './util.mjs'


var key = `__${moduleName}-internals__`
export var internals = global[key] = global[key] || {registerPlugin}

function getPlugins(name) {
	var key = name === 'App' ? 'plugins' : `plugins${name}`
	return internals[key] = internals[key] || []
}

// All plugins have to be pre-registered before the target class is registered (and used)
export function registerPlugin(targetClassName, Plugin) {
	if (Plugin === undefined)
		[targetClassName, Plugin] = ['App', targetClassName]
	console.log('registerPlugin()', Plugin.name)
	// TODO: make this work with other classes too (ManagedAppWindow)
	if (internals.app) {
		console.log('app created')
		// App instance was already created before this plugin was loaded.
		// Patch it in.
		applyPlugin(internals.app, Plugin)
	} else {
		console.log('app not yet created')
		// Plugin was loaded before the App was instatiated. Add the plugin to the list.
		var plugins = getPlugins(targetClassName)
		plugins.push(Plugin)
	}
}

function applyPlugin(instance, Plugin) {
	try {
		extendClass(instance.constructor, Plugin)
		var ctor = Plugin.prototype.pluginConstructor
		if (ctor && instance)
			ctor.call(instance)
	} catch(err) {
		console.error(moduleName, `Plugin ${Plugin.name} failed`, err)
	}
}

// Register class and extend it with all pre-registered plugins
export function registerClass(Class) {
	var plugins = getPlugins(Class.name)
	for (let Plugin of plugins)
		extendClass(Class, Plugin)
	Class.prototype._applyPlugins = function() {
		for (let Plugin of plugins)
			applyPlugin(this, Plugin)
	}
}

function extendClass(Class, Plugin) {
	// Static
	for (let key of Object.getOwnPropertyNames(Plugin)) {
		if (key === 'prototype') continue
		extendKey(Class, Plugin, key)
	}
	// Prototype
	for (let key of Object.getOwnPropertyNames(Plugin.prototype)) {
		if (key === 'constructor' || key === 'pluginConstructor') continue
		extendKey(Class.prototype, Plugin.prototype, key)
	}
}

function extendKey(Target, Source, key) {
	let desc = Object.getOwnPropertyDescriptor(Source, key)
	Object.defineProperty(Target, key, desc)
}