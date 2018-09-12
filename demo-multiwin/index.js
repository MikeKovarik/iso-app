// WARNING: do not change this condition in hope of simplifying it.
// The code is supposed to run in both console and frontend where the scripts are already loaded with <script>
// requiring them would load them again in electron and NW.JS where there's both window object and require function.
if (typeof window !== 'undefined') {
	var $ = document.querySelector.bind(document)
	var platform = window['platform-detect']
	var app = window['iso-app']
} else if (typeof require === 'function') {
	var $ = function() {}
	var platform = require('platform-detect')
	var app = require('iso-app')
}


var log
if (platform.hasWindow) {
	$log = $('#log')
	log = function(...args) {
		//console.log(...args)
		$log.innerHTML += args
			.map(obj => !!obj && JSON.stringify(obj))
			.join(' ') + '<br>'
	}
} else {
	log = console.log.bind(console)
}

app.on('message', message => log('received message', message))
app.on('foo', value => log('event:', 'foo', value))

