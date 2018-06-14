import fs from 'fs'
import babel from 'rollup-plugin-babel'
import notify from 'rollup-plugin-notify'


var pkg = JSON.parse(fs.readFileSync('package.json').toString())
var nodeCoreModules = require('repl')._builtinLibs
var external = [...nodeCoreModules, ...Object.keys(pkg.dependencies || {})]
var globals = objectFromArray(external)


export default {
	treeshake: false,
	input: 'index.mjs',
	output: [{
		file: `index.js`,
		format: 'umd',
		name: pkg.name,
		globals,
	}, {
		file: `demoapp/node_modules/iso-app/index.js`,
		format: 'umd',
		name: pkg.name,
		globals,
	}],
	external,
	plugins: [
		notify(),
		babel({
			plugins: ['transform-class-properties'],
		})
	]
}

function objectFromArray(arr) {
	var obj = {}
	arr.forEach(moduleName => obj[moduleName] = moduleName)
	return obj
}