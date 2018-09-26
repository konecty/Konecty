if (typeof MochaWeb !== 'undefined' && MochaWeb !== null) {
  MochaWeb.testOnly(() =>
    describe('[method] data:save:lead', function() {
      it('should have 0 Contact', function(done) {
        const options = {
          document: 'Contact',
          limit: 1
        };

        Meteor.call('data:find:all', options, function(err, result) {
          if (err) {
            return done(err);
          }
          try {
            chai.expect(result).to.be.an('object');
            chai.expect(result).to.have.keys(['success', 'data']);
            chai.expect(result.success).to.be.true;
            // chai.expect(result.data.length).to.be.equal(0)
            done();
          } catch (e) {
            done(e);
          }
        });
      });

      it.skip('should save new Contact', function(done) {
        const request = {
          document: 'Contact',
          data: {
            name: {
              first: 'primeiro',
              last: 'contato inserido'
            },
            email: [{ address: 'primeiro@contato.com' }]
          }
        };
        // queue:
        // 	_id: 'dvESwKLiWj9Adegyy'

        Meteor.call('data:lead:save', request, function(err, result) {
          if (err) {
            return done(err);
          }
          try {
            chai.expect(result).to.be.an('object');
            chai.expect(result.success).to.be.true;

            chai.expect(result.data.length).to.be.equal(1);
            chai.expect(result.data[0]).to.contain.keys('code', 'name', 'email', 'status', '_user');

            // chai.expect(result.data[0].name).to.be.equal({ first: 'Primeiro', last: 'Contato Inserido', full: 'Primeiro Contato Inserido' })
            done();
          } catch (e) {
            done(e);
          }
        });
      });
    })
  );
}
