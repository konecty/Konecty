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
export const TRANSACTION_OPTIONS = { readConcern: { level: 'majority' }, writeConcern: { w: 'majority', wtimeoutMS: WRITE_TIMEOUT } };

// OTP Authentication Constants
export const OTP_CODE_LENGTH = 6;
export const OTP_DEFAULT_EXPIRATION_MINUTES = 5;
export const OTP_MAX_VERIFICATION_ATTEMPTS = 3;
export const OTP_RATE_LIMIT_REQUESTS_PER_MINUTE = 5;
export const OTP_EXPIRATION_BUFFER_SECONDS = 60; // Buffer for TTL index cleanup (1 minute after expiration)
export const OTP_COUNTRY_CODE_SEARCH_CONCURRENCY = 3; // Maximum parallel country code searches
