/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const vm = require('vm');
const coffee = require('coffeescript');

const fn = function () {
	let e;
	const sandbox = vm.createContext({
		Models,
		cb(data) {
			return console.log('cb', data);
		}
	});

	let script = `\
exports.contact = Models.Contact.findOne()
exports.candidate = Models.Candidate.findOne()\
`;

	try {
		script = coffee.compile(script);
	} catch (error) {
		e = error;
		return console.log(e);
	}

	script = `\
var exports = {};
${script}
cb(exports);\
`;

	try {
		return vm.runInContext(script, sandbox);
	} catch (error1) {
		e = error1;
		return console.log(e);
	}
};

// setTimeout Meteor.bindEnvironment(fn), 1000
