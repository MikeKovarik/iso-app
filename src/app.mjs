import platform from 'platform-detect'
import {EventEmitter} from './EventEmitter.mjs'
import {mixin} from './util.mjs'
import Window from './window.mjs'
import Ipc from './ipc.mjs'
import Theme from './theme.mjs'


if (platform.uwp) {
	var ViewManagement = Windows.UI.ViewManagement
	var uiViewSettings = ViewManagement.UIViewSettings.getForCurrentView()
	var systemNavigationManager = Windows.UI.Core.SystemNavigationManager.getForCurrentView()
	var uiSettings = new ViewManagement.UISettings()
	var {UserInteractionMode, UIColorType} = ViewManagement
}



class App extends mixin(EventEmitter, Window, Ipc, Theme) {

	canDetectWindowState = true
	canDetectSystemTheme = true

	constructor() {
		super()
	}

	importPlugin() {
	}

	// Force kill the app and all it's processes.
	kill() {
		if (platform.nwjs)
			nw.App.quit()
	}

}


export default new App