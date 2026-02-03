import { Collection, Filter, UpdateFilter } from 'mongodb';

import { MetaObject } from '@imports/model/MetaObject';
import { User } from '@imports/model/User';
import { KonectyResult } from '@imports/types/result';

interface QueueUser {
	_id: string | unknown;
	next?: string | null;
	isCurrent?: boolean;
	queue?: {
		_id: string;
	};
	user?: {
		_id: string;
		name?: string;
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

interface RecalculateQueueResult {
	recalculated: boolean;
	totalUsers: number;
}

/**
 * Recalcula a lista encadeada de QueueUsers para uma fila específica.
 * Preserva a ordem dos ponteiros `next` válidos e adiciona usuários desconectados ao final.
 *
 * @param queueStrId - ID da fila
 * @param user - Usuário que está executando a operação
 * @returns Resultado da recalculação
 */
export async function recalculateQueue(
	queueStrId: string,
	user: User,
): Promise<KonectyResult<RecalculateQueueResult>> {
	const collection = MetaObject.Collections['QueueUser'] as Collection<QueueUser> | undefined;

	if (collection == null) {
		return {
			success: false,
			errors: [
				{
					message: `Error recalculating queue: QueueUser collection not found!`,
				},
			],
		};
	}

	const query: Filter<QueueUser> = { 'queue._id': queueStrId };

	// Buscar todos os QueueUsers da fila
	const allQueueUsers = await collection.find(query).toArray();

	if (allQueueUsers.length === 0) {
		return {
			success: false,
			errors: [
				{
					message: `Error recalculating queue: No QueueUsers found for queue ${queueStrId}!`,
				},
			],
		};
	}

	// Criar mapa de IDs para acesso rápido
	const userMap = new Map<string, QueueUser>();
	allQueueUsers.forEach(qu => {
		const id = String(qu._id);
		userMap.set(id, qu);
	});

	// Construir sequências conectadas baseadas nos `next` válidos
	const connectedSequences: QueueUser[][] = [];
	const processed = new Set<string>();

	// Construir sequências conectadas seguindo os `next` válidos
	allQueueUsers.forEach(qu => {
		const id = String(qu._id);
		if (processed.has(id)) {
			return;
		}

		const nextId = qu.next ? String(qu.next) : null;
		if (!nextId || !userMap.has(nextId)) {
			return;
		}

		// Seguir a cadeia de `next` válidos
		const sequence: QueueUser[] = [];
		let current: QueueUser | undefined = qu;
		let currentId = id;

		while (current && !processed.has(currentId)) {
			processed.add(currentId);
			sequence.push(current);

			const next = current.next ? String(current.next) : null;
			if (next && userMap.has(next)) {
				current = userMap.get(next);
				currentId = next;
			} else {
				break;
			}
		}

		if (sequence.length > 0) {
			connectedSequences.push(sequence);
		}
	});

	// Identificar usuários desconectados (não processados)
	const disconnectedUsers = allQueueUsers.filter(qu => {
		const id = String(qu._id);
		return !processed.has(id);
	});

	// Ordenar usuários desconectados por `_createdAt` (mais antigos primeiro)
	disconnectedUsers.sort((a, b) => {
		const dateA = a._createdAt ? new Date(a._createdAt).getTime() : 0;
		const dateB = b._createdAt ? new Date(b._createdAt).getTime() : 0;
		return dateA - dateB;
	});

	// Construir lista final: sequências conectadas + usuários desconectados
	const finalList: QueueUser[] = [];
	connectedSequences.forEach(sequence => {
		finalList.push(...sequence);
	});
	finalList.push(...disconnectedUsers);

	// Criar lista encadeada circular
	const now = new Date();
	const updates: Array<{ query: Filter<QueueUser>; update: UpdateFilter<QueueUser> }> = [];

	// Verificar se já existe algum com isCurrent válido (que ainda está na lista)
	const existingCurrent = allQueueUsers.find(
		qu => qu.isCurrent === true && finalList.some(fl => String(fl._id) === String(qu._id)),
	);

	for (let i = 0; i < finalList.length; i++) {
		const current = finalList[i];
		const next = finalList[(i + 1) % finalList.length]; // Circular: último aponta para o primeiro
		const currentId = String(current._id);
		const nextId = String(next._id);

		const update: UpdateFilter<QueueUser> = {
			$set: {
				next: nextId,
				_updatedAt: now,
				_updatedBy: {
					_id: user._id,
					name: user.name,
					group: user.group,
				},
			},
		};

		// Definir `isCurrent: true` apenas no primeiro se não houver nenhum marcado válido
		if (i === 0) {
			if (!existingCurrent) {
				update.$set!.isCurrent = true;
			} else {
				// Se já existe um current válido, manter ele e definir este como false
				update.$set!.isCurrent = false;
			}
		} else {
			// Garantir que outros não tenham isCurrent
			update.$set!.isCurrent = false;
		}

		updates.push({
			query: { _id: currentId },
			update,
		});
	}

	// Se havia um current válido, garantir que ele mantenha isCurrent: true
	if (existingCurrent) {
		const existingCurrentId = String(existingCurrent._id);
		const existingIndex = finalList.findIndex(fl => String(fl._id) === existingCurrentId);
		if (existingIndex >= 0) {
			// Atualizar o update do usuário existente para manter isCurrent: true
			const existingUpdate = updates.find(u => String(u.query._id) === existingCurrentId);
			if (existingUpdate) {
				existingUpdate.update.$set!.isCurrent = true;
			}
		} else {
			// Se o existingCurrent não está na lista final, definir o primeiro como current
			if (updates.length > 0) {
				updates[0].update.$set!.isCurrent = true;
			}
		}
	} else {
		// Se não havia current válido, garantir que o primeiro tenha isCurrent: true
		// (já foi definido no loop acima, mas garantimos aqui também)
		if (updates.length > 0 && updates[0].update.$set!.isCurrent !== true) {
			updates[0].update.$set!.isCurrent = true;
		}
	}

	// Executar todas as atualizações
	try {
		await Promise.all(updates.map(({ query, update }) => collection.updateOne(query, update)));

		return {
			success: true,
			data: {
				recalculated: true,
				totalUsers: finalList.length,
			},
		};
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		return {
			success: false,
			errors: [
				{
					message: `Error recalculating queue: ${errorMessage}`,
				},
			],
		};
	}
}
