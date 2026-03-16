import { ObjectId, type Collection } from 'mongodb';

import { db } from '@imports/database';
import type { User } from '@imports/model/User';
import type { SavedQuery } from '@imports/model/SavedQuery';
import {
	CreateSavedQueryInputSchema,
	UpdateSavedQueryInputSchema,
	ShareSavedQueryInputSchema,
} from '@imports/model/SavedQuery';
import { logger } from '@imports/utils/logger';

const COLLECTION_NAME = 'savedQueries';

type SavedQueryDoc = Omit<SavedQuery, '_id'> & { _id: ObjectId };

const getCollection = (): Collection<SavedQueryDoc> =>
	db.collection<SavedQueryDoc>(COLLECTION_NAME);

function toResponse(doc: SavedQueryDoc | null): (SavedQuery & { _id: string }) | null {
	if (doc == null) return null;
	return {
		...doc,
		_id: doc._id.toString(),
		_createdAt: doc._createdAt instanceof Date ? doc._createdAt : new Date(doc._createdAt),
		_updatedAt: doc._updatedAt instanceof Date ? doc._updatedAt : new Date(doc._updatedAt),
	};
}

function ownerFromUser(user: User): { _id: string; name: string } {
	return {
		_id: (user as User & { _id?: string })._id ?? '',
		name: user.name ?? '',
	};
}

export async function listSavedQueries(user: User): Promise<(SavedQuery & { _id: string })[]> {
	const collection = getCollection();
	const userId = (user as User & { _id?: string })._id;
	const userGroup = (user as User & { group?: string }).group;
	const userRole = (user as User & { role?: { name?: string } }).role?.name;

	const orConditions: Record<string, unknown>[] = [
		{ 'owner._id': userId },
		{ isPublic: true },
	];
	if (userId) {
		orConditions.push({ sharedWith: { $elemMatch: { type: 'user', _id: userId } } });
	}
	if (userGroup) {
		orConditions.push({ sharedWith: { $elemMatch: { type: 'group', _id: userGroup } } });
	}
	if (userRole) {
		orConditions.push({ sharedWith: { $elemMatch: { type: 'group', _id: userRole } } });
	}

	const cursor = collection.find({ $or: orConditions }).sort({ _updatedAt: -1 });
	const list = await cursor.toArray();
	return list.map(doc => toResponse(doc)).filter((r): r is SavedQuery & { _id: string } => r != null);
}

export async function getSavedQueryById(id: string, user: User): Promise<(SavedQuery & { _id: string }) | null> {
	const collection = getCollection();
	const doc = await collection.findOne({ _id: new ObjectId(id) });
	if (doc == null) return null;

	const userId = (user as User & { _id?: string })._id;
	const canRead =
		doc.owner._id === userId ||
		doc.isPublic === true ||
		(doc.sharedWith ?? []).some(
			(s: { type: string; _id: string }) =>
				(s.type === 'user' && s._id === userId) ||
				(s.type === 'group' && (s._id === (user as User & { group?: string }).group || s._id === (user as User & { role?: { name?: string } }).role?.name)),
		);
	if (!canRead) return null;

	return toResponse(doc);
}

export async function createSavedQuery(input: unknown, user: User): Promise<SavedQuery & { _id: string }> {
	const parsed = CreateSavedQueryInputSchema.parse(input);
	const collection = getCollection();
	const now = new Date();
	const owner = ownerFromUser(user);

	const doc: SavedQueryDoc = {
		_id: new ObjectId(),
		...parsed,
		owner,
		sharedWith: [],
		isPublic: false,
		_createdAt: now,
		_updatedAt: now,
		_createdBy: owner,
		_updatedBy: owner,
	};

	await collection.insertOne(doc as SavedQueryDoc);
	logger.info({ savedQueryId: doc._id.toString(), userId: owner._id }, 'Saved query created');

	const inserted = await collection.findOne({ _id: doc._id });
	return toResponse(inserted)!;
}

export async function updateSavedQuery(id: string, input: unknown, user: User): Promise<(SavedQuery & { _id: string }) | null> {
	const existing = await getSavedQueryById(id, user);
	if (existing == null) return null;
	if (existing.owner._id !== (user as User & { _id?: string })._id) return null;

	const parsed = UpdateSavedQueryInputSchema.parse(input);
	const collection = getCollection();

	const updateFields: Record<string, unknown> = {
		...parsed,
		_updatedBy: ownerFromUser(user),
		_updatedAt: new Date(),
	};

	const result = await collection.findOneAndUpdate(
		{ _id: new ObjectId(id) },
		{ $set: updateFields },
		{ returnDocument: 'after' },
	);

	logger.info({ savedQueryId: id, userId: (user as User & { _id?: string })._id }, 'Saved query updated');
	return toResponse(result);
}

export async function deleteSavedQuery(id: string, user: User): Promise<boolean> {
	const existing = await getSavedQueryById(id, user);
	if (existing == null) return false;
	if (existing.owner._id !== (user as User & { _id?: string })._id) return false;

	const collection = getCollection();
	const result = await collection.deleteOne({ _id: new ObjectId(id) });
	logger.info({ savedQueryId: id, deleted: result.deletedCount > 0 }, 'Saved query delete attempted');
	return result.deletedCount > 0;
}

export async function shareSavedQuery(id: string, input: unknown, user: User): Promise<(SavedQuery & { _id: string }) | null> {
	const existing = await getSavedQueryById(id, user);
	if (existing == null) return null;
	if (existing.owner._id !== (user as User & { _id?: string })._id) return null;

	const parsed = ShareSavedQueryInputSchema.parse(input);
	const collection = getCollection();

	const updateFields: Record<string, unknown> = {
		sharedWith: parsed.sharedWith,
		_updatedBy: ownerFromUser(user),
		_updatedAt: new Date(),
	};
	if (parsed.isPublic !== undefined) {
		updateFields.isPublic = parsed.isPublic;
	}

	const result = await collection.findOneAndUpdate(
		{ _id: new ObjectId(id) },
		{ $set: updateFields },
		{ returnDocument: 'after' },
	);

	logger.info({ savedQueryId: id, userId: (user as User & { _id?: string })._id }, 'Saved query share updated');
	return toResponse(result);
}
