import { expect } from 'chai';
import { ObjectId } from 'mongodb';

import { MetaObject } from '@imports/model/MetaObject';
import { User } from '@imports/model/User';
import { getNextUserFromQueue } from '@imports/meta/getNextUserFromQueue';
import { recalculateQueue } from '@imports/meta/recalculateQueue';
import { db } from '@imports/database';

describe('getNextUserFromQueue', () => {
	const queueId = 'test-queue-id';
	const testUser: User = {
		_id: 'test-user-id',
		name: 'Test User',
		active: true,
		emails: [{ address: 'test@example.com' }],
		group: {
			_id: 'test-group-id',
			name: 'Test Group',
		},
		services: {
			resume: {
				loginTokens: [],
			},
		},
	};

	beforeEach(async () => {
		// Configurar MetaObject.Collections se não estiver configurado
		if (!MetaObject.Collections['QueueUser']) {
			MetaObject.Collections['QueueUser'] = db.collection('data.QueueUser');
		}
		if (!MetaObject.Collections['Queue']) {
			MetaObject.Collections['Queue'] = db.collection('data.Queue');
		}

		// Limpar dados de teste
		await db.collection('data.QueueUser').deleteMany({ 'queue._id': queueId });
		await db.collection('data.Queue').deleteMany({ _id: queueId });
	});

	afterEach(async () => {
		// Limpar dados de teste
		await db.collection('data.QueueUser').deleteMany({ 'queue._id': queueId });
		await db.collection('data.Queue').deleteMany({ _id: queueId });
	});

	describe('Caso 3: QueueUser sem campo next', () => {
		it('deve recalcular quando encontrar QueueUser sem campo next', async () => {
			// Arrange
			const queueUser1 = {
				_id: new ObjectId().toString(),
				queue: { _id: queueId },
				user: { _id: 'user1', name: 'User 1' },
				_createdAt: new Date(),
			};

			const queueUser2 = {
				_id: new ObjectId().toString(),
				queue: { _id: queueId },
				user: { _id: 'user2', name: 'User 2' },
				// Sem campo next
				_createdAt: new Date(),
			};

			await db.collection('data.QueueUser').insertMany([queueUser1, queueUser2]);

			// Act
			const result = await getNextUserFromQueue(queueId, testUser);

			// Assert
			expect(result.success).to.be.true;
			expect(result.data).to.not.be.undefined;

			// Verificar que a lista foi recalculada
			const allUsers = await db.collection('data.QueueUser').find({ 'queue._id': queueId }).toArray();
			const usersWithNext = allUsers.filter(u => u.next != null);
			expect(usersWithNext.length).to.be.equal(2);
		});
	});

	describe('Caso 1: Não encontrou isCurrent', () => {
		it('deve recalcular quando não encontrar QueueUser com isCurrent', async () => {
			// Arrange
			const queueUser1 = {
				_id: new ObjectId().toString(),
				queue: { _id: queueId },
				user: { _id: 'user1', name: 'User 1' },
				next: null,
				isCurrent: false,
				_createdAt: new Date(),
			};

			const queueUser2 = {
				_id: new ObjectId().toString(),
				queue: { _id: queueId },
				user: { _id: 'user2', name: 'User 2' },
				next: null,
				isCurrent: false,
				_createdAt: new Date(),
			};

			await db.collection('data.QueueUser').insertMany([queueUser1, queueUser2]);

			// Act
			const result = await getNextUserFromQueue(queueId, testUser);

			// Assert
			expect(result.success).to.be.true;
			expect(result.data).to.not.be.undefined;

			// Verificar que um usuário tem isCurrent: true
			const currentUser = await db.collection('data.QueueUser').findOne({
				'queue._id': queueId,
				isCurrent: true,
			});
			expect(currentUser).to.not.be.null;
		});
	});

	describe('Caso 2: next aponta para ID inválido', () => {
		it('deve recalcular quando next aponta para ID que não existe', async () => {
			// Arrange
			const invalidId = new ObjectId().toString();
			const queueUser1 = {
				_id: new ObjectId().toString(),
				queue: { _id: queueId },
				user: { _id: 'user1', name: 'User 1' },
				next: invalidId, // ID que não existe
				isCurrent: true,
				_createdAt: new Date(),
			};

			await db.collection('data.QueueUser').insertOne(queueUser1);

			// Act
			const result = await getNextUserFromQueue(queueId, testUser);

			// Assert
			expect(result.success).to.be.true;
			expect(result.data).to.not.be.undefined;

			// Verificar que a lista foi recalculada
			const allUsers = await db.collection('data.QueueUser').find({ 'queue._id': queueId }).toArray();
			const user = allUsers[0];
			expect(user.next).to.not.be.equal(invalidId);
		});
	});

	describe('Round-robin funcionamento', () => {
		it('deve retornar usuários em ordem round-robin', async () => {
			// Arrange
			const user1Id = new ObjectId().toString();
			const user2Id = new ObjectId().toString();
			const user3Id = new ObjectId().toString();

			const queueUser1 = {
				_id: user1Id,
				queue: { _id: queueId },
				user: { _id: 'user1', name: 'User 1' },
				next: user2Id,
				isCurrent: true,
				_createdAt: new Date(),
			};

			const queueUser2 = {
				_id: user2Id,
				queue: { _id: queueId },
				user: { _id: 'user2', name: 'User 2' },
				next: user3Id,
				isCurrent: false,
				_createdAt: new Date(),
			};

			const queueUser3 = {
				_id: user3Id,
				queue: { _id: queueId },
				user: { _id: 'user3', name: 'User 3' },
				next: user1Id, // Circular
				isCurrent: false,
				_createdAt: new Date(),
			};

			await db.collection('data.QueueUser').insertMany([queueUser1, queueUser2, queueUser3]);

			// Act - Primeira chamada
			const result1 = await getNextUserFromQueue(queueId, testUser);

			// Assert - Deve retornar user1 (o atual)
			expect(result1.success).to.be.true;
			expect(result1.data).to.not.be.undefined;
			// Verificar que retornou o QueueUser correto (user1)
			const returnedUser1 = result1.data as any;
			expect(returnedUser1.user?._id).to.be.equal('user1');

			// Verificar que isCurrent foi movido para user2
			const currentAfter1 = await db.collection('data.QueueUser').findOne({
				'queue._id': queueId,
				isCurrent: true,
			});
			expect(currentAfter1?._id).to.be.equal(user2Id);

			// Act - Segunda chamada
			const result2 = await getNextUserFromQueue(queueId, testUser);

			// Assert - Deve retornar user2
			expect(result2.success).to.be.true;
			expect(result2.data).to.not.be.undefined;
			// Verificar que retornou o QueueUser correto (user2)
			const returnedUser2 = result2.data as any;
			expect(returnedUser2.user?._id).to.be.equal('user2');

			// Verificar que isCurrent foi movido para user3
			const currentAfter2 = await db.collection('data.QueueUser').findOne({
				'queue._id': queueId,
				isCurrent: true,
			});
			expect(currentAfter2?._id).to.be.equal(user3Id);
		});
	});

	describe('Fallback para Queue._user', () => {
		it('deve usar Queue._user quando não houver QueueUsers', async () => {
			// Arrange
			const queue = {
				_id: queueId,
				name: 'Test Queue',
				_user: [
					{
						_id: 'fallback-user',
						name: 'Fallback User',
						group: { _id: 'group-id', name: 'Group' },
					},
				],
			};

			await db.collection('data.Queue').insertOne(queue);

			// Act
			const result = await getNextUserFromQueue(queueId, testUser);

			// Assert
			expect(result.success).to.be.true;
			expect(result.data).to.not.be.undefined;
		});
	});
});

describe('recalculateQueue', () => {
	const queueId = 'test-queue-id';
	const testUser: User = {
		_id: 'test-user-id',
		name: 'Test User',
		active: true,
		emails: [{ address: 'test@example.com' }],
		group: {
			_id: 'test-group-id',
			name: 'Test Group',
		},
		services: {
			resume: {
				loginTokens: [],
			},
		},
	};

	beforeEach(async () => {
		// Configurar MetaObject.Collections se não estiver configurado
		if (!MetaObject.Collections['QueueUser']) {
			MetaObject.Collections['QueueUser'] = db.collection('data.QueueUser');
		}

		await db.collection('data.QueueUser').deleteMany({ 'queue._id': queueId });
	});

	afterEach(async () => {
		await db.collection('data.QueueUser').deleteMany({ 'queue._id': queueId });
	});

	it('deve criar lista circular completa quando não há sequências conectadas', async () => {
		// Arrange
		const user1Id = new ObjectId().toString();
		const user2Id = new ObjectId().toString();
		const user3Id = new ObjectId().toString();

		const queueUsers = [
			{
				_id: user1Id,
				queue: { _id: queueId },
				user: { _id: 'user1', name: 'User 1' },
				_createdAt: new Date('2024-01-01'),
			},
			{
				_id: user2Id,
				queue: { _id: queueId },
				user: { _id: 'user2', name: 'User 2' },
				_createdAt: new Date('2024-01-02'),
			},
			{
				_id: user3Id,
				queue: { _id: queueId },
				user: { _id: 'user3', name: 'User 3' },
				_createdAt: new Date('2024-01-03'),
			},
		];

		await db.collection('data.QueueUser').insertMany(queueUsers);

		// Act
		const result = await recalculateQueue(queueId, testUser);

		// Assert
		expect(result.success).to.be.true;
		expect(result.data?.totalUsers).to.be.equal(3);

		// Verificar que todos têm next
		const allUsers = await db.collection('data.QueueUser').find({ 'queue._id': queueId }).toArray();
		allUsers.forEach(user => {
			expect(user.next).to.not.be.undefined;
			expect(user.next).to.not.be.null;
		});

		// Verificar que é circular (último aponta para primeiro)
		const sortedUsers = allUsers.sort((a, b) => {
			const dateA = a._createdAt ? new Date(a._createdAt).getTime() : 0;
			const dateB = b._createdAt ? new Date(b._createdAt).getTime() : 0;
			return dateA - dateB;
		});

		const firstUser = sortedUsers[0];
		const lastUser = sortedUsers[sortedUsers.length - 1];
		expect(lastUser.next).to.be.equal(String(firstUser._id));
	});

	it('deve preservar ordem de sequências conectadas', async () => {
		// Arrange
		const user1Id = new ObjectId().toString();
		const user2Id = new ObjectId().toString();
		const user3Id = new ObjectId().toString();

		const queueUsers = [
			{
				_id: user1Id,
				queue: { _id: queueId },
				user: { _id: 'user1', name: 'User 1' },
				next: user2Id,
				_createdAt: new Date('2024-01-01'),
			},
			{
				_id: user2Id,
				queue: { _id: queueId },
				user: { _id: 'user2', name: 'User 2' },
				next: user3Id,
				_createdAt: new Date('2024-01-02'),
			},
			{
				_id: user3Id,
				queue: { _id: queueId },
				user: { _id: 'user3', name: 'User 3' },
				// Sem next (será conectado ao final)
				_createdAt: new Date('2024-01-03'),
			},
		];

		await db.collection('data.QueueUser').insertMany(queueUsers);

		// Act
		const result = await recalculateQueue(queueId, testUser);

		// Assert
		expect(result.success).to.be.true;

		// Verificar que a sequência user1 -> user2 -> user3 foi preservada
		const user1 = await db.collection('data.QueueUser').findOne({ _id: user1Id });
		const user2 = await db.collection('data.QueueUser').findOne({ _id: user2Id });
		const user3 = await db.collection('data.QueueUser').findOne({ _id: user3Id });

		expect(user1?.next).to.be.equal(user2Id);
		expect(user2?.next).to.be.equal(user3Id);
		expect(user3?.next).to.be.equal(user1Id); // Circular
	});

	it('deve manter isCurrent quando existe um válido', async () => {
		// Arrange
		const user1Id = new ObjectId().toString();
		const user2Id = new ObjectId().toString();

		const queueUsers = [
			{
				_id: user1Id,
				queue: { _id: queueId },
				user: { _id: 'user1', name: 'User 1' },
				isCurrent: true,
				_createdAt: new Date('2024-01-01'),
			},
			{
				_id: user2Id,
				queue: { _id: queueId },
				user: { _id: 'user2', name: 'User 2' },
				isCurrent: false,
				_createdAt: new Date('2024-01-02'),
			},
		];

		await db.collection('data.QueueUser').insertMany(queueUsers);

		// Act
		const result = await recalculateQueue(queueId, testUser);

		// Assert
		expect(result.success).to.be.true;

		// Verificar que user1 ainda tem isCurrent: true
		const user1 = await db.collection('data.QueueUser').findOne({ _id: user1Id });
		expect(user1?.isCurrent).to.be.true;

		// Verificar que apenas um tem isCurrent
		const usersWithCurrent = await db
			.collection('data.QueueUser')
			.find({ 'queue._id': queueId, isCurrent: true })
			.toArray();
		expect(usersWithCurrent.length).to.be.equal(1);
	});

	it('deve definir isCurrent no primeiro quando não existe nenhum', async () => {
		// Arrange
		const user1Id = new ObjectId().toString();
		const user2Id = new ObjectId().toString();

		const queueUsers = [
			{
				_id: user1Id,
				queue: { _id: queueId },
				user: { _id: 'user1', name: 'User 1' },
				_createdAt: new Date('2024-01-01'),
			},
			{
				_id: user2Id,
				queue: { _id: queueId },
				user: { _id: 'user2', name: 'User 2' },
				_createdAt: new Date('2024-01-02'),
			},
		];

		await db.collection('data.QueueUser').insertMany(queueUsers);

		// Act
		const result = await recalculateQueue(queueId, testUser);

		// Assert
		expect(result.success).to.be.true;

		// Verificar que o primeiro (mais antigo) tem isCurrent: true
		const user1 = await db.collection('data.QueueUser').findOne({ _id: user1Id });
		expect(user1?.isCurrent).to.be.true;

		// Verificar que apenas um tem isCurrent
		const usersWithCurrent = await db
			.collection('data.QueueUser')
			.find({ 'queue._id': queueId, isCurrent: true })
			.toArray();
		expect(usersWithCurrent.length).to.be.equal(1);
	});

	it('deve retornar erro quando não há QueueUsers', async () => {
		// Act
		const result = await recalculateQueue(queueId, testUser);

		// Assert
		expect(result.success).to.be.false;
		expect(result.errors).to.not.be.undefined;
		expect(result.errors?.[0]?.message).to.include('No QueueUsers found');
	});
});
