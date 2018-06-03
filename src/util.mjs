/*
export function autobind(ClassProto, methodName, descriptor) {
	var fn = descriptor.value
	return {
		configurable: true,
		get() {
			var bound = fn.bind(this)
			Object.defineProperty(this, methodName, {
				value: bound,
				configurable: true,
				writable: true
			})
			return bound
		}
	}
}
*/
export function mixin(...classes) {
	return classes.reduce((curr, next) => next(curr))
}