![Konecty](logo-konecty.png)

# Konecty Open source Tech Business Platform

> The Konecty documentation is available in:
> - [Português (pt-BR)](docs/pt-BR/index.md)
> - [English (en)](docs/en/index.md)
>
> The documentation covers main concepts, configuration, API, and usage examples for the Konecty platform.

## How to run local/development

You will need a mongodb database (you can use a free account at cloud.mongodb.com or a local mongodb install)

Create .env using the sample.

Fill MONGO_URL with your database url, adding authentication and options

MONGO_URL=mongodb+srv://login:password@konecty.mongodb.net/?appName=konecty

```
yarn
yarn start
```

If this is a empty database, basic metadata and starting collections will be automatically created.

The UI will be running at `localhost:3000`

## Konecty environment variables

-   `KONECTY_MODE`: Can be `production` or `development`
-   `DISABLE_KONSISTENT`: can be to `true` if you don't want Konsistent to run on the same process as Kondata. It's enabled by default.
-   `MONGO_URL`: Mongo database URL
-   `DISABLE_REINDEX`: can be to `true` if you don't want to verify if all index are created.
-   `ALLOWED_ORIGINS`: a list of cors alloweds URLs separated by `|`
-   `LOG_REQUEST=true`: if provide all requests are loggeds
-   `DEFAULT_SMTP_HOST`: SMTP host for default email sender (**required**)
-   `DEFAULT_SMTP_PORT`: SMTP port for default email sender (**required**)
-   `DEFAULT_SMTP_USERNAME`: SMTP username for default email sender (**required**)
-   `DEFAULT_SMTP_PASSWORD`: SMTP password for default email sender (**required**)
-   `DEFAULT_SMTP_SECURE`: SMTP secure flag for default email sender
-   `DEFAULT_SMTP_TLS`: SMTP tls flag for default email sender
-   `DEFAULT_SMTP_IGNORE_TLS`: SMTP config `ignoreTLS` for nodemailer, if this is true and secure is false then TLS is not used even if the server supports STARTTLS extension
-   `DEFAULT_SMTP_TLS_REJECT_UNAUTHORIZED`: SMTP config `tls.rejectUnauthorized` for nodemailer, config would open a connection to TLS server with self-signed or invalid TLS certificate
-   `DEFAULT_SMTP_AUTH_METHOD`: SMTP config `authMethod` for nodemailer, defines preferred authentication method, defaults to 'PLAIN'
-   `DEFAULT_SMTP_DEBUG`: SMTP config `debug` for nodemailer, if set to true, then logs SMTP traffic, otherwise logs only transaction events
-   `UI_URL`: host for ui
-   `LOG_LEVEL`: [Pino log levels](https://github.com/pinojs/pino/blob/HEAD/docs/api.md#level-string)
-   `LOG_TO_FILE`: Optional file name to write all logs. Path relative to project root

## FILE STORAGE API

-   `STORAGE`: Can be `s3` or `fs` for files and images uploads
-   `BLOB_URL`: (optional) if use external server for file upload
-   `PREVIEW_URL`: (optional) if use external file server

### s3 STORAGE SETTINGS

-   `S3_DOMAIN`: required if different of AWS eg: `digitaloceanspaces.com`
-   `S3_REGION`: S3 region
-   `S3_BUCKET`: S3 bucket
-   `S3_ACCESSKEY`: Generated for your aws account. Follow this instructions: [Where's My Secret Access Key?](https://aws.amazon.com/blogs/security/wheres-my-secret-access-key/).
-   `S3_SECREDKEY`: Generate with instructions above (👆).
-   `S3_PUBLIC_URL`: Bucket public url

### fs STORAGE SETTINGS

-   `STORAGE_DIR`: Filesystem directory for file storage

## How to run on Docker

```
docker pull konecty/konecty
docker run --name kondata -p 3000:3000 --link mongo --env MONGO_URL=mongodb://mongo:27017/konecty --env MONGO_OPLOG_URL=mongodb://mongo:27017/local konecty/konecty
```

## Namespace configuration

The namespace is made of many parts, documented at:

-   [Storage api](docs/en/internal/STORAGE.md)
-   [Resources and Events](docs/en/internal/RESOURCES_AND_EVENTS.md)

## Logs

-   KONDATA only log requests when **_status code_** of the response isn't 200 (OK).

---

# Contributors

<a href="https://github.com/konecty/konecty/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=konecty/konecty" />
</a>
