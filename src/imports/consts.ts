import { TransactionOptions } from 'mongodb';

export const BCRYPT_SALT_ROUNDS = 10;
export const DEFAULT_LOGIN_EXPIRATION = 1000 * 60 * 60 * 24; // a day
export const MIN_PASSWORD_LENGTH = 1;
export const MAX_PASSWORD_LENGTH = 256;
export const GENERATED_PASSOWRD_LENGTH = 8;
export const DEFAULT_PAGE_SIZE = 50;

export const FILE_UPLOAD_MAX_FILE_SIZE = 1024 * 1024 * 1024; // 1GB
export const DEFAULT_JPEG_QUALITY = 80;
export const DEFAULT_JPEG_MAX_SIZE = 3840;
export const DEFAULT_THUMBNAIL_SIZE = 200;
export const DEFAULT_EXPIRATION = 31536000;
export const ALLOWED_CORS_FILE_TYPES = ['png', 'jpg', 'gif', 'jpeg', 'webp'];

export const WRITE_TIMEOUT = 3e4; // 30 seconds
export const TRANSACTION_OPTIONS: TransactionOptions = { readConcern: { level: 'majority' }, writeConcern: { w: 'majority', wtimeoutMS: WRITE_TIMEOUT } };
