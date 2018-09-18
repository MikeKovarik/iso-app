export var isOffline
export var prefferCache
export var allowCacheRefresh

if (navigator.connection) {
	// NetworkInformation API available
	var conn = navigator.connection
	conn.addEventListener('change', updateNetInfo)
} else {
	// Not available here. Shim it at least.
	var isMobile
	var conn = {
		saveData: isMobile,
		type: isMobile ? 'cellular' : 'wifi',
		downlink: isMobile ? 2 : 10,
	}
}

updateNetInfo()

function updateNetInfo() {
	isOffline = conn.type === 'none'
			|| conn.downlink === 0
			|| conn.downlinkMax === 0
	prefferCache = isOffline
			|| conn.saveData
			|| conn.type === 'cellular'
			|| conn.type === 'none'
			|| conn.effectiveType === 'slow-2g'
			|| conn.effectiveType === '2g'
			|| conn.downlink < 1
			|| conn.downlinkMax < 1
	allowCacheRefresh = conn.type !== 'cellular'
}