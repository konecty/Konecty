/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
if (typeof MochaWeb !== 'undefined' && MochaWeb !== null) {
	MochaWeb.testOnly(() =>
	describe("Merge tests", function() {
		const dataToMerge = [];
		let lookupContact = null;
		let simulationResult = {};

		before(done =>
			Meteor.loginWithPassword({username: 'test'}, 'test', function(err) {
				if (err != null) { done(err); }
				return done();
			})
		);


		it("should user be logged as test", function() {
			chai.expect(Meteor.userId()).to.be.a('String');
			return chai.expect(Meteor.user()).to.have.property('username').equal('test');
		});


		it("should load menu", () => chai.expect(MetaObject.find({type: 'document'}).count()).to.be.equal(2));


		it("should allow create a contact", function(done) {
			const data = {
				document: 'Contact',
				data: {
					name: {
						first: 'Contact 1'
					},
					type: ['Cliente'],
					status: ['Faleceu']
				}
			};

			return Meteor.call('data:create', data, function(err, result) {
				if (err != null) { return done(err); }
				try {
					chai.expect(result).to.be.a('Object');
					chai.expect(result).to.have.property('data').with.length(1);
					chai.expect(result.data[0]).to.be.a('Object');
					chai.expect(result.data[0]).to.have.property('name').with.property('first').equal('Contact 1');
					dataToMerge.push(result.data[0]._id);
					return done();
				} catch (e) {
					return done(e);
				}
			});
		});


		it("should allow create a contact", function(done) {
			const data = {
				document: 'Contact',
				data: {
					name: {
						first: 'Contact 2'
					},
					type: ['Cliente'],
					status: ['Faleceu']
				}
			};

			return Meteor.call('data:create', data, function(err, result) {
				if (err != null) { return done(err); }
				try {
					chai.expect(result).to.be.a('Object');
					chai.expect(result).to.have.property('data').with.length(1);
					chai.expect(result.data[0]).to.be.a('Object');
					chai.expect(result.data[0]).to.have.property('name').with.property('first').equal('Contact 2');
					dataToMerge.push(result.data[0]._id);
					return done();
				} catch (e) {
					return done(e);
				}
			});
		});


		it("should allow create a contact", function(done) {
			const data = {
				document: 'Contact',
				data: {
					name: {
						first: 'Contact 3'
					},
					type: ['Cliente'],
					status: ['Faleceu'],
					staff: [
						{_id: dataToMerge[1]}
					]
				}
			};

			return Meteor.call('data:create', data, function(err, result) {
				if (err != null) { return done(err); }
				try {
					chai.expect(result).to.be.a('Object');
					chai.expect(result).to.have.property('data').with.length(1);
					chai.expect(result.data[0]).to.be.a('Object');
					chai.expect(result).to.have.deep.property('data[0].name.first', 'Contact 3');
					chai.expect(result).to.have.deep.property('data[0].staff[0]._id', dataToMerge[1]);
					chai.expect(result).to.have.deep.property('data[0].staff[0].name.full', 'Contact 2');
					lookupContact = result.data[0]._id;
					return done();
				} catch (e) {
					return done(e);
				}
			});
		});


		it("should simulate merge", function(done) {
			const data = {
				document: 'Contact',
				ids: dataToMerge,
				targetId: dataToMerge[0]
			};

			return Meteor.call('merge:simulate', data, function(err, r) {
				if (err != null) { return done(err); }
				try {
					chai.expect(r).to.not.be.equal(401);
					chai.expect(r).to.be.a('object');
					chai.expect(r).to.have.deep.property('merged.type[0]', 'Cliente');
					chai.expect(r).to.have.deep.property('merged.status[0]', 'Faleceu');

					chai.expect(r).to.have.deep.property('conflicts.name[0].value.first').that.match(/^Contact [12]$/);
					chai.expect(r).to.have.deep.property('conflicts.name[1].value.first').that.match(/^Contact [12]$/);
					simulationResult = r;
					return done();
				} catch (e) {
					return done(e);
				}
			});
		});


		it("should execute merge", function(done) {
			const data = {
				document: 'Contact',
				ids: dataToMerge,
				targetId: dataToMerge[0],
				data: simulationResult.merged
			};

			data.data.name = {first: 'Contact 2'};

			return Meteor.call('merge:save', data, function(err, r) {
				if (err != null) { return done(err); }
				try {
					chai.expect(r).to.not.be.equal(401);
					chai.expect(r).to.have.deep.property('data[0].name.first', data.data.name.first);
					return done();
				} catch (e) {
					return done(e);
				}
			});
		});


		it("should have target Contact", function(done) {
			const data = {
				document: 'Contact',
				dataId: dataToMerge[0]
			};

			return Meteor.call('data:find:byId', data, function(err, r) {
				if (err != null) { return done(err); }
				try {
					chai.expect(r).to.not.be.equal(401);
					chai.expect(r).to.have.property('total', 1);
					return done();
				} catch (e) {
					return done(e);
				}
			});
		});


		it("should be resolved staff lookup", function(done) {
			const data = {
				document: 'Contact',
				dataId: lookupContact
			};

			return Meteor.call('data:find:byId', data, function(err, r) {
				if (err != null) { return done(err); }
				try {
					chai.expect(r).to.not.be.equal(401);
					chai.expect(r).to.have.property('total', 1);
					chai.expect(r).to.have.deep.property('data[0].name.first', 'Contact 3');
					chai.expect(r).to.have.deep.property('data[0].staff[0]._id', dataToMerge[0]);
					return done();
				} catch (e) {
					return done(e);
				}
			});
		});


		return it("should not have merged Contact", function(done) {
			const data = {
				document: 'Contact',
				dataId: dataToMerge[1]
			};

			return Meteor.call('data:find:byId', data, function(err, r) {
				if (err != null) { return done(err); }
				try {
					chai.expect(r).to.not.be.equal(401);
					chai.expect(r).to.have.property('total', 0);
					return done();
				} catch (e) {
					return done(e);
				}
			});
		});
	})
);
}

		// it "should whait 1s", (done) ->
		// 	setTimeout done, 1000

		// it "should have correct merged history", (done) ->
		// 	data =
		// 		document: 'Contact'
		// 		dataId: dataToMerge[0]

		// 	Meteor.call 'history:find', data, (err, r) ->
		// 		console.log err, r
		// 		if err? then return done(err)
		// 		try
		// 			chai.expect(r).to.not.be.equal(401)
		// 			chai.expect(r).to.have.deep.property('data[1].diffs._merge.to').equal(dataToMerge)
		// 			done()
		// 		catch e
		// 			done(e)
