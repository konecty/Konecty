import React from 'react';
import { createRoot } from 'react-dom/client';
import '../shared/base.css';
import { getWidgetPayload, openExternalLink } from '../shared/bridge';
import { getIntl } from '../shared/i18n';

const intl = getIntl();
const payload = getWidgetPayload<{ record?: Record<string, unknown>; openInKonectyUrl?: string }>();
const record = payload.record ?? {};

function RecordDetailWidget() {
	return (
		<div className="k-card">
			<h2 className="k-title">Record Detail</h2>
			<table className="k-table">
				<tbody>
					{Object.entries(record).map(([field, value]) => (
						<tr key={field}>
							<th>{field}</th>
							<td>{typeof value === 'object' ? JSON.stringify(value) : String(value ?? '')}</td>
						</tr>
					))}
				</tbody>
			</table>
			{typeof payload.openInKonectyUrl === 'string' ? (
				<button
					type="button"
					className="k-badge"
					onClick={() => {
						openExternalLink(payload.openInKonectyUrl!);
					}}
				>
					{intl.formatMessage({ id: 'openInKonecty' })}
				</button>
			) : null}
		</div>
	);
}

const rootNode = document.getElementById('root');
if (rootNode != null) {
	createRoot(rootNode).render(<RecordDetailWidget />);
}
