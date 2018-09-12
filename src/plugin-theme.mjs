import platform from 'platform-detect'
import {plugin} from './plugin-core.mjs'


if (platform.uwp) {
	var ViewManagement = Windows.UI.ViewManagement
	var uiSettings = new ViewManagement.UISettings()
	var {UserInteractionMode, UIColorType} = ViewManagement
	//var uiViewSettings = ViewManagement.UIViewSettings.getForCurrentView()
	//var systemNavigationManager = Windows.UI.Core.SystemNavigationManager.getForCurrentView()
}

@plugin
export class AppTheme {

	pluginConstructor() {
		if (this.canDetectSystemTheme)
			this.detectSystemTheme()
	}

	get theme() {return this._theme}
	set theme(newValue) {
		this._theme = newValue
	}

	detectSystemTheme() {
		if (platform.uwp) {
			this.detectUwpTheme()
			uiSettings.addEventListener('colorvalueschanged', this.detectUwpTheme)
		}
	}

	detectUwpTheme() {
		var bg = uiSettings.getColorValue(UIColorType.background)
		var isDark = (bg.r + bg.g + bg.b) < 382
		this.theme = isDark ? 'dark' : 'light'
	}

}
