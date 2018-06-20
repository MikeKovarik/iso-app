if (typeof require === 'function') {
	var $ = function() {}
	var platform = require('platform-detect')
	var app = require('iso-app')
} else {
	var $ = document.querySelector.bind(document)
	var platform = window['platform-detect']
	var app = window['iso-app']
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

