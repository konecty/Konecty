# Konecty API Documentation

Konecty provides a RESTful API for interacting with its platform. This documentation presents the main authentication methods and a representative set of endpoints to help you get started.

## Authentication

All requests that require authentication must include:

- An `Authorization` header with a valid token:
  ```http
  Authorization: <token>
  ```
- Or a cookie named `_authTokenId` with the session token:
  ```http
  Cookie: _authTokenId=<token>
  ```

Some endpoints (such as login) do not require authentication.

---

## Endpoints Overview

Below is a selection of key endpoints. For each, we show the HTTP method, URL, parameters, and example responses.

### 1. Authentication

#### Login
- **POST** `/rest/auth/login`
- **Body:**
  ```json
  {
    "user": "user@example.com",
    "password": "yourPassword"
  }
  ```
- **Success Response:**
  ```json
  {
    "success": true,
    "authId": "<token>",
    "user": { /* user info */ },
    "cookieMaxAge": 2592000
  }
  ```
- **Failure Response:**
  ```json
  {
    "success": false,
    "errors": [
      { "message": "Invalid credentials" }
    ]
  }
  ```

#### Logout
- **GET** `/rest/auth/logout`
- **Headers:** Requires authentication
- **Success Response:**
  ```json
  { "success": true }
  ```

#### Session Info
- **GET** `/rest/auth/info`
- **Headers:** Requires authentication
- **Success Response:**
  ```json
  { "success": true, "user": { /* user info */ } }
  ```

#### Request OTP
- **POST** `/api/auth/request-otp`
- **Body:** (exactly one of `phoneNumber` or `email` must be provided)
  ```json
  {
    "phoneNumber": "+5511999999999",
    "geolocation": {
      "longitude": -46.633309,
      "latitude": -23.550520
    },
    "resolution": {
      "width": 1920,
      "height": 1080
    },
    "source": "mobile-app",
    "fingerprint": "device-fingerprint-hash"
  }
  ```
  or
  ```json
  {
    "email": "user@example.com",
    "geolocation": {
      "longitude": -46.633309,
      "latitude": -23.550520
    },
    "resolution": {
      "width": 1920,
      "height": 1080
    },
    "source": "web",
    "fingerprint": "device-fingerprint-hash"
  }
  ```
  **Optional Fields** (same as traditional login):
  - `geolocation`: Object with `longitude` and `latitude` numbers, or JSON string
  - `resolution`: Object with `width` and `height` numbers, or JSON string
  - `source`: String (e.g., 'mobile-app', 'web')
  - `fingerprint`: String (device fingerprint hash)
  
  These fields are recorded in AccessFailedLog for audit and security purposes.
- **Success Response:**
  ```json
  {
    "success": true,
    "message": "OTP sent via whatsapp"
  }
  ```
- **Failure Response:**
  ```json
  {
    "success": false,
    "errors": [
      { "message": "User not found for this phone number" }
    ]
  }
  ```
- **Rate Limit:** 429 Too Many Requests if more than 5 requests per minute per phone/email

#### Verify OTP
- **POST** `/api/auth/verify-otp`
- **Body:** (exactly one of `phoneNumber` or `email` must be provided)
  ```json
  {
    "phoneNumber": "+5511999999999",
    "otpCode": "123456",
    "geolocation": {
      "longitude": -46.633309,
      "latitude": -23.550520
    },
    "resolution": {
      "width": 1920,
      "height": 1080
    },
    "source": "mobile-app",
    "fingerprint": "device-fingerprint-hash"
  }
  ```
  or
  ```json
  {
    "email": "user@example.com",
    "otpCode": "123456",
    "geolocation": {
      "longitude": -46.633309,
      "latitude": -23.550520
    },
    "resolution": {
      "width": 1920,
      "height": 1080
    },
    "source": "web",
    "fingerprint": "device-fingerprint-hash"
  }
  ```
  **Optional Fields** (same as traditional login):
  - `geolocation`: Object with `longitude` and `latitude` numbers, or JSON string
  - `resolution`: Object with `width` and `height` numbers, or JSON string
  - `source`: String (e.g., 'mobile-app', 'web')
  - `fingerprint`: String (device fingerprint hash)
  
  These fields are recorded in AccessLog for audit and security purposes.
- **Success Response:**
  ```json
  {
    "success": true,
    "logged": true,
    "authId": "<token>",
    "user": { /* user info */ }
  }
  ```
- **Failure Response:**
  ```json
  {
    "success": false,
    "errors": [
      { "message": "Invalid OTP code" }
    ]
  }
  ```
- **Notes:**
  - OTP code is 6 digits
  - OTP expires after configurable time (default: 5 minutes)
  - Maximum 3 verification attempts before OTP is invalidated
  - Delivery method: 
    - If requested by phone: WhatsApp → RabbitMQ (no email fallback)
    - If requested by email: Email only (skips WhatsApp)

---

### 2. Data (CRUD)

#### Get Record by ID
- **GET** `/rest/data/:document/:dataId`
- **Parameters:**
  - `:document` — Module name (e.g., `Contact`)
  - `:dataId` — Record ID
- **Headers:** Requires authentication
- **Success Response:**
  ```json
  { "success": true, "data": { /* record fields */ } }
  ```
- **Failure Response:**
  ```json
  { "success": false, "errors": [ { "message": "Not found" } ] }
  ```

#### Find Records (find)
- **GET** `/rest/data/:document/find`
- **Parameters:**
  - `:document` — Module name (e.g., `Contact`)

- **Query String:**
  - `filter` — Filter in JSON format, example: `{ "match": "and", "conditions": [] }`
  - `start` — Start index of results (default: 0)
  - `limit` — Maximum number of records to return (default: 25)
  - `sort` — Sorting in JSON format, example: `[ { "property": "code", "direction": "DESC" } ]`

- **Usage Example:**
  ```http
  GET /rest/data/Contact/find?filter={"match":"and","conditions":[]}&start=0&limit=25&sort=[{"property":"code","direction":"DESC"}]
  ```

- **Headers:** Requires authentication
- **Success Response:**
  ```json
  { "success": true, "data": [{ /* record fields */ }, { /* record fields */  }, ...] }
  ```
- **Failure Response:**
  ```json
  { "success": false, "errors": [ { "message": "Not found" } ] }
  ```

#### Create Record

🚧 Under construction

#### Update Records

🚧 Under construction

#### Delete Records

🚧 Under construction

---

### 3. History

#### List History

🚧 Under construction

---

### 4. Comments

#### List Comments

🚧 Under construction

#### Add Comment

🚧 Under construction

---

### 5. File Upload

#### Upload File

🚧 Under construction

#### Delete File

🚧 Under construction

---

### 6. Address Search

#### Search by ZIP Code

🚧 Under construction

#### Search by State Cities

🚧 Under construction

#### Search by City Neighborhoods

🚧 Under construction

#### Search by Streets

🚧 Under construction

---

## Error Handling

All endpoints return a boolean `success`. If `success` is `false`, an `errors` array is provided with error messages.

---

## Postman Collection

A Postman collection is available for testing the Konecty API endpoints, including OTP authentication.

### Importing the Collection

1. **Download the collection:**
   - Collection file: [`docs/postman/Konecty-API.postman_collection.json`](../postman/Konecty-API.postman_collection.json)
   - Environment file: [`docs/postman/Konecty-API.postman_environment.json`](../postman/Konecty-API.postman_environment.json)

2. **Import into Postman:**
   - Open Postman
   - Click **Import** button
   - Select both files (collection and environment)
   - Or drag and drop the files into Postman

3. **Configure Environment:**
   - Select the imported environment "Konecty Local Development"
   - Update `baseUrl` if your server is running on a different host/port
   - Set `authToken` after successful authentication (for authenticated endpoints)

### Collection Structure

The collection includes:

- **Authentication**
  - Login (traditional username/password)
  - **OTP Authentication**
    - Request OTP - Phone (with examples for WhatsApp, Email fallback, errors)
    - Request OTP - Email
    - Verify OTP - Phone (with examples for success, invalid code, expired, max attempts)
    - Verify OTP - Email

### Using the Collection

#### Testing OTP Authentication Flow

1. **Request OTP:**
   - Use "Request OTP - Phone" or "Request OTP - Email"
   - Update the `phoneNumber` or `email` in the request body
   - Send the request
   - Check the response for delivery method (whatsapp, email, etc.)

2. **Verify OTP:**
   - Check your phone/email for the 6-digit OTP code
   - Use "Verify OTP - Phone" or "Verify OTP - Email"
   - Enter the received OTP code in the `otpCode` field
   - Send the request
   - On success, save the `authId` token to the environment variable `authToken`

3. **Use Authenticated Endpoints:**
   - The `authToken` can be used in subsequent requests
   - Add it as an `Authorization` header: `Authorization: {{authToken}}`

### Examples

#### Example 1: OTP Authentication via Phone

```http
POST /api/auth/request-otp
Content-Type: application/json

{
  "phoneNumber": "+5511999999999"
}
```

**Response:**
```json
{
  "success": true,
  "message": "OTP sent via whatsapp"
}
```

Then verify:
```http
POST /api/auth/verify-otp
Content-Type: application/json

{
  "phoneNumber": "+5511999999999",
  "otpCode": "123456"
}
```

#### Example 2: OTP Authentication via Email

```http
POST /api/auth/request-otp
Content-Type: application/json

{
  "email": "user@example.com"
}
```

**Response:**
```json
{
  "success": true,
  "message": "OTP sent via email"
}
```

Then verify:
```http
POST /api/auth/verify-otp
Content-Type: application/json

{
  "email": "user@example.com",
  "otpCode": "123456"
}
```

### Collection Variables

- `baseUrl`: Base URL for API requests (default: `http://localhost:3000`)
- `authToken`: Authentication token (set after successful login/OTP verification)

### Response Examples

The collection includes multiple response examples for each endpoint:
- Success scenarios
- Error scenarios (user not found, invalid format, rate limit, expired OTP, etc.)
- Different delivery methods (WhatsApp, RabbitMQ, Email)

These examples help understand expected responses and error handling.

---


