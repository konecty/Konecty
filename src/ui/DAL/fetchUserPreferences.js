import { getJson } from './api';

export default () => getJson('/api/v1/data/Preference/find?limit=1000');
