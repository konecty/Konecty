import { createHash, randomBytes } from 'crypto';

class Password {
  hash(token, saltBase64, iterations) {
    const salt = new Buffer(saltBase64, 'base64');
    let result = createHash('sha256')
      .update(salt)
      .update(token)
      .digest();
    iterations--;

    while (iterations > 0) {
      iterations--;
      result = createHash('sha256')
        .update(result)
        .digest();
    }

    return result.toString('base64');
  }

  equals(storedPassword, token) {
    let array = storedPassword.split('$'),
      iterations = array[array.length - 3],
      salt = array[array.length - 2],
      password = array[array.length - 1];
    iterations = parseInt(iterations);
    token = this.hash(token, salt, iterations);

    return token === password;
  }

  generateSalt() {
    return randomBytes(16).toString('base64');
  }

  encrypt(value, iterations) {
    if (!iterations) {
      iterations = 1;
    }
    const salt = this.generateSalt();
    const password = this.hash(value, salt, iterations);

    return `$shiro1$SHA-256$${iterations}$${salt}$${password}`;
  }
}

password = new Password();

// console.log @password.equals "$shiro1$SHA-256$500000$uRdvxDqLnWKdGEH8y/fqKw==$9+8VwNX0GLx8tvF1NWELRLkpOyzqtrEQJQaseGM6BDE=", '698dc19d489c4e4db73e28a713eab07b'
