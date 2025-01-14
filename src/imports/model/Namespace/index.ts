import { z } from 'zod';
import { QueueConfigSchema } from './QueueConfig';
import { FSStorageCfg, S3StorageCfg, ServerStorageCfg } from './Storage';

export const NamespaceSchema = z
	.object({
		_id: z.string(),
		type: z.literal('namespace'),
		trackUserGeolocation: z.boolean().optional(),
		trackUserFingerprint: z.boolean().optional(),
		loginExpiration: z.number().optional(),
		dateFormat: z.string().optional(),
		logoURL: z.string().optional(),
		sessionExpirationInSeconds: z.number().nonnegative().finite().optional(),

		storage: z.discriminatedUnion('type', [S3StorageCfg, FSStorageCfg, ServerStorageCfg]).optional(),
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

		QueueConfig: QueueConfigSchema.optional(),
	})
	.catchall(z.string());

export type Namespace = z.infer<typeof NamespaceSchema>;
