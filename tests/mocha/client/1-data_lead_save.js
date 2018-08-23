/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
if (typeof MochaWeb !== 'undefined' && MochaWeb !== null) {
	MochaWeb.testOnly(() =>
	describe("[method] data:save:lead", function() {
		it("should have 0 Contact", function(done) {
			const options = {
				document: 'Contact',
				limit: 1
			};

			return Meteor.call('data:find:all', options, function(err, result) {
				if (err != null) { return done(err); }
				try {
					chai.expect(result).to.be.an('object');
					chai.expect(result).to.have.keys(['success', 'data']);
					chai.expect(result.success).to.be.true;
					// chai.expect(result.data.length).to.be.equal(0)
					return done();
				} catch (e) {
					return done(e);
				}
			});
		});

		return it.skip("should save new Contact", function(done) {
			const request = {
				document: 'Contact',
				data: {
					name: {
						first: 'primeiro',
						last: 'contato inserido'
					},
					email: [
						{address: 'primeiro@contato.com'}
					]
				}
			};
					// queue:
					// 	_id: 'dvESwKLiWj9Adegyy'

			return Meteor.call('data:lead:save', request, function(err, result) {
				if (err != null) { return done(err); }
				try {
					chai.expect(result).to.be.an('object');
					chai.expect(result.success).to.be.true;

					chai.expect(result.data.length).to.be.equal(1);
					chai.expect(result.data[0]).to.contain.keys('code', 'name', 'email', 'status', '_user');

					// chai.expect(result.data[0].name).to.be.equal({ first: 'Primeiro', last: 'Contato Inserido', full: 'Primeiro Contato Inserido' })
					return done();
				} catch (e) {
					return done(e);
				}
			});
		});
	})
);
}



		// it "should have User collection", ->
		// 	# chai.expect(Object.keys(Models).join(',')).to.be.a('Object')
		// 	chai.expect(Meteor.users).to.be.a('Object')
		//
		//
		// it "should have 0 Users", ->
		// 	chai.expect(Meteor.users.find().count()).to.be.equal(0)
		//
		//
		// it "should have Users", ->
		// 	Accounts.createUser
		// 		username: 'test'
		// 		password: 'test'
		//
		// 	Meteor.users.updateOne {username: 'test'}, {$set: {
		// 		admin: true
		// 		active: true
		// 		access:
		// 			defaults: ['Full']
		// 	}}
		//
		// 	chai.expect(Meteor.users.find().count()).to.be.equal(1)
