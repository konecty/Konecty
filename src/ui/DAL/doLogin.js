import { postJson } from './api';

export default data => postJson('/api/v1/auth/login', data);
