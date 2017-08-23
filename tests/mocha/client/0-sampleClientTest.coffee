MochaWeb?.testOnly ->
	describe "Merge tests", ->
		dataToMerge = []
		lookupContact = null
		simulationResult = {}

		before (done) ->
			Meteor.loginWithPassword {username: 'test'}, 'test', (err) ->
				if err? then done(err)
				done()


		it "should user be logged as test", ->
			chai.expect(Meteor.userId()).to.be.a('String')
			chai.expect(Meteor.user()).to.have.property('username').equal('test')


		it "should load menu", ->
			chai.expect(MetaObject.find({type: 'document'}).count()).to.be.equal(2)


		it "should allow create a contact", (done) ->
			data =
				document: 'Contact',
				data:
					name:
						first: 'Contact 1'
					type: ['Cliente']
					status: ['Faleceu']

			Meteor.call 'data:create', data, (err, result) ->
				if err? then return done(err)
				try
					chai.expect(result).to.be.a('Object')
					chai.expect(result).to.have.property('data').with.length(1)
					chai.expect(result.data[0]).to.be.a('Object')
					chai.expect(result.data[0]).to.have.property('name').with.property('first').equal('Contact 1')
					dataToMerge.push result.data[0]._id
					done()
				catch e
					done(e)


		it "should allow create a contact", (done) ->
			data =
				document: 'Contact',
				data:
					name:
						first: 'Contact 2'
					type: ['Cliente']
					status: ['Faleceu']

			Meteor.call 'data:create', data, (err, result) ->
				if err? then return done(err)
				try
					chai.expect(result).to.be.a('Object')
					chai.expect(result).to.have.property('data').with.length(1)
					chai.expect(result.data[0]).to.be.a('Object')
					chai.expect(result.data[0]).to.have.property('name').with.property('first').equal('Contact 2')
					dataToMerge.push result.data[0]._id
					done()
				catch e
					done(e)


		it "should allow create a contact", (done) ->
			data =
				document: 'Contact',
				data:
					name:
						first: 'Contact 3'
					type: ['Cliente']
					status: ['Faleceu']
					staff: [
						_id: dataToMerge[1]
					]

			Meteor.call 'data:create', data, (err, result) ->
				if err? then return done(err)
				try
					chai.expect(result).to.be.a('Object')
					chai.expect(result).to.have.property('data').with.length(1)
					chai.expect(result.data[0]).to.be.a('Object')
					chai.expect(result).to.have.deep.property('data[0].name.first', 'Contact 3')
					chai.expect(result).to.have.deep.property('data[0].staff[0]._id', dataToMerge[1])
					chai.expect(result).to.have.deep.property('data[0].staff[0].name.full', 'Contact 2')
					lookupContact = result.data[0]._id
					done()
				catch e
					done(e)


		it "should simulate merge", (done) ->
			data =
				document: 'Contact'
				ids: dataToMerge
				targetId: dataToMerge[0]

			Meteor.call 'merge:simulate', data, (err, r) ->
				if err? then return done(err)
				try
					chai.expect(r).to.not.be.equal(401)
					chai.expect(r).to.be.a('object')
					chai.expect(r).to.have.deep.property('merged.type[0]', 'Cliente')
					chai.expect(r).to.have.deep.property('merged.status[0]', 'Faleceu')

					chai.expect(r).to.have.deep.property('conflicts.name[0].value.first').that.match(/^Contact [12]$/)
					chai.expect(r).to.have.deep.property('conflicts.name[1].value.first').that.match(/^Contact [12]$/)
					simulationResult = r
					done()
				catch e
					done(e)


		it "should execute merge", (done) ->
			data =
				document: 'Contact'
				ids: dataToMerge
				targetId: dataToMerge[0]
				data: simulationResult.merged

			data.data.name = first: 'Contact 2'

			Meteor.call 'merge:save', data, (err, r) ->
				if err? then return done(err)
				try
					chai.expect(r).to.not.be.equal(401)
					chai.expect(r).to.have.deep.property('data[0].name.first', data.data.name.first)
					done()
				catch e
					done(e)


		it "should have target Contact", (done) ->
			data =
				document: 'Contact'
				dataId: dataToMerge[0]

			Meteor.call 'data:find:byId', data, (err, r) ->
				if err? then return done(err)
				try
					chai.expect(r).to.not.be.equal(401)
					chai.expect(r).to.have.property('total', 1)
					done()
				catch e
					done(e)


		it "should be resolved staff lookup", (done) ->
			data =
				document: 'Contact'
				dataId: lookupContact

			Meteor.call 'data:find:byId', data, (err, r) ->
				if err? then return done(err)
				try
					chai.expect(r).to.not.be.equal(401)
					chai.expect(r).to.have.property('total', 1)
					chai.expect(r).to.have.deep.property('data[0].name.first', 'Contact 3')
					chai.expect(r).to.have.deep.property('data[0].staff[0]._id', dataToMerge[0])
					done()
				catch e
					done(e)


		it "should not have merged Contact", (done) ->
			data =
				document: 'Contact'
				dataId: dataToMerge[1]

			Meteor.call 'data:find:byId', data, (err, r) ->
				if err? then return done(err)
				try
					chai.expect(r).to.not.be.equal(401)
					chai.expect(r).to.have.property('total', 0)
					done()
				catch e
					done(e)

		# it "should whait 1s", (done) ->
		# 	setTimeout done, 1000

		# it "should have correct merged history", (done) ->
		# 	data =
		# 		document: 'Contact'
		# 		dataId: dataToMerge[0]

		# 	Meteor.call 'history:find', data, (err, r) ->
		# 		console.log err, r
		# 		if err? then return done(err)
		# 		try
		# 			chai.expect(r).to.not.be.equal(401)
		# 			chai.expect(r).to.have.deep.property('data[1].diffs._merge.to').equal(dataToMerge)
		# 			done()
		# 		catch e
		# 			done(e)
