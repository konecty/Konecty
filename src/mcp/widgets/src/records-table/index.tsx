import React from 'react';
import { createRoot } from 'react-dom/client';
import '../shared/base.css';
import { getWidgetPayload, openExternalLink } from '../shared/bridge';
import { getIntl } from '../shared/i18n';

type RecordRow = {
	_id?: string;
	[name: string]: unknown;
};

const intl = getIntl();
const payload = getWidgetPayload<{ records?: RecordRow[]; openInKonectyBaseUrl?: string }>();
const records = Array.isArray(payload.records) ? payload.records : [];
const columns = records.length > 0 ? Object.keys(records[0] ?? {}) : [];

function RecordsTable() {
	return (
		<div className="k-card">
			<h2 className="k-title">Records</h2>
			{records.length === 0 ? (
				<div className="k-subtitle">{intl.formatMessage({ id: 'noData' })}</div>
			) : (
				<table className="k-table">
					<thead>
						<tr>
							{columns.map(column => (
								<th key={column}>{column}</th>
							))}
							<th>Link</th>
						</tr>
					</thead>
					<tbody>
						{records.map((record, index) => (
							<tr key={record._id ?? String(index)}>
								{columns.map(column => (
									<td key={`${record._id ?? index}-${column}`}>{String(record[column] ?? '')}</td>
								))}
								<td>
									{typeof payload.openInKonectyBaseUrl === 'string' && typeof record._id === 'string' ? (
										<a
											href="#"
											className="k-link"
											onClick={event => {
												event.preventDefault();
												openExternalLink(`${payload.openInKonectyBaseUrl}/${record._id}`);
											}}
										>
											{intl.formatMessage({ id: 'openInKonecty' })}
										</a>
									) : (
										'-'
									)}
								</td>
							</tr>
						))}
					</tbody>
				</table>
			)}
		</div>
	);
}

const rootNode = document.getElementById('root');
if (rootNode != null) {
	createRoot(rootNode).render(<RecordsTable />);
}
