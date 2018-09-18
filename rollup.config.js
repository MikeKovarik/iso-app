import fs from 'fs'
import babel from 'rollup-plugin-babel'
import notify from 'rollup-plugin-notify'


var pkg = JSON.parse(fs.readFileSync('package.json').toString())
var nodeCoreModules = require('repl')._builtinLibs
var external = [...nodeCoreModules, ...Object.keys(pkg.dependencies || {})]
var globals = objectFromArray(external)

var format = 'umd'

var plugins = [
	notify(),
	babel()
]

var files = [
	{
		input: './index.mjs',
		name: `${pkg.name}`,
	}, {
		input: './src/plugin-pwa.mjs',
		name: `${pkg.name}-pwa`,
	}, {
		input: './src/plugin-manifest.mjs',
		name: `${pkg.name}-manifest`,
	}, {
		input: './src/plugin-window.mjs',
		name: `${pkg.name}-window`,
	}, {
		input: './src/plugin-theme.mjs',
		name: `${pkg.name}-theme`,
	}, {
		input: './src/plugin-serviceworker.mjs',
		name: `${pkg.name}-serviceworker`,
	}, {
		input: './src/sw.mjs',
		name: `serviceworker`,
		format: 'iife',
	}/*, {
		input: './src/plugin-ipc.mjs',
		name: `${pkg.name}-plugin-ipc`,
	}, {
		input: './src/plugin-jumplist.mjs',
		name: `${pkg.name}-plugin-jumplist`,
	}*/
]

export default files.map(exp => ({
	input: exp.input,
	output: [{
		file: `${exp.name}.js`,
		name: exp.name,
		format: exp.format || format,
		globals,
	}],
	external,
	plugins,
}))

function objectFromArray(arr) {
	var obj = {}
	arr.forEach(moduleName => obj[moduleName] = moduleName)
	return obj
}