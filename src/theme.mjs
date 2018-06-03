import platform from 'platform-detect'


export default SuperClass => class extends SuperClass {

	constructor() {
		super()
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