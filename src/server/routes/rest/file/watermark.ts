import path from 'path';
import sharp, { Sharp } from 'sharp';

import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';

import { MetaObject } from '@imports/model/MetaObject';
import { KonectyResult } from '@imports/types/result';
import { WatermarkConfigSchema } from '@imports/types/watermark';
import { errorReturn, successReturn } from '@imports/utils/return';

async function getWatermark({ maxWidth, maxHeight }: { maxWidth: number; maxHeight: number }): Promise<KonectyResult<Buffer>> {
	const wmConfigResult = WatermarkConfigSchema.safeParse(MetaObject.Namespace.storage?.wm);

	if (wmConfigResult.success === false) {
		return errorReturn(`Error creating wathermark: ${wmConfigResult.error.message}`) as KonectyResult<Buffer>;
	}

	const wmConfig = wmConfigResult.data;

	if (wmConfig.type === 's3') {
		const s3 = new S3Client(wmConfig.config ?? {});

		const s3Result = await s3.send(
			new GetObjectCommand({
				Bucket: wmConfig.bucket,
				Key: wmConfig.key,
			}),
		);

		return successReturn(await s3Result.Body?.transformToByteArray()) as KonectyResult<Buffer>;
	}

	if (wmConfig.type === 'fs') {
		const filePath = path.join(wmConfig.directory ?? '/tmp', wmConfig.path);
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
		<svg xmlns="http://www.w3.org/2000/svg" width="${maxWidth}" height="${maxHeight}" viewBox="0 0 ${maxWidth} ${maxHeight}">
            <rect width="100%" height="100%" fill="none" />
            <text x="50%" y="50%" text-anchor="middle" alignment-baseline="middle" font-size="${maxHeight * 0.15}px" stroke="rgba(0, 0, 0, 0.2)" stroke-width="1" fill="rgba(255, 255, 255, 0.4)">${wmConfig.text}</text>
        </svg>`;

		const fileContent = await sharp(Buffer.from(svg))
			.resize({
				width: maxWidth,
				height: maxHeight,
				fit: sharp.fit.contain,
				withoutEnlargement: true,
			})
			.png({ quality: 60, force: true })
			.toBuffer();

		return successReturn(fileContent) as KonectyResult<Buffer>;
	}

	return errorReturn(`Invalid watermark type`) as KonectyResult<Buffer>;
}

export async function applyWatermark(image: Sharp): Promise<KonectyResult<Buffer>> {
	const metadata = await image.metadata();
	const { width = 1024, height = 1024 } = metadata;

	const wmResult = await getWatermark({ maxWidth: width, maxHeight: height });
	if (wmResult.success === false) {
		return wmResult;
	}

	// First resize watermark to desired size (80% of original)
	const resizedWatermark = sharp(wmResult.data)
		.resize({
			width: Math.floor(width * 0.8),
			height: Math.floor(height * 0.8),
			fit: sharp.fit.inside,
			withoutEnlargement: true,
		})
		.png({ quality: 60, force: true });

	// Now composite the properly sized watermark canvas onto the original image
	const composite = image
		.resize({
			width,
			height,
			fit: sharp.fit.cover,
		})
		.composite([
			{
				input: await resizedWatermark.toBuffer(),
				gravity: sharp.gravity.center,
			},
		]);

	const result = await composite.toBuffer();

	return successReturn(result) as KonectyResult<Buffer>;
}
