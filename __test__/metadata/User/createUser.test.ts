import { expect } from 'chai';
import { login } from '../../utils/login';
import { KonectyResponse } from '../../utils/types';

describe('Create User', () => {
	describe('Admin', () => {
		const authId = login('admin-test');

		it('Create User', async () => {
			// Arrange
			const requiredFields = {
				name: 'Teste',
				active: true,
				group: { _id: 'YM3utZ6EMmrFsbHZc', name: 'User' },
				role: { _id: 'Fr9y2Gc6xisQ3NkEu', name: 'User' },
				locale: 'pt_BR',
				username: 'teste',
			};

			const productUser = [
				{
					_id: '4ffcf81084aecfbaff50fd05',
					group: { _id: 'PvG8jXQw2J7LqwdHJ', name: 'ADMIN' },
					name: 'Admin-test',
					active: true,
				},
			];

			const createAndUpdateUser = {
				_id: '4ffcf81084aecfbaff50fd05',
				name: 'Admin-test',
				group: { _id: 'PvG8jXQw2J7LqwdHJ', name: 'ADMIN' },
			};

			// Act
			const data = (await fetch(`${process.env.BASE_URL || 'http://127.0.0.1:3000/rest'}/data/User`, {
				method: 'POST',
				headers: {
					Cookie: `_authTokenId=${authId}`,
					'Content-Type': 'application/json',
				},
				body: JSON.stringify(requiredFields),
			}).then(res => res.json())) as KonectyResponse;

			// Assert
			expect(data.success).to.be.equal(true);
			expect(data.data?.[0].name).to.be.equal('Teste');
			expect(data.data?.[0]._user).to.be.deep.equal(productUser);
			expect(data.data?.[0]._updatedBy).to.be.deep.equal(createAndUpdateUser);
			expect(data.data?.[0]._createdBy).to.be.deep.equal(createAndUpdateUser);
		});
	});
});
