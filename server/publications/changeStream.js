Meteor.publish('changeStream', function(document) {
	if (!this.userId) {
		return this.ready();
	}
	const meta = Models[document];
	if (meta) {
		const collection = meta.rawCollection();

		const changeStream = collection.watch({ fullDocument: 'updateLookup' });
		changeStream.on('change', next => {
			const {
				operationType,
				fullDocument,
				documentKey: { _id }
			} = next;

			this.added(document, _id, {
				type: operationType === 'replace' ? 'update' : operationType,
				document: fullDocument
			});
		});

		this.connection.onClose(() => changeStream.close());
		this.onStop(() => changeStream.close());
	}
});
