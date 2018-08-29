import './src/platforms.mjs'
import './src/plugin-ipc.mjs' // TODO: make another version where this is not included by default.
import App from './src/app.mjs'
var app = new App
// Expose instance internally for plugins.
import {internals} from './src/plugin-core.mjs'
internals.app = app
// This library is a singleton.
export default app