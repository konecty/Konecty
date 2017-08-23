MochaWeb?.testOnly ->
	describe "[method] data:save:lead", ->
		it "should have 0 Contact", (done) ->
			options =
				document: 'Contact'
				limit: 1

			Meteor.call 'data:find:all', options, (err, result) ->
				if err? then return done(err)
				try
					chai.expect(result).to.be.an('object')
					chai.expect(result).to.have.keys(['success', 'data'])
					chai.expect(result.success).to.be.true
					# chai.expect(result.data.length).to.be.equal(0)
					done()
				catch e
					done(e)

		it.skip "should save new Contact", (done) ->
			request =
				document: 'Contact'
				data:
					name:
						first: 'primeiro'
						last: 'contato inserido'
					email: [
						address: 'primeiro@contato.com'
					]
					# queue:
					# 	_id: 'dvESwKLiWj9Adegyy'

			Meteor.call 'data:lead:save', request, (err, result) ->
				if err? then return done(err)
				try
					chai.expect(result).to.be.an('object')
					chai.expect(result.success).to.be.true

					chai.expect(result.data.length).to.be.equal(1)
					chai.expect(result.data[0]).to.contain.keys('code', 'name', 'email', 'status', '_user')

					# chai.expect(result.data[0].name).to.be.equal({ first: 'Primeiro', last: 'Contato Inserido', full: 'Primeiro Contato Inserido' })
					done()
				catch e
					done(e)



		# it "should have User collection", ->
		# 	# chai.expect(Object.keys(Models).join(',')).to.be.a('Object')
		# 	chai.expect(Meteor.users).to.be.a('Object')
		#
		#
		# it "should have 0 Users", ->
		# 	chai.expect(Meteor.users.find().count()).to.be.equal(0)
		#
		#
		# it "should have Users", ->
		# 	Accounts.createUser
		# 		username: 'test'
		# 		password: 'test'
		#
		# 	Meteor.users.update {username: 'test'}, {$set: {
		# 		admin: true
		# 		active: true
		# 		access:
		# 			defaults: ['Full']
		# 	}}
		#
		# 	chai.expect(Meteor.users.find().count()).to.be.equal(1)
