import { WatermarkConfigSchema } from '@imports/types/watermark';
import { z } from 'zod';

export const StorageFileVersionCfg = z.object({
	width: z.number(),
	height: z.number(),
	name: z.string(),
	wm: z.boolean().optional(),
});
export type StorageFileVersionCfg = z.infer<typeof StorageFileVersionCfg>;

const CommonStorageProps = z.object({
	wm: WatermarkConfigSchema.optional(),
	thumbnail: z.object({ size: z.number().optional() }).optional(),
	maxFileSize: z.number().optional(),

	jpeg: z
		.object({
			quality: z.number().optional(),
			maxWidth: z.number().optional(),
			maxHeight: z.number().optional(),
		})
		.optional(),

	versions: z.array(StorageFileVersionCfg).optional(),
});

export const S3StorageCfg = CommonStorageProps.extend({
	type: z.literal('s3'),
	config: z.record(z.any()).optional(),
	bucket: z.string().optional(),
	publicUrl: z.string().optional(),
});

export const FSStorageCfg = CommonStorageProps.extend({
	type: z.literal('fs'),
	directory: z.string().optional(),
});

export const ServerStorageCfg = CommonStorageProps.extend({
	type: z.literal('server'),
	config: z.object({
		upload: z.string(),
		preview: z.string(),
		headers: z.record(z.string()).optional(),
	}),
});
