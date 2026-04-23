import React from 'react';
import { createRoot } from 'react-dom/client';
import '../shared/base.css';
import { getWidgetPayload, openExternalLink } from '../shared/bridge';
import { getIntl } from '../shared/i18n';

const intl = getIntl();
const payload = getWidgetPayload<{ fileUrl?: string; fileName?: string }>();

function FilePreviewWidget() {
	const isImage = typeof payload.fileUrl === 'string' && /\.(png|jpg|jpeg|gif|webp)$/i.test(payload.fileUrl);

	return (
		<div className="k-card">
			<h2 className="k-title">File Preview</h2>
			{isImage ? <img src={payload.fileUrl} alt={payload.fileName ?? 'file'} style={{ maxWidth: '100%', borderRadius: '8px' }} /> : <div className="k-subtitle">{payload.fileName ?? intl.formatMessage({ id: 'noData' })}</div>}
			{typeof payload.fileUrl === 'string' ? (
				<button type="button" className="k-badge" onClick={() => openExternalLink(payload.fileUrl!)}>
					{intl.formatMessage({ id: 'fileDownload' })}
				</button>
			) : null}
		</div>
	);
}

const rootNode = document.getElementById('root');
if (rootNode != null) {
	createRoot(rootNode).render(<FilePreviewWidget />);
}
