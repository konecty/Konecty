import { MongoClient } from 'mongodb';

import isString from 'lodash/isString';
import isNumber from 'lodash/isNumber';
import size from 'lodash/size';
import get from 'lodash/get';

import { Models } from '@konecty/metadata';

import { unicodeSortArrayOfObjectsByParam } from '@konecty/utils';

import { registerMethod } from '@konecty/utils/methods';

const accentToRegex = function (str) {
	str = str.toLowerCase();

	str = str.replace('a', '[aàáâãäåæ]');
	str = str.replace('c', '[cç]');
	str = str.replace('d', '[DÐ]');
	str = str.replace('e', '[eèéêëẽ]');
	str = str.replace('i', '[iìíîïĩ]');
	str = str.replace('o', '[oœðñòóôõöø]');
	str = str.replace('u', '[uµùúûü]');
	str = str.replace('s', '[sšß]');
	str = str.replace('z', '[zž]');
	str = str.replace('y', '[yýÿY¥]');
	str = str.replace('\\', '\\\\');
	return str;
};

const init = async () => {
	const client = new MongoClient(process.env.MONGO_URL, {
		auto_reconnect: true,
		poolSize: 2,
	});

	await client.connect();

	const db = client.db('utils');

	registerMethod('DNE_CEP_List', async function (cep) {
		const placeCollection = db.collection('utils.address.BRA.place');

		let query = { postalCode: cep };

		let options = {
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
		};

		const results = await placeCollection.find(query, options).toArray();

		if (results?.length > 0) {
			for (const result of results) {
				result.district = result.startNeighbourhood;
				delete result.startNeighbourhood;
			}

			return results;
		} else {
			// If results are not found on places collection, look for them on city collection
			const cityCollection = db.collection('utils.address.BRA.city');

			query = { postalCode: cep };

			options = {
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
			};

			results = await cityCollection.find(query, options).toArray();
			return results;
		}
	});

	registerMethod('DNE_City_List', async function (state, city) {
		const cityCollection = db.collection('utils.address.BRA.city');

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

		results = unicodeSortArrayOfObjectsByParam(results, 'city');

		return results;
	});

	registerMethod('DNE_District_List', async function (state, city, district) {
		const districtCollection = db.collection('utils.address.BRA.district');

		const query = { state };

		if (district !== '*') {
			query.district = new RegExp(accentToRegex(district), 'i');
		}

		if (city !== '*') {
			query.city = city;
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

		let results = await districtCollection.find(query, options).toArray();

		// Get local ditricts
		if (Models['AddressPlace']) {
			const districts = [];
			for (let result of results) {
				districts.push(result.district);
			}

			query = { state };

			if (city !== '*') {
				query.city = city;
			}

			if (district !== '*') {
				query.$and = [{ startNeighbourhood: new RegExp(accentToRegex(district), 'i') }, { startNeighbourhood: { $nin: districts } }];
			} else {
				query.startNeighbourhood = { $nin: districts };
			}

			const match = { $match: query };

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

			const localResults = await Models['AddressPlace'].aggregate(pipeline, { cursor: { batchSize: 1 } }).toArray();

			if (get(localResults, 'length', 0) > 0) {
				results = results.concat(localResults);
			}
		}

		// Sort and return results
		results = unicodeSortArrayOfObjectsByParam(results, 'district');

		return results;
	});

	registerMethod('DNE_Place_List', async function (state, city, district, place, number, limit) {
		const placeCollection = db.collection('utils.address.BRA.place');

		const query = {
			state,
			city,
		};

		if (district !== '*') {
			query.startNeighbourhood = district;
		}

		if (place !== '*') {
			query.place = new RegExp(accentToRegex(place), 'i');
		}

		if (number && number !== '*' && /^\d+$/.test(number)) {
			number = parseInt(number);

			query['$and'] = [{ $or: [{ init: { $exists: 0 } }, { init: { $lte: number } }] }, { $or: [{ end: { $exists: 0 } }, { end: { $gte: number } }] }];

			if (number % 2 === 0) {
				query.even = true;
			} else {
				query.odd = true;
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

		let results = await placeCollection.aggregate(pipeline, { cursor: { batchSize: 1 } }).toArray();

		if (Models['AddressPlace']) {
			delete query.even;
			delete query.odd;

			const localResults = await Models['AddressPlace'].aggregate(pipeline, { cursor: { batchSize: 1 } }).toArray();

			if (size(localResults) > 0) {
				results = results.concat(localResults);
			}
		}

		for (let result of results) {
			if (get(result, 'postalCode.length') === 1) {
				result.postalCode = result.postalCode[0];
			}
		}

		unicodeSortArrayOfObjectsByParam(results, 'place');

		return results;
	});
};

export { init };
