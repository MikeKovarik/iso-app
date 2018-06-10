import platform from 'platform-detect'


// TODO: handle the origins and maybe app id so that other
// tabs dont get the message if its a different app (using the
// same plugin)

export default class AppIpc {

	setup() {
		// Those objects that implement web's postMessage() and 'message'=>e.detail events.
		this.webIpcEndpoints = []
		// Those objects that implement node's send() and 'message'=>data events.
		this.nodeLikeIpcEndpoints = []
	}

	postMessage(object, origin = '*') {
		// TODO: wrap
		this.webIpcEndpoints.forEach(endpoint => endpoint.postMessage(object, origin))
		//this.nodeLikeIpcEndpoints.forEach(endpoint => endpoint.send(object))
	}

	send(object) {
		// TODO: wrap
		this.postMessage(object)
	}

	_onWebMessage(e) {
		var data = e.data || e.detail
		//e.origin
	}
/*
	emit(data) {
		//if (window.opener)
		//	window.opener.postMessage(data, '*')
	}
*/
	// todo. look at socket.io
	broadcast(data) {
		console.log('this.windows', this.windows)
		//var endpoints = this.windows.map(appwin => appwin.window)
		this.windows
			.map(appwin => appwin.window)
			.filter(window => window)
			.forEach(window => window.postMessage(data, '*'))
	}
	/*
	broadcast(data) {
		// to app ipc endpoints
		if (window.opener && !this.webIpcEndpoints.includes(window.opener))
			window.opener.postMessage(data, '*')
		this.postMessage(data)
	}
	*/

}

export var BroadcastChannel

if (global.BroadcastChannel) {
	BroadcastChannel = global.BroadcastChannel
} else {
	// TODO
	BroadcastChannel = class {
		postMessage() {}
	}
}