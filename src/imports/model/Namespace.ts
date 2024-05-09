import { WatermarkConfigSchema } from '@imports/types/watermark';
import { z } from 'zod';

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
});

const S3Storage = CommonStorageProps.extend({
	type: z.literal('s3'),
	config: z.record(z.any()).optional(),
	bucket: z.string().optional(),
	publicUrl: z.string().optional(),
});

const FSStorage = CommonStorageProps.extend({
	type: z.literal('fs'),
	directory: z.string().optional(),
});

export const NamespaceSchema = z
	.object({
		type: z.literal('Namespace'),
		trackUserGeolocation: z.boolean().optional(),
		loginExpiration: z.number().optional(),
		dateFormat: z.string().optional(),

		storage: z.discriminatedUnion('type', [S3Storage, FSStorage]).optional(),
		RocketChat: z
			.object({
				accessToken: z.string(),
				livechat: z
					.object({
						token: z.string(),
						campaign: z.object({ _id: z.string() }).optional(),
						queue: z.object({ _id: z.string() }).optional(),
						saveCampaignTarget: z.boolean().optional(),
					})
					.optional(),
			})
			.optional(),

		plan: z
			.object({
				features: z
					.object({
						createHistory: z.boolean().optional(),
						updateInheritedFields: z.boolean().optional(),
						updateReverseLookups: z.boolean().optional(),
						updateRelations: z.boolean().optional(),
					})
					.optional(),
				useExternalKonsistent: z.boolean().optional(),
			})
			.optional(),
	})
	.catchall(z.string());

export type Namespace = z.infer<typeof NamespaceSchema>;
