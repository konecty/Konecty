import crypto from 'crypto';

import MetaObjectHistory from '../model/coreMetaObjectHistory';

export default new class MetaHistory {
	backup(metaDocument) {
		console.log('[konmeta] Backuping ➜'.green, metaDocument._id.cyan);
		const shasum = crypto.createHash('md5');
		shasum.update(JSON.stringify(metaDocument));
		const hash = shasum.digest('hex');

		const doc = MetaObjectHistory.findOne({'version.hash': hash});
		if (doc != null) {
			return;
		}

		if (!_.isObject(metaDocument.version)) {
			metaDocument.version = {
				major: 1
			};
		}

		metaDocument.version.hash = hash;
		metaDocument.version.date = new Date;

		metaDocument._id += `:${metaDocument.version.major}.${metaDocument.version.date.getTime()}`;
		return MetaObjectHistory.insert(metaDocument);
	}
}

