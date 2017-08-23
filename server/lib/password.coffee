crypto = require 'crypto'

class Password
	hash: (token, saltBase64, iterations) ->
		salt = new Buffer saltBase64, 'base64'
		result = crypto.createHash('sha256').update(salt).update(token).digest()
		iterations--

		while iterations > 0
			iterations--
			result = crypto.createHash('sha256').update(result).digest()

		return result.toString 'base64'

	equals: (storedPassword, token) ->
		[..., iterations, salt, password] = storedPassword.split '$'
		iterations = parseInt iterations
		token = @hash token, salt, iterations

		return token is password

	generateSalt: ->
		return crypto.randomBytes(16).toString 'base64'

	encrypt: (value, iterations=1) ->
		salt = @generateSalt()
		password = @hash value, salt, iterations

		return "$shiro1$SHA-256$#{iterations}$#{salt}$#{password}"

@password = new Password

# console.log @password.equals "$shiro1$SHA-256$500000$uRdvxDqLnWKdGEH8y/fqKw==$9+8VwNX0GLx8tvF1NWELRLkpOyzqtrEQJQaseGM6BDE=", '698dc19d489c4e4db73e28a713eab07b'
