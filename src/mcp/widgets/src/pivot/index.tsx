import React from 'react';
import { createRoot } from 'react-dom/client';
import '../shared/base.css';
import { getWidgetPayload } from '../shared/bridge';
import { getIntl } from '../shared/i18n';

const intl = getIntl();
const payload = getWidgetPayload<{ rows?: Array<Record<string, unknown>> }>();
const rows = Array.isArray(payload.rows) ? payload.rows : [];

function PivotWidget() {
	return (
		<div className="k-card">
			<h2 className="k-title">Pivot</h2>
			{rows.length === 0 ? (
				<div className="k-subtitle">{intl.formatMessage({ id: 'noData' })}</div>
			) : (
				<pre>{JSON.stringify(rows, null, 2)}</pre>
			)}
		</div>
	);
}

const rootNode = document.getElementById('root');
if (rootNode != null) {
	createRoot(rootNode).render(<PivotWidget />);
}
