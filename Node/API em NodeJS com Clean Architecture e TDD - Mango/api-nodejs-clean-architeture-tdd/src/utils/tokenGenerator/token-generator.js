const jwt = require('jsonwebtoken')
const MissinParamError = require('../errors/missing-param-error')

class TokenGenerator {
  constructor (secret) {
    this.secret = secret
  }

  async generate (id) {
    if (!this.secret) throw new MissinParamError('secret')
    if (!id) throw new MissinParamError('id')

    return jwt.sign(id, this.secret)
  }
}

module.exports = TokenGenerator
