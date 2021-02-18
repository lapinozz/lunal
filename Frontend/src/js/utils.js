export function bindPrototypeMethods(obj) {
	const bindAll = (obj, prototype) =>
	{
		if(!(prototype && prototype instanceof Object))
		{
			return;
		}

		bindAll(obj, Object.getPrototypeOf(prototype));

		for(const propName of Object.getOwnPropertyNames(prototype))
		{
			if(propName === 'constructor') continue;

			const prop = prototype[propName];
			if(typeof prop !== 'function') continue;

			obj[propName] = prop.bind(obj);
		}
	};

	bindAll(obj, Object.getPrototypeOf(obj));
}
