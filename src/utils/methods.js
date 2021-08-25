import isObject from 'lodash/isObject';

const Middlewares = {};
const BeforeMethods = {};
const AfterMethods = {};
const Methods = {};

const registerAfterMethod = function (name, method) {
	if (AfterMethods[name] != null) {
		console.error(`[konecty:methods] Duplicated after method: ${name}`.red);
	}
	return (AfterMethods[name] = method);
};

const registerBeforeMethod = function (name, method) {
	if (BeforeMethods[name] != null) {
		console.error(`[konecty:methods] Duplicated before method: ${name}`.red);
	}
	return (BeforeMethods[name] = method);
};

const registerMiddleware = function (name, method) {
	if (Middlewares[name] != null) {
		console.error(`[konecty:methods] Duplicated middleware: ${name}`.red);
	}
	return (Middlewares[name] = method);
};

const registerMethod = function () {
	const args = Object.values(arguments);
	const name = args[0];
	const middlewareNames = args.slice(1, -1);
	const mainMethod = args[args.length - 1];

	const middlewares = [];
	for (const middlewareName of middlewareNames) {
		const middleware = Middlewares[middlewareName];
		if (middleware == null) {
			console.error(`[konecty:methods] Middleware not registered: ${middlewareName}`.red);
		} else {
			middlewares.push(middleware);
		}
	}

	Methods[name] = async function () {
		const lastArgument = arguments[arguments.length - 1];

		const scope = this;
		scope.__methodName__ = name;
		if (this.connection === null && isObject(lastArgument) && isObject(lastArgument.__scope__)) {
			const _ref = lastArgument.__scope__;
			for (const key in _ref) {
				if (scope[key] == null) {
					scope[key] = _ref[key];
				}
			}
		}

		const processAfterMethods = async function (result, args) {
			for (const afterMethodName in AfterMethods) {
				const afterMethod = AfterMethods[afterMethodName];
				const afterMethodParams = {
					result,
					arguments: args,
				};
				const afterMethodResult = await afterMethod.call(scope, [afterMethodParams]);
				if (afterMethodResult != null) {
					return afterMethodResult;
				}
				return afterMethodParams.result;
			}
		};

		for await (const beforeMethod of Object.values(BeforeMethods)) {
			const result = await beforeMethod.call(scope, ...arguments);
			if (result != null) {
				return await processAfterMethods(result, arguments);
			}
		}

		for await (const middleware of middlewares) {
			const result = await middleware.call(scope, ...arguments);
			if (result != null) {
				return await processAfterMethods(result, arguments);
			}
		}

		const result = await mainMethod.apply(scope, arguments);
		return await processAfterMethods(result, arguments);
	};
};

const callMethod = async (name, ...params) => {
	if (Methods[name] != null) {
		const result = await Methods[name].apply(Methods[name], params);
		return result;
	}
	throw new Error(`Method ${name} not found`);
};

const methodExists = methodName => Methods[methodName] != null;

export { callMethod, registerAfterMethod, registerBeforeMethod, registerMiddleware, registerMethod, methodExists };
