export var moduleName = 'iso-app'

export var asyncTimeout = (millis = 0) => new Promise(resolve => setTimeout(resolve, millis))

export function remove(array, item) {
	var index = array.indexOf(item)
	if (index !== -1)
		array.splice(index, 1)
}