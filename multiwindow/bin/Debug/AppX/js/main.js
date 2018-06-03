var $ = document.querySelector.bind(document)

var platform = {
	uwp: typeof Windows !== 'undefined',
}

if (platform.uwp) {
	var { ApplicationView, ApplicationViewSwitcher } = Windows.UI.ViewManagement
}

function log(...args) {
	console.log(...args)
	$('#log').innerHTML += args.join(' ') + '<br>'
}


// todo. work this into flexus app
class FlexusApp {

	constructor() {
		if (platform.uwp) {
			this.appView = ApplicationView.getForCurrentView()
		}

		// WARNING: Chrome uses null, Edge uses undefined.
		this.isMainView = window.opener === undefined || window.opener === null

		// ?
		this.windows = []
		this.workers = [] // web workers, sub processed, background tasks, fulltrust processes
		// Those objects that implement web's postMessage() and 'message'=>e.detail events.
		this.webIpcEndpoints = []
		// Those objects that implement node's send() and 'message'=>data events.
		this.nodeLikeIpcEndpoints = []
	}

	// APP

	get id() {
		if (platform.uwp)
			return this.appView.id
	}

	// WINDOW BASICS

	get title() {
		if (platform.uwp)
			return this.appView.title
		else
			return document.title
	}
	set title(newTitle) {
		if (platform.uwp)
			this.appView.title = newTitle
		else
			document.title = newTitle
	}

	openWindow(url = 'index.html', options) {
		if (!url.includes('://')) {
			if (platform.uwp)
				url = `ms-appx:///${url}`
			else if (platform.electron)
				url = `file://${__dirname}/${url}`
		}

		if (platform.electron) {
			newWindow.loadURL(url)
		} else {
			if (options)
				var optionsString = `width=${options.width},height=${options.height},left=${options.x},top=${options.y}`
			else
				var optionsString = undefined
			//var optionsString = `width=500,height=500,left=100,top=100`
			var newWindow = window.open(url, '_blank', optionsString)
			window.newWindow = newWindow
			/*
			var newId = MSApp.getViewId(newWindow)
			console.log('newId', newId)
			*/
			this.webIpcEndpoints.push(newWindow)
		}
		/*
		console.log('sent')
		ApplicationViewSwitcher.tryShowAsStandaloneAsync(newId).done(viewShown => {
			console.log('viewShown', viewShown)
		})
		return newWindow
		*/
	}

	// WINDOW POSITION & SIZE

	get x() { }
	set x(newX) { }

	get y() { }
	set y(newY) { }

	resize(width, height) {
		this.appView.tryResizeView({ width, height }) // it can fail
		/*
		//appView.setDesiredBoundsMode(Windows.UI.ViewManagement.ApplicationViewBoundsMode.useCoreWindow);

		// If you want to resize the app’s window size you can try to use:
		//appView.tryResizeView({ width: 600, height: 600 });

		//Besides, if you want to resize it when the application launched, try to use this code:
		ApplicationView.preferredLaunchViewSize = { width: 500, height: 500 };
		ApplicationView.preferredLaunchWindowingMode = Windows.UI.ViewManagement.ApplicationViewWindowingMode.preferredLaunchViewSize;
		//Don’t forget to set this property if you want to set a smaller size
		appView.setPreferredMinSize({ width: 200, height: 100 });
		*/
	}

	// IPC

	broadcast() {
		// to app ipc endpoints
		this.webIpcEndpoints
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

}

var app = new FlexusApp
//app.title = "new app title"


//var { } = Windows.ApplicationModel.Core


log('app.isMainView', app.isMainView)

window.addEventListener('message', e => {
	console.log('MESSAGE', e.data)
	log(e.data)
})


if (platform.uwp) {

	var appView = ApplicationView.getForCurrentView()

	setTimeout(() => {
		//console.log('parent', parent)
		console.log('appView', appView.id, appView)
	}, 500)

	appView.addEventListener('consolidated', e => {
		console.log('consolidated')
		if (!isMainView) {
			//window.close()
		}
	})

}



var winOptions = {
	width: 500,
	height: 500,
	x: 100,
	y: 100,
}


$('#open').addEventListener('click', () => app.openWindow(undefined, winOptions))
//$('#open').addEventListener('click', () => app.openWindow())

$('#to-opener').addEventListener('click', () => opener.postMessage('to opener', location.origin))
$('#to-newWindow').addEventListener('click', () => newWindow.postMessage('to newWindow', location.origin))

