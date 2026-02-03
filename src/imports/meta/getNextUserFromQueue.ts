import { Collection, Filter } from 'mongodb';

import { MetaObject } from '@imports/model/MetaObject';
import { User } from '@imports/model/User';
import { convertObjectIds } from '../utils/mongo';
import { KonectyResult } from '@imports/types/result';
import { recalculateQueue } from './recalculateQueue';

interface QueueUser {
	_id: string;
	next?: string | null;
	isCurrent?: boolean;
	queue?: {
		_id: string;
	};
	user?: {
		_id: string;
		name?: string;
		group?: {
			_id: string;
			name?: string;
		};
	};
	_createdAt?: Date | string;
	_updatedAt?: Date | string;
	_updatedBy?: {
		_id: string;
		name?: string;
		group?: {
			_id: string;
			name?: string;
		};
	};
}

interface Queue {
	_id: string;
	_user?: Array<{
		_id: string;
		name?: string;
		group?: {
			_id: string;
			name?: string;
		};
	}>;
}

/**
 * Obtém o próximo usuário da fila usando round-robin com lista encadeada.
 * Detecta automaticamente quebras na lista e recalcula quando necessário.
 *
 * @param queueStrId - ID da fila
 * @param user - Usuário que está executando a operação
 * @returns Próximo usuário da fila
 */
export async function getNextUserFromQueue(
	queueStrId: string,
	user: User,
): Promise<KonectyResult<QueueUser>> {
	const collection = MetaObject.Collections['QueueUser'] as unknown as Collection<QueueUser> | undefined;

	if (collection == null) {
		return {
			success: false,
			errors: [
				{
					message: `Error getting next user from queue: QueueUser collection not found!`,
				},
			],
		};
	}

	const query: Filter<QueueUser> = { 'queue._id': queueStrId };

	// CASO 3: Verificar se existe algum QueueUser sem o campo `next`
	const userWithoutNext = await collection.findOne({
		...query,
		$or: [{ next: { $exists: false } }, { next: null }, { next: '' }],
	});

	if (userWithoutNext != null) {
		// Recalcular a lista
		const recalculateResult = await recalculateQueue(queueStrId, user);
		if (recalculateResult.success === false) {
			return recalculateResult;
		}
	}

	// CASO 1: Buscar o QueueUser com `isCurrent: true`
	let currentUser = await collection.findOne({
		...query,
		isCurrent: true,
	});

	if (currentUser == null) {
		// Recalcular a lista
		const recalculateResult = await recalculateQueue(queueStrId, user);
		if (recalculateResult.success === false) {
			const isNoQueueUsers = recalculateResult.errors?.[0]?.message?.includes('No QueueUsers');
			if (!isNoQueueUsers) {
				return recalculateResult;
			}
			// No QueueUsers: fall through to Queue._user fallback (currentUser stays null)
		} else {
			// Buscar novamente após recalculação
			currentUser = await collection.findOne({
				...query,
				isCurrent: true,
			});
		}

		if (currentUser == null) {
			// Fallback para Queue._user se não houver QueueUsers
			const queueCollection = MetaObject.Collections['Queue'] as unknown as Collection<Queue> | undefined;
			const queueOwner = queueCollection ? await queueCollection.findOne({ _id: queueStrId }) : null;

			if (queueOwner == null) {
				return {
					success: false,
					errors: [
						{
							message: `Error getting next user from queue: Queue not found!`,
						},
					],
				};
			}

			if (queueOwner?._user != null && queueOwner._user.length > 0) {
				const userData = convertObjectIds({ user: queueOwner._user[0] });
				return {
					success: true,
					data: userData as QueueUser,
				};
			}

			return {
				success: false,
				errors: [
					{
						message: `Error getting next user from queue: No users found!`,
					},
				],
			};
		}
	}

	// CASO 2: Verificar se o `next` do usuário atual aponta para um QueueUser válido
	const nextId = currentUser.next ? String(currentUser.next) : null;
	if (nextId) {
		const nextUser = await collection.findOne({ _id: nextId, 'queue._id': queueStrId });

		if (nextUser == null) {
			// `next` aponta para um ID inválido - recalcular
			const recalculateResult = await recalculateQueue(queueStrId, user);
			if (recalculateResult.success === false) {
				return recalculateResult;
			}

			// Buscar novamente após recalculação
			currentUser = await collection.findOne({
				...query,
				isCurrent: true,
			});

			if (currentUser == null) {
				return {
					success: false,
					errors: [
						{
							message: `Error getting next user from queue: No current user found after recalculation!`,
						},
					],
				};
			}
		}
	} else {
		// Se não houver `next`, a lista pode estar quebrada - recalcular
		const recalculateResult = await recalculateQueue(queueStrId, user);
		if (recalculateResult.success === false) {
			return recalculateResult;
		}

		// Buscar novamente após recalculação
		currentUser = await collection.findOne({
			...query,
			isCurrent: true,
		});

		if (currentUser == null) {
			return {
				success: false,
				errors: [
					{
						message: `Error getting next user from queue: No current user found after recalculation!`,
					},
				],
			};
		}
	}

	// Garantir que o currentUser tem um next válido após todas as verificações
	const nextIdToSet = currentUser.next ? String(currentUser.next) : null;
	if (!nextIdToSet) {
		return {
			success: false,
			errors: [
				{
					message: `Error getting next user from queue: Current user has no next pointer!`,
				},
			],
		};
	}

	// Retornar o usuário atual
	const userData = convertObjectIds(currentUser) as QueueUser;
	const currentId = String(currentUser._id);

	// Mover `isCurrent` para o próximo usuário na lista
	const now = new Date();

	// Remover isCurrent do usuário atual
	await collection.updateOne(
		{ _id: currentId },
		{
			$set: {
				isCurrent: false,
				_updatedAt: now,
				_updatedBy: {
					_id: user._id,
					name: user.name,
					group: user.group,
				},
			},
		},
	);

	// Definir isCurrent no próximo usuário
	await collection.updateOne(
		{ _id: nextIdToSet },
		{
			$set: {
				isCurrent: true,
				_updatedAt: now,
				_updatedBy: {
					_id: user._id,
					name: user.name,
					group: user.group,
				},
			},
		},
	);

	return {
		success: true,
		data: userData,
	};
}
