import Handlebars from 'handlebars';
import { logger } from '@imports/utils/logger';
import { MetaObject } from '@imports/model/MetaObject';
import { WHATSAPP_BUTTON_URL_PARAMETER_MAX_LENGTH } from '@imports/consts';

export interface WhatsAppConfig {
	accessToken: string;
	phoneNumberId: string;
	businessAccountId?: string;
	templateId: string;
	apiUrlTemplate?: string;
	languageCode?: string;
	buttonUrlParameter?: string;
}

export interface WhatsAppResult {
	success: boolean;
	error?: string;
}

/**
 * Send OTP via WhatsApp Business API (Meta official)
 */
export async function sendOtpViaWhatsApp(phoneNumber: string, otpCode: string, config: WhatsAppConfig): Promise<WhatsAppResult> {
	const whatsappConfig = MetaObject.Namespace.otpConfig?.whatsapp ?? config;

	if (whatsappConfig == null) {
		return {
			success: false,
			error: 'WhatsApp configuration not found',
		};
	}

	try {
		// Build API URL using template if provided, otherwise use default
		const defaultApiUrlTemplate = 'https://graph.facebook.com/v18.0/{{phoneNumberId}}/messages';
		const apiUrlTemplate = whatsappConfig.apiUrlTemplate ?? defaultApiUrlTemplate;
		const template = Handlebars.compile(apiUrlTemplate);
		const apiUrl = template({
			phoneNumberId: whatsappConfig.phoneNumberId,
			...(whatsappConfig.businessAccountId != null && { businessAccountId: whatsappConfig.businessAccountId }),
		});

		// Use configured language code or default to pt_BR (Brazilian Portuguese)
		const languageCode = whatsappConfig.languageCode ?? 'pt_BR';

		// Build components array
		const components: Array<{
			type: string;
			sub_type?: string;
			index?: string;
			parameters?: Array<{ type: string; text?: string }>;
		}> = [
			{
				type: 'body',
				parameters: [
					{
						type: 'text',
						text: otpCode,
					},
				],
			},
		];

		// Add button component if template has a URL button that requires a parameter
		// WhatsApp has a limit of 15 characters for button URL parameters
		if (whatsappConfig.buttonUrlParameter != null) {
			const buttonParam = whatsappConfig.buttonUrlParameter.trim();
			if (buttonParam.length > WHATSAPP_BUTTON_URL_PARAMETER_MAX_LENGTH) {
				logger.warn(
					`WhatsApp buttonUrlParameter exceeds maximum length of ${WHATSAPP_BUTTON_URL_PARAMETER_MAX_LENGTH} characters. Received: ${buttonParam.length}. Parameter will be truncated.`,
				);
				// Truncate to maximum length (WhatsApp limit)
				const truncatedParam = buttonParam.substring(0, WHATSAPP_BUTTON_URL_PARAMETER_MAX_LENGTH);
				components.push({
					type: 'button',
					sub_type: 'url',
					index: '0', // First button (index 0)
					parameters: [
						{
							type: 'text',
							text: truncatedParam,
						},
					],
				});
			} else {
				components.push({
					type: 'button',
					sub_type: 'url',
					index: '0', // First button (index 0)
					parameters: [
						{
							type: 'text',
							text: buttonParam,
						},
					],
				});
			}
		}

		const messageBody = {
			messaging_product: 'whatsapp',
			to: phoneNumber,
			type: 'template',
			template: {
				name: whatsappConfig.templateId,
				language: {
					code: languageCode,
				},
				components,
			},
		};

		const response = await fetch(apiUrl, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${whatsappConfig.accessToken}`,
			},
			body: JSON.stringify(messageBody),
		});

		if (!response.ok) {
			const errorData = (await response.json().catch(() => ({ error: { message: 'Unknown error' } }))) as {
				error?: { message?: string };
			};
			logger.error(`WhatsApp API error: ${JSON.stringify(errorData)}`);
			return {
				success: false,
				error: errorData.error?.message ?? 'Failed to send WhatsApp message',
			};
		}

		await response.json();
		logger.info(`OTP sent via WhatsApp to ${phoneNumber}`);
		return { success: true };
	} catch (error) {
		logger.error(error, 'Error sending OTP via WhatsApp');
		return {
			success: false,
			error: (error as Error).message,
		};
	}
}
