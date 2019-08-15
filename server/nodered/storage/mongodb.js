import { Meteor } from 'meteor/meteor';

const flowsCollection = new Meteor.Collection('Flows');

flowsCollection._ensureIndex({ type: 1, path: 1 }, { unique: 1 });

export const save = async (type, path, body, meta) => {
	flowsCollection.update(
		{ type, path },
		{ $set: { body: JSON.stringify(body), meta: JSON.stringify(meta) }, $setOnInsert: { type, path } },
		{ upsert: true, multi: false }
	);
};

export const find = async (type, path, defaultValue = {}) => {
	const { body } = (await flowsCollection.findOne({ type, path })) || {};
	if (body) {
		return JSON.parse(body);
	}
	return defaultValue;
};
