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

### Modern Login Page Development

If you're using the modern login page (`loginPageVariant: 'modern'`), the CSS will be automatically generated on first access in development mode. For faster development with CSS hot-reload, run in a separate terminal:

```bash
yarn dev:css
```

This will watch the Tailwind input file and regenerate CSS automatically when you modify the template.

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
-   `UI_URL`: host serving the **legacy Ext UI** assets referenced by `index.hbs` / login templates (`startup.js`, resources, ...)
-   `UI_PROXY`: (optional) `true` proxies **all** `GET` HTML traffic to `UI_PROXY_URL` and skips Konecty shell routes (`/` login pages). Prefer leaving this unset when serving legacy at `/` and the React gestor only under `UI_PROXY_PATH`.
-   `UI_PROXY_URL`: upstream origin for the **React gestor** SPA when proxied (e.g. Cloudflare Pages host). Build that SPA with `BASE_URL=/ui/` when using `UI_PROXY_PATH=/ui`.
-   `UI_PROXY_PATH`: mount path for the SPA proxy (e.g. `/ui`). Requires `UI_PROXY_URL`. Strip trailing slashes in env values.
-   `UI_NEW_UI_BROWSER_PATH`: (optional) Where the browser opens the React gestor. **Relative** paths (e.g. `/ui/`) stay on the Konecty host. **Absolute** `http(s)://...` forces that URL. If unset in **`KONECTY_MODE=development`** and `UI_PROXY_URL` is `http(s)://...`, "Nova interface" opens `UI_PROXY_URL` directly (typical local Vite on `:3001`). Set `UI_NEW_UI_BROWSER_PATH=/ui/` to keep `localhost:3000/ui/` in dev. Production keeps same-origin `/ui/` when this is unset and mode is not development.
-   `LOG_LEVEL`: [Pino log levels](https://github.com/pinojs/pino/blob/HEAD/docs/api.md#level-string)
-   `LOG_TO_FILE`: Optional file name to write all logs. Path relative to project root
-   `DISABLE_SENDMAIL`: (optional) `true` to disable email processing

### OTP Authentication (WhatsApp)

-   `WHATSAPP_ACCESS_TOKEN`: WhatsApp Business API access token
-   `WHATSAPP_PHONE_NUMBER_ID`: WhatsApp Business API phone number ID
-   `WHATSAPP_BUSINESS_ACCOUNT_ID`: (optional) WhatsApp Business Account ID
-   `WHATSAPP_TEMPLATE_ID`: WhatsApp template ID for OTP messages
-   `HAS_COPY_BUTTON`: (optional) Set to `true` if the WhatsApp template has a URL button that requires the OTP code as parameter. When enabled, the OTP code will be sent as the URL button parameter. Default: `false`. Priority: Namespace → env var → default

### Modern Login Page

-   `LOGIN_PAGE_VARIANT`: (optional) Login page variant. Values: `classic` (default) or `modern`. Priority: Namespace → env var → default
-   `OTP_EMAIL_ENABLED`: (optional) Enable OTP via email. Values: `true` or `false`. Priority: Namespace → env var → default `false`
-   `OTP_WHATSAPP_ENABLED`: (optional) Enable OTP via WhatsApp. Values: `true` or `false`. Priority: Namespace → env var → default `false`
-   `DEFAULT_LOCALE`: (optional) Default locale for login page. Values: `pt-BR` (default) or `en`. Priority: Namespace → env var → default `pt-BR`

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
