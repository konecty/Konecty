import get from 'lodash/get';

export default function getMissingParams(object: object | null | undefined, params: string[]) {
	return params.filter(param => get(object, param) == null);
}
