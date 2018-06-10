var platform = require('platform-detect')
var app = require('./node_modules/iso-app/index.js')


var url = 'index.html'
var options = {
	title: 'Anchora',
	position: 'center',
	width: 600,
	height: 500
}

app.on('ready', () => {
	app.open(options)
})

setTimeout(() => app.emit('ready'), 500)
