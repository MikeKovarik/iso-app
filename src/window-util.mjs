import platform from 'platform-detect'
import {EventEmitter, nw, electron} from './deps.mjs'


export var BrowserWindow
if (platform.electron) {
	BrowserWindow = electron.BrowserWindow || electron.remote.BrowserWindow
}

// Safe functions for detection of object type across mixed contexts (mainly in NW.JS)
// Tried to use local context's classes and falls back to general object shape detection.
export function isAppWindow(object) {
	return object.constructor.name === 'AppWindow'
		&& object.innerBounds !== undefined
		&& object.outerBounds !== undefined
		&& object.setAlwaysOnTop !== undefined
}

export function isNWWindow(object) {
	return object.constructor.name === 'NWWindow'
		&& object.appWindow !== undefined
		&& object.setAlwaysOnTop !== undefined
		&& object.frameId !== undefined
		&& object.setAlwaysOnTop !== undefined
		&& object.isKioskMode !== undefined
		&& object.menu !== undefined
}

export function isBrowserWindow(object) {
	return object instanceof BrowserWindow
		|| object.constructor.name === 'BrowserWindow' && typeof object.setAlwaysOnTop === 'function'
}

// WARNING: It'd be easier to do 'instanceof Window' or .constructor.name === 'Window' but that's impossible
//          due to mixing contexts and quirky restrictions of UWP.
export function isWindow(object) {
	return object
		&& object.setTimeout !== undefined
		&& object.location !== undefined
		&& object.addEventListener !== undefined
		&& object.HTMLElement !== undefined
}

export function getWindowOpener(win) {
	if (platform.nwjs)
		return win.opener && win.opener.opener
	else
		return win.opener
}

export function getRandomWindowId() {
	return parseInt(Date.now().toString().slice(-4))
	//return Math.floor(Math.random() * 10000)
}

export class ArraySet extends Array {
	add(item) {
		if (this.includes(item)) return
		this.push(item)
	}
	has(item) {
		return this.includes(item)
	}
	delete(item) {
		removeArrayItem(this, item)
	}
	get size() {
		return this.length
	}
	map(...args) {
		return Array.from(this).map(...args)
	}
	filter(...args) {
		return Array.from(this).filter(...args)
	}
}

export function sanitizeUrl(url) {
	if (!url) return url
	if (!url.includes('://')) {
		if (platform.uwp)
			return `ms-appx:///${url}`
		//else if (platform.electron)
		//	return `file://${__dirname}/${url}`
	}
	return url
}

export function removeArrayItem(arr, item) {
	var index = arr.indexOf(item)
	if (index === -1) return
	arr.splice(index, 1)
}

export function removeArrayItems(arr, items) {
	items.forEach(item => removeArrayItem(arr, item))
}

export function arrayDiff(arr, items) {
	var output = arr.slice(0)
	removeArrayItems(output, items)
	return output
}