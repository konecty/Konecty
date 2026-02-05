# Storage API Configuration

This document describes the configuration for the storage API, including details on storage type, file management, and image processing settings.
The files api is [located here](./src/server/routes/rest/file/).

## Configuration Structure

The storage API configuration is part of the [Namespace](./src/imports/model/Namespace.ts) configuration. In any given deployment, it is located at the Namespace document: `MetaObjects > { "_id": "Namespace" }`.

### Common Configuration Fields

All storage types share these common configuration options:

-   **wm**: Watermark configuration (optional). See [watermark.ts](./src/imports/types/watermark.ts) for details
-   **maxFileSize**: Maximum allowed file size in bytes (optional)
-   **thumbnail**: Thumbnail generation settings
    -   **size**: Size in pixels for thumbnails (optional)
-   **jpeg**: JPEG processing settings (optional)
    -   **quality**: JPEG quality (0-100)
    -   **maxWidth**: Maximum width in pixels
    -   **maxHeight**: Maximum height in pixels
-   **imageSizes**: Record of predefined image sizes (optional)
    -   Key: String identifier for the size configuration
    -   Value: Object containing:
        -   **width**: Width in pixels
        -   **height**: Height in pixels
        -   **wm**: Whether to apply watermark for this size (optional)

### Storage Types

#### Local Filesystem Storage

```json
{
	"storage": {
		"type": "fs",
		"directory": "/kon-files",

		"imageSizes": {
			"sm": {
				"width": 150,
				"height": 150,
				"wm": false
			},
			"md": {
				"width": 800,
				"height": 600,
				"wm": true
			}
		}
	}
}
```

#### S3 Storage

```json
{
	"storage": {
		"type": "s3",
		"bucket": "my-bucket",
		"publicUrl": "https://cdn.example.com",
		"config": {
			"endpoint": "https://s3.us-west-002.backblazeb2.com",
			"region": "us-east-1",
			"credentials": {
				"accessKeyId": "YOUR_ACCESS_KEY",
				"secretAccessKey": "YOUR_SECRET_KEY"
			},
			"requestChecksumCalculation": false,
			"responseChecksumValidation": false
		},
		"maxFileSize": 1073741824,
		"thumbnail": {
			"size": 200
		}
	}
}
```

#### External Server Storage

```json
{
	"storage": {
		"type": "server",
		"config": {
			"upload": "https://storage.example.com/upload",
			"preview": "https://storage.example.com/preview",
			"headers": {
				"Authorization": "Bearer token123"
			}
		},
		"maxFileSize": 1073741824,
		"thumbnail": {
			"size": 200
		}
	}
}
```

## Kubernetes Configuration

When using local filesystem storage (`type: "fs"`), the storage directory must be configured as a volume in Kubernetes:

```yaml
spec:
    containers:
        - name: konecty
          image: konecty/konecty:2.1.9
          volumeMounts:
              - name: files-folder
                mountPath: /kon-files
    volumes:
        - name: files-folder
          emptyDir: {}
```

For production environments, consider using a persistent volume instead of `emptyDir` to prevent data loss during pod restarts.
