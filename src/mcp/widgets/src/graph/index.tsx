import React from 'react';
import { createRoot } from 'react-dom/client';
import '../shared/base.css';
import { getWidgetPayload } from '../shared/bridge';
import { getIntl } from '../shared/i18n';

const intl = getIntl();
const payload = getWidgetPayload<{ svg?: string }>();

function GraphWidget() {
	return (
		<div className="k-card">
			<h2 className="k-title">Graph</h2>
			{typeof payload.svg === 'string' && payload.svg.length > 0 ? (
				<div dangerouslySetInnerHTML={{ __html: payload.svg }} />
			) : (
				<div className="k-subtitle">{intl.formatMessage({ id: 'noData' })}</div>
			)}
		</div>
	);
}

const rootNode = document.getElementById('root');
if (rootNode != null) {
	createRoot(rootNode).render(<GraphWidget />);
}
