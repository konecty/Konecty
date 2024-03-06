import openTelemetryPlugin from '@autotelic/fastify-opentelemetry';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { PrometheusExporter } from '@opentelemetry/exporter-prometheus';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-proto';
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
import { PinoInstrumentation } from '@opentelemetry/instrumentation-pino';
import { Resource } from '@opentelemetry/resources';
import { ConsoleMetricExporter, PeriodicExportingMetricReader } from '@opentelemetry/sdk-metrics';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { ConsoleSpanExporter } from '@opentelemetry/sdk-trace-node';
import { SEMRESATTRS_SERVICE_NAME, SEMRESATTRS_SERVICE_VERSION } from '@opentelemetry/semantic-conventions';

import { logger } from '../utils/logger';

const OTEL_URL = process.env.OTEL_URL;
const PROMETHEUS_URL = process.env.PROMETHEUS_URL;
const OTEL_SERVICE_NAME = process.env.OTEL_SERVICE_NAME ?? 'konecty';
const OTEL_SERVICE_VERSION = process.env.OTEL_SERVICE_VERSION ?? '1.0.0';

export default async function initializeInstrumentation() {
	const getTraceExporter = () => {
		if (OTEL_URL != null) {
			logger.info(`Using OTLP exporter with url: ${OTEL_URL}`);
			return new OTLPTraceExporter({
				url: OTEL_URL,
			});
		}
		return new ConsoleSpanExporter();
	};

	const getMetricExporter = () => {
		if (PROMETHEUS_URL != null) {
			logger.info(`Using Prometheus exporter with url: ${PROMETHEUS_URL}`);
			return new PrometheusExporter({
				endpoint: PROMETHEUS_URL,
			});
		}
		return new PeriodicExportingMetricReader({
			exporter: new ConsoleMetricExporter(),
		});
	};
	const sdk = new NodeSDK({
		resource: new Resource({
			[SEMRESATTRS_SERVICE_NAME]: OTEL_SERVICE_NAME,
			[SEMRESATTRS_SERVICE_VERSION]: OTEL_SERVICE_VERSION,
		}),
		traceExporter: getTraceExporter(),
		metricReader: getMetricExporter(),
		instrumentations: [
			new HttpInstrumentation({
				ignoreIncomingRequestHook: request => {
					if (['/liveness', '/readiness'].includes(request?.url ?? '')) {
						return true;
					}
					return false;
				},
			}),
			getNodeAutoInstrumentations(),
			new PinoInstrumentation({
				logHook: (_, record) => {
					record['resource.service.name'] = OTEL_SERVICE_NAME;
				},
				logKeys: {
					traceId: 'traceId',
					spanId: 'spanId',
					traceFlags: 'traceFlags',
				},
			}),
		],
	});

	sdk.start();

	return openTelemetryPlugin;
}
