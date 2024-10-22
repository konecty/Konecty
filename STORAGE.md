# Storage API Configuration

This document describes the configuration for the storage API, including details on storage type, file management, and image processing settings.
The files api is [located here](./src/server/routes/rest/file/).

## Configuration Structure

The storage API configuration is part of the [Namespace](./src/imports/model/Namespace.ts) configuration. In any given deployment, it is located at the Namespace document: `MetaObjects > { "_id": "Namespace" }`, and is structured as the following example:

```json
{
	"storage": {
		"type": "local",
		"directory": "/kon-files",
		"wm": null,
		"maxFileSize": 1073741824,
		"thumbnail": {
			"size": 200
		},
		"jpeg": {
			"maxWidth": 3840,
			"maxHeight": 3840,
			"quality": 80
		}
	}
}
```

### Fields

-   **type**: The type of storage being used. In this configuration, it is set to `"local"`, indicating that files are stored on the local filesystem. Its options can be:
    -   **s3**
    -   **local**
-   **directory**: The directory where files will be stored, in the local filesystem. In this case, it is set to `"/kon-files"`.

-   **wm**: This field is reserved for watermarking functionality. In this case set to `null` meaning no Watermark. The field type is described at [src/imports/types/watermark.ts](./src/imports/types/watermark.ts)

-   **maxFileSize**: The maximum allowed file size for uploads, specified in bytes. Here, it is set to `1073741824` bytes (1 GB).

-   **thumbnail**: Configuration for generating thumbnails.

    -   **size**: The size of the thumbnails, set to `200` pixels (width and height).

-   **jpeg**: Configuration for processing JPEG images.
    -   **maxWidth**: The maximum width for JPEG images, set to `3840` pixels.
    -   **maxHeight**: The maximum height for JPEG images, set to `3840` pixels.
    -   **quality**: The quality of JPEG images after processing, with a value of `80` (on a scale from 0 to 100).

## Kubernetes CI YAML Configuration

When using the local filesystem, for deployment in a Kubernetes environment, the folder must be made a volume, so it can have the correct permissions.

```yaml
spec:
      containers:
        - name: konecty
          image: konecty/konecty:2.1.9

          (...)

          volumeMounts:
            - name: files-folder
              mountPath: /kon-files

      volumes:
        - name: files-folder
          emptyDir: {}
```

### Explanation

-   **volumeMounts**: This section defines where the volumes should be mounted in the container.

    -   **name**: The name of the volume, here called `files-folder`.
    -   **mountPath**: The path inside the container where the volume should be mounted. This matches the directory in the storage configuration (`/kon-files`).

-   **volumes**: This section defines the volumes available to the pod.
    -   **name**: The name of the volume, corresponding to the volume mount.
    -   **emptyDir**: This specifies that the volume is an empty directory, which exists only as long as the pod is running. It is used for temporary storage.
