import platform from 'platform-detect'


export var nw
export var electron

if (platform.electron) {
	if (global && global.require)
		electron = global.require('electron')
	else if (typeof require === 'function')
		electron = require('electron')
}
if (platform.nwjs) {
	if (platform.hasWindow)
		nw = window.nw || require('nw.gui')
	else
		nw = global.nw
}


if (platform.electron) {

	var electronApp = electron.app || electron.remote.app
	// https://github.com/electron/electron/issues/3778#issuecomment-164135757
	if (platform.hasWindow)
		electron.remote.getCurrentWindow().removeAllListeners()
		
	// On OS X it is common for applications and their menu bar
	// to stay active until the user quits explicitly with Cmd + Q
	electronApp.on('window-all-closed', () => {
		electronApp.quit()
	})

}