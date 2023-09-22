import isString from 'lodash/isString';
import isNumber from 'lodash/isNumber';
import first from 'lodash/first';
import unset from 'lodash/unset';
import set from 'lodash/set';
import sortBy from 'lodash/sortBy';
import toLower from 'lodash/toLower';

import { Collections } from '/imports/model/MetaObject';

import { dneDB } from '/imports/database';

const accentToRegex = function (str) {
	return toLower(str)
		.replace(/a/g, '[aàáâãäåæ]')
		.replace(/c/g, '[cç]')
		.replace(/d/g, '[DÐ]')
		.replace(/e/g, '[eèéêëẽ]')
		.replace(/i/g, '[iìíîïĩ]')
		.replace(/o/g, '[oœðñòóôõöø]')
		.replace(/u/g, '[uµùúûü]')
		.replace(/s/g, '[sšß]')
		.replace(/z/g, '[zž]')
		.replace(/y/g, '[yýÿY¥]')
		.replace(/\\/g, '\\\\');
};

export async function DNE_CEP_List(cep) {
	const placeCollection = dneDB.collection('utils.address.BRA.place');

	const results = await placeCollection
		.find(
			{ postalCode: cep },
			{
				fields: {
					_id: 0,
					startNeighbourhood: 1,
					postalCode: 1,
					place: 1,
					placeType: 1,
					init: 1,
					end: 1,
					city: 1,
					state: 1,
				},
				sort: {
					country: 1,
					state: 1,
					city: 1,
					district: 1,
					place: 1,
					number: 1,
					complement: 1,
					postalCode: 1,
					placeType: 1,
				},
			},
		)
		.toArray();

	if (results.length > 0) {
		return results.map(result => {
			set(result, 'district', result.startNeighbourhood);
			unset(result, 'startNeighbourhood');
			return result;
		});

		// If results are not found on places collection, look for them on city collection
	} else {
		const cityCollection = dneDB.collection('utils.address.BRA.city');

		const cityResults = await cityCollection
			.find(
				{ postalCode: cep },
				{
					fields: {
						_id: 0,
						postalCode: 1,
						city: 1,
						state: 1,
					},
					sort: {
						state: 1,
						city: 1,
						postalCode: 1,
					},
				},
			)
			.toArray();

		return cityResults;
	}
}

export async function DNE_City_List(state, city) {
	const cityCollection = dneDB.collection('utils.address.BRA.city');

	const query = { state };

	if (city !== '*') {
		query.city = new RegExp(accentToRegex(city), 'i');
	}

	const options = {
		fields: {
			_id: 0,
			postalCode: 1,
			city: 1,
			state: 1,
		},
		sort: {
			city: 1,
		},
	};

	const results = await cityCollection.find(query, options).toArray();

	return sortBy(results, ['city']);
}

export async function DNE_District_List(state, city, district) {
	const districtCollection = dneDB.collection('utils.address.BRA.district');

	const addressPlacesCollection = Collections['AddressPlace'];

	const query = { state };

	if (district !== '*') {
		set(query, 'district', new RegExp(accentToRegex(district), 'i'));
	}

	if (city !== '*') {
		set(query, 'city', city);
	}

	const options = {
		fields: {
			_id: 0,
			district: 1,
			postalCode: 1,
			city: 1,
			state: 1,
		},
		sort: {
			district: 1,
		},
	};

	const results = (await districtCollection.find(query, options).toArray()) ?? [];

	// Get local ditricts
	if (addressPlacesCollection != null) {

		const districts = results.map(result => result.district);
		const addressPlacesQuery = { state };

		if (city !== '*') {
			set(addressPlacesQuery, 'city', city);
		}

		if (district !== '*') {
			set(addressPlacesQuery, '$and', [{ startNeighbourhood: new RegExp(accentToRegex(district), 'i') }, { startNeighbourhood: { $nin: districts } }]);
		} else {
			set(addressPlacesQuery, 'startNeighbourhood', { $nin: districts });
		}

		const match = { $match: addressPlacesQuery };

		const group = {
			$group: {
				_id: {
					city: '$city',
					state: '$state',
					startNeighbourhood: '$startNeighbourhood',
				},
				district: {
					$first: '$startNeighbourhood',
				},
				postalCode: {
					$first: '$postalCode',
				},
				city: {
					$first: '$city',
				},
				state: {
					$first: '$state',
				},
			},
		};

		const project = {
			$project: {
				_id: 0,
				district: 1,
				postalCode: 1,
				placeType: 1,
				city: 1,
				state: 1,
			},
		};

		const sort = {
			$sort: {
				place: 1,
			},
		};

		const pipeline = [match, group, project, sort];

		const localResults = await addressPlacesCollection.aggregate(pipeline).toArray();

		if (localResults.length > 0) {
			results.push(...localResults);
		}
	}

	return sortBy(results, ['district']);
}

export async function DNE_Place_List(state, city, district, place, number, limit) {
	const placeCollection = dneDB.collection('utils.address.BRA.place');
	const addressPlacesCollection = Collections['AddressPlace'];

	const query = {
		state,
		city,
	};

	if (district !== '*') {
		set(query, 'startNeighbourhood', district);
	}

	if (place !== '*') {
		set(query, 'place', new RegExp(accentToRegex(place), 'i'));
	}

	if (number && number !== '*' && /^\d+$/.test(number)) {
		number = parseInt(number);

		set(query, '$and', [{ $or: [{ init: { $exists: 0 } }, { init: { $lte: number } }] }, { $or: [{ end: { $exists: 0 } }, { end: { $gte: number } }] }]);

		if (number % 2 === 0) {
			set(query, 'even', true);
		} else {
			set(query, 'odd', true);
		}
	}
	const match = { $match: query };

	const group = {
		$group: {
			_id: {
				city: '$city',
				state: '$state',
				place: '$place',
			},
			district: {
				$first: '$startNeighbourhood',
			},
			postalCode: {
				$addToSet: '$postalCode',
			},
			placeType: {
				$first: '$placeType',
			},
			init: {
				$min: '$init',
			},
			end: {
				$max: '$end',
			},
			city: {
				$first: '$city',
			},
			state: {
				$first: '$state',
			},
			place: {
				$first: '$place',
			},
		},
	};

	const project = {
		$project: {
			_id: 0,
			district: 1,
			postalCode: 1,
			placeType: 1,
			init: 1,
			end: 1,
			city: 1,
			state: 1,
			place: 1,
		},
	};

	const sort = {
		$sort: {
			place: 1,
		},
	};

	const pipeline = [match, group, project, sort];

	if (limit) {
		if (isString(limit) && /^l:[1-9]\d*$/.test(limit)) {
			pipeline.push({ $limit: parseInt(limit.split(':').pop()) });
		} else if (isNumber(limit)) {
			pipeline.push({ $limit: limit });
		}
	}

	const results = await placeCollection.aggregate(pipeline).toArray();

	if (addressPlacesCollection != null) {
		unset(query, 'even');
		unset(query, 'odd');

		const localResults = await addressPlacesCollection.aggregate(pipeline, { cursor: { batchSize: 1 } }).toArray();

		if (localResults.length > 0) {
			results.push(...localResults);
		}
	}

	return sortBy(
		results.map(entry => {
			if (Array.isArray(entry.postalCode) && entry.postalCode.length === 1) {
				entry.postalCode = first(entry.postalCode);
			}
			return entry;
		}),
		['place'],
	);
}
