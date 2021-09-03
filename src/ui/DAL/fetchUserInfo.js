import { getJson } from './api';

export default () => getJson('/api/v1/auth/info');
