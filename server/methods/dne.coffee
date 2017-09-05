connection = {}

getUtilDb = ->
	Mongodb = MongoInternals.NpmModule
	Db = Mongodb.Db
	Server = Mongodb.Server

	host = process.env.MONGO_URL.replace 'mongodb://', ''
	hostPort = host.split('/').shift().split(':')

	host = hostPort[0]
	port = hostPort[1] || 27017

	server = new Server host, port, {auto_reconnect: true, poolSize: 2}
	db_connection = new Db 'utils', server, {w:0, native_parser: false}

	db_connection.open (err, db) ->
		connection.db = db


getUtilDb()

accentToRegex = (str) ->
	str = str.toLowerCase()

	str = str.replace 'a', '[aàáâãäåæ]'
	str = str.replace 'c', '[cç]'
	str = str.replace 'd', '[DÐ]'
	str = str.replace 'e', '[eèéêëẽ]'
	str = str.replace 'i', '[iìíîïĩ]'
	str = str.replace 'o', '[oœðñòóôõöø]'
	str = str.replace 'u', '[uµùúûü]'
	str = str.replace 's', '[sšß]'
	str = str.replace 'z', '[zž]'
	str = str.replace 'y', '[yýÿY¥]'
	return str

Meteor.methods
	DNE_CEP_List: (cep) ->
		placeCollection = connection.db.collection 'utils.address.BRA.place'

		query =
			postalCode: cep

		options =
			fields:
				_id: 0
				startNeighbourhood: 1
				postalCode: 1
				place: 1
				placeType: 1
				init: 1
				end: 1
				city: 1
				state: 1
			sort:
				country: 1
				state: 1
				city: 1
				district: 1
				place: 1
				number: 1
				complement: 1
				postalCode: 1
				placeType: 1

		find = placeCollection.find(query, options)

		toArray = Meteor.wrapAsync find.toArray, find

		results = toArray()

		if results.length
			for result in results
				result.district = result.startNeighbourhood
				delete result.startNeighbourhood

			return results

		# If results are not found on places collection, look for them on city collection
		else
			cityCollection = connection.db.collection 'utils.address.BRA.city'

			query =
				postalCode: cep

			options =
				fields:
					_id: 0
					postalCode: 1
					city: 1
					state: 1
				sort:
					state: 1
					city: 1
					postalCode: 1

			find = cityCollection.find(query, options)

			toArray = Meteor.wrapAsync find.toArray, find

			results = toArray()
			return results

	DNE_City_List: (state, city) ->
		cityCollection = connection.db.collection 'utils.address.BRA.city'

		query =
			state: state

		if city isnt '*'
			query.city = new RegExp accentToRegex(city), 'i'

		options =
			fields:
				_id: 0
				postalCode: 1
				city: 1
				state: 1
			sort:
				city: 1

		find = cityCollection.find(query, options)

		toArray = Meteor.wrapAsync find.toArray, find

		results = toArray()

		results = utils.unicodeSortArrayOfObjectsByParam results, 'city'

		return results

	DNE_District_List: (state, city, district) ->
		districtCollection = connection.db.collection 'utils.address.BRA.district'

		query =
			state: state

		if district isnt '*'
			query.district = new RegExp accentToRegex(district), 'i'

		if city isnt '*'
			query.city = city

		options =
			fields:
				_id: 0
				district: 1
				postalCode: 1
				city: 1
				state: 1
			sort:
				district: 1

		find = districtCollection.find(query, options)

		toArray = Meteor.wrapAsync find.toArray, find

		results = toArray()

		# Get local ditricts
		if Models['AddressPlace']?
			districts = []
			districts.push result.district for result in results

			query =
				state: state

			if city isnt '*'
				query.city = city

			if district isnt '*'
				query.$and = [
					{startNeighbourhood: new RegExp accentToRegex(district), 'i'}
					{startNeighbourhood: {$nin: districts}}
				]
			else
				query.startNeighbourhood = $nin: districts

			match = $match: query

			group =
				$group:
					_id:
						city: '$city'
						state: '$state'
						startNeighbourhood: '$startNeighbourhood'
					district: $first: '$startNeighbourhood'
					postalCode: $first: '$postalCode'
					city: $first: '$city'
					state: $first: '$state'

			project =
				$project:
					_id: 0
					district: 1
					postalCode: 1
					placeType: 1
					city: 1
					state: 1

			sort =
				$sort:
					place: 1

			pipeline = [match, group, project, sort]

			localResults = Models['AddressPlace'].aggregate pipeline

			if localResults?.length > 0
				results = results.concat localResults

		# Sort and return results
		results = utils.unicodeSortArrayOfObjectsByParam results, 'district'

		return results

	DNE_Place_List: (state, city, district, place, number, limit) ->
		placeCollection = connection.db.collection 'utils.address.BRA.place'

		query =
			state: state
			city: city

		if district isnt '*'
			query.startNeighbourhood = district

		if place isnt '*'
			query.place = new RegExp accentToRegex(place), 'i'

		if number? and number isnt '*' and /^\d+$/.test number
			number = parseInt number

			query['$and'] = [ 
				{ $or: [ { init: { $exists: 0 } }, { init: { $lte: number } } ] }
				{ $or: [ { end: { $exists: 0 } }, { end: { $gte: number } } ] }
			]
			
			if number % 2 is 0
				query.even = true
			else
				query.odd = true

		match = $match: query

		group =
			$group:
				_id:
					city: '$city'
					state: '$state'
					place: '$place'
				district: $first: '$startNeighbourhood'
				postalCode: $addToSet: '$postalCode'
				placeType: $first: '$placeType'
				init: $min: '$init'
				end: $max: '$end'
				city: $first: '$city'
				state: $first: '$state'
				place: $first: '$place'

		project =
			$project:
				_id: 0
				district: 1
				postalCode: 1
				placeType: 1
				init: 1
				end: 1
				city: 1
				state: 1
				place: 1

		sort =
			$sort:
				place: 1

		pipeline = [match, group, project, sort]

		if limit? 
			if _.isString(limit) and /^l:[1-9]\d*$/.test limit
				pipeline.push $limit: parseInt limit.split(':').pop()
			else if _.isNumber(limit)
				pipeline.push $limit: limit

		aggregate = Meteor.wrapAsync placeCollection.aggregate, placeCollection

		results = aggregate pipeline

		if Models['AddressPlace']?
			delete query.even
			delete query.odd

			localResults = Models['AddressPlace'].aggregate pipeline

			if localResults?.length > 0
				results = results.concat localResults

		for result in results
			if result.postalCode?.length is 1
				result.postalCode = result.postalCode[0]

		results = utils.unicodeSortArrayOfObjectsByParam results, 'place'

		return results
