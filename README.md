# Konecty

## Running

```
meteor npm install
meteor
```

## Kondata environment variables

- `KONECTY_MODE`: Can be `production` or `development`
- `KONDATA_ADMIN_USERNAME`: first user's username (default `admin`)
- `KONDATA_ADMIN_EMAIL`: first user's email (default `contact@konecty.com`)
- `KONDATA_ADMIN_PASSWORD`: first user's password (default `admin`)
- `KONDATA_ADMIN_NAME`: first user's name (default `Administrator`)
- `KONDATA_ADMIN_LOCALE`: first user's locale (default `en`)
- `BLOB_URL`: the URL where blob is running


## Konmeta environment variables

- `KONMETA_DB_URL`: specifies the external DB from where metaobjects must be read
- `KONMETA_UPDATE_SECRET`: the value to validate an update request against the `x-konmeta-secret` request header
- `KONMETA_NAMESPACE`: sets the current namespace which will receive meta updates


## Konsistent environment variables

- `DISABLE_KONSISTENT`: can be to `true` if you don't want Konsistent to run on the same process as Kondata. It's enabled by default.
- `DEFAULT_SMTP_HOST`: SMTP host for default email sender (**required**)
- `DEFAULT_SMTP_PORT`: SMTP port for default email sender (**required**)
- `DEFAULT_SMTP_USERNAME`: SMTP username for default email sender (**required**)
- `DEFAULT_SMTP_PASSWORD`: SMTP password for default email sender (**required**)
- `DEFAULT_SMTP_SECURE`: SMTP secure flag for default email sender
- `DEFAULT_SMTP_TLS`: SMTP tls flag for default email sender
- `DEFAULT_SMTP_IGNORE_TLS`: SMTP config `ignoreTLS` for nodemailer, if this is true and secure is false then TLS is not used even if the server supports STARTTLS extension
- `DEFAULT_SMTP_TLS_REJECT_UNAUTHORIZED`: SMTP config `tls.rejectUnauthorized` for nodemailer, config would open a connection to TLS server with self-signed or invalid TLS certificate
- `DEFAULT_SMTP_AUTH_METHOD`: SMTP config `authMethod` for nodemailer, defines preferred authentication method, defaults to ‘PLAIN’
- `DEFAULT_SMTP_DEBUG`: SMTP config `debug` for nodemailer, if set to true, then logs SMTP traffic, otherwise logs only transaction events

## How to run on Docker

```
docker pull konecty/konecty
docker run --name kondata -p 3000:3000 --link mongo --env MONGO_URL=mongodb://mongo:27017/konecty --env MONGO_OPLOG_URL=mongodb://mongo:27017/local konecty/konecty
```

## REST API

Examples of REST usage can be found here: [REST](REST.md)

## Logs
* KONDATA only log requests when ***status code*** of the response isn't 200 (OK).

#### Enable/Disable logs for all requests
```
kill -s SIGUSR2 PidID
```

Example

```
kill -s SIGUSR2 24502
```
