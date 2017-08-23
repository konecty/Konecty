vm = Npm.require 'vm'
coffee = Npm.require 'coffee-script'

fn = ->
	sandbox = vm.createContext
		Models: Models
		cb: (data) ->
			console.log 'cb', data

	script = """
			exports.contact = Models.Contact.findOne()
			exports.candidate = Models.Candidate.findOne()
		"""

	try
		script = coffee.compile script
	catch e
		return console.log e

	script = """
		var exports = {};
		#{script}
		cb(exports);
	"""

	try
		vm.runInContext script, sandbox
	catch e
		console.log e

# setTimeout Meteor.bindEnvironment(fn), 1000
