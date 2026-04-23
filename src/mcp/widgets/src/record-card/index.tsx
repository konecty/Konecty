import React, { useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import '../shared/base.css';
import { getWidgetPayload, openExternalLink } from '../shared/bridge';
import { getIntl } from '../shared/i18n';

const intl = getIntl();
const payload = getWidgetPayload<{
	record?: Record<string, unknown>;
	images?: string[];
	highlightFields?: string[];
	openInKonectyUrl?: string;
}>();

function RecordCardWidget() {
	const [activeImage, setActiveImage] = useState(0);
	const record = payload.record ?? {};
	const images = useMemo(() => (Array.isArray(payload.images) ? payload.images : []), []);
	const highlights = useMemo(() => (Array.isArray(payload.highlightFields) ? payload.highlightFields : []), []);

	return (
		<div className="k-card">
			<h2 className="k-title">Record Card</h2>
			<div style={{ aspectRatio: '4 / 3', overflow: 'hidden', borderRadius: '10px', border: '1px solid rgba(128, 128, 128, 0.2)' }}>
				{images.length > 0 ? (
					<img src={images[activeImage]} alt="record" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
				) : (
					<div className="k-subtitle" style={{ padding: '12px' }}>
						{intl.formatMessage({ id: 'noData' })}
					</div>
				)}
			</div>
			<div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
				<button type="button" onClick={() => setActiveImage(current => Math.max(0, current - 1))}>
					Prev
				</button>
				<button type="button" onClick={() => setActiveImage(current => Math.min(images.length - 1, current + 1))}>
					Next
				</button>
			</div>
			<ul>
				{highlights.map(field => (
					<li key={field}>
						<strong>{field}</strong>: {String(record[field] ?? '')}
					</li>
				))}
			</ul>
			{typeof payload.openInKonectyUrl === 'string' ? (
				<button type="button" className="k-badge" onClick={() => openExternalLink(payload.openInKonectyUrl!)}>
					{intl.formatMessage({ id: 'openInKonecty' })}
				</button>
			) : null}
		</div>
	);
}

const rootNode = document.getElementById('root');
if (rootNode != null) {
	createRoot(rootNode).render(<RecordCardWidget />);
}
