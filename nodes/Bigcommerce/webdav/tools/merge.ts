export function cloneShallow<T extends Object>(obj: T): T {
	return isPlainObject(obj)
		? Object.assign({}, obj)
		: Object.setPrototypeOf(Object.assign({}, obj), Object.getPrototypeOf(obj));
}

function isPlainObject(obj: Object | any): boolean {
	if (
		typeof obj !== 'object' ||
		obj === null ||
		Object.prototype.toString.call(obj) != '[object Object]'
	) {
		// Not an object
		return false;
	}
	if (Object.getPrototypeOf(obj) === null) {
		return true;
	}
	let proto = obj;
	// Find the prototype
	while (Object.getPrototypeOf(proto) !== null) {
		proto = Object.getPrototypeOf(proto);
	}
	return Object.getPrototypeOf(obj) === proto;
}

export function merge(...args: Object[]) {
	let output = null,
		items = [...args];
	while (items.length > 0) {
		const nextItem = items.shift() as Object;
		if (!output) {
			output = cloneShallow(nextItem);
		} else {
			output = mergeObjects(output, nextItem);
		}
	}
	return output;
}

function mergeObjects(obj1: Object, obj2: Object): Object {
	const output: any = cloneShallow(obj1);
	Object.keys(obj2).forEach((key) => {
		if (!output.hasOwnProperty(key)) {
			// @ts-ignore
			output[key] = obj2[key];
			return;
		}
		// @ts-ignore
		if (Array.isArray(obj2[key])) {
			// @ts-ignore
			// @ts-ignore
			output[key] = Array.isArray(output[key])
				? // @ts-ignore
					[...output[key], ...obj2[key]]
				: // @ts-ignore
					[...obj2[key]];
		} else {
			// @ts-ignore
			if (typeof obj2[key] === 'object' && !!obj2[key]) {
				output[key] =
					typeof output[key] === 'object' && !!output[key]
						? // @ts-ignore
							mergeObjects(output[key], obj2[key])
						: // @ts-ignore
							cloneShallow(obj2[key]);
			} else {
				// @ts-ignore
				output[key] = obj2[key];
			}
		}
	});
	return output;
}
