import sharp, { Sharp } from 'sharp';
import path from 'path';
import { z } from 'zod';

import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';

import { MetaObject } from '@/imports/model/MetaObject';
import { KonectyResult } from '@/imports/types/result';
import { errorReturn, successReturn } from '@/imports/utils/return';

const WatermarkConfigSchema = z.union([
	z.object({
		type: z.literal('s3'),
		bucket: z.string(),
		key: z.string(),
	}),
	z.object({
		type: z.literal('fs'),
		path: z.string(),
	}),
	z.object({
		type: z.literal('url'),
		url: z.string(),
	}),
	z.object({
		type: z.literal('text'),
		text: z.string(),
	}),
]);

export type WatermarkConfig = z.infer<typeof WatermarkConfigSchema>;

async function getWatermark(): Promise<KonectyResult<Buffer>> {
	const wmConfigResult = WatermarkConfigSchema.safeParse(MetaObject.Namespace.storage.wm);

	if (wmConfigResult.success === false) {
		return errorReturn(`Error creating wathermark: ${wmConfigResult.error.message}`) as KonectyResult<Buffer>;
	}

	const wmConfig = wmConfigResult.data;

	if (wmConfig.type === 's3') {
		const s3 = new S3Client(MetaObject.Namespace.storage?.config ?? {});

		const s3Result = await s3.send(
			new GetObjectCommand({
				Bucket: wmConfig.bucket,
				Key: wmConfig.key,
			}),
		);

		return successReturn(s3Result.Body) as KonectyResult<Buffer>;
	}

	if (wmConfig.type === 'fs') {
		const filePath = path.join(MetaObject.Namespace.storage?.directory ?? '/tmp', wmConfig.path);
		const fileContent = await sharp(filePath).toBuffer();
		return successReturn(fileContent) as KonectyResult<Buffer>;
	}

	if (wmConfig.type === 'url') {
		const urlResult = await fetch(wmConfig.url);
		if (urlResult.ok === false) {
			return errorReturn(`Error fetching watermark: ${urlResult.statusText}`) as KonectyResult<Buffer>;
		}
		const fileContent = await urlResult.arrayBuffer();

		return successReturn(fileContent) as KonectyResult<Buffer>;
	}

	if (wmConfig.type === 'text') {
		const svg = `
		<svg xmlns="http://www.w3.org/2000/svg" width="2048" height="2048" viewBox="0 0 2048 2048">
            <rect width="100%" height="100%" fill="transparent" />
            <text x="50%" y="50%" text-anchor="middle" alignment-baseline="middle" font-size="300" fill="rgba(255, 255, 255, 0.4)">${wmConfig.text}</text>
        </svg>`;

		const fileContent = await sharp(Buffer.from(svg))
			.resize({
				width: 2048,
				height: 2048,
				fit: sharp.fit.contain,
				position: sharp.gravity.center,
				background: '#cccccc',
			})
			.png({ force: true })
			.toBuffer();

		return successReturn(fileContent) as KonectyResult<Buffer>;
	}

	return errorReturn(`Invalid watermark type`) as KonectyResult<Buffer>;
}

export async function applyWatermark(image: Sharp): Promise<KonectyResult<Buffer>> {
	const wmResult = await getWatermark();

	if (wmResult.success === false) {
		return wmResult;
	}

	const { width = 1024, height = 1024 } = await image.metadata();

	const wmBuffer = await sharp(wmResult.data)
		.resize({
			width: Math.floor(width * 0.8),
			height: Math.floor(height * 0.8),
			fit: sharp.fit.inside,
			position: sharp.gravity.center,
		})
		.toBuffer();

	const composite = image.composite([
		{
			input: wmBuffer,
			gravity: sharp.gravity.center,
		},
	]);

	const result = await composite.toBuffer();

	return successReturn(result) as KonectyResult<Buffer>;
}
