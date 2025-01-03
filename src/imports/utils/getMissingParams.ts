export default function getMissingParams(object: object, params: string[]) {
	return params.filter(param => object[param as keyof typeof object] == null);
}
