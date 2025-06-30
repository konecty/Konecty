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


