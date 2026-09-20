const { UnauthorizedError, ServerError } = require('../errors/index')

module.exports = class httpResponse {
  static ok (acessToken) {
    return {
      statusCode: 200,
      body: {
        accessToken: acessToken
      }
    }
  }

  static badRequest (error) {
    return {
      statusCode: 400,
      body: error
    }
  }

  static unauthorizedError () {
    return {
      statusCode: 401,
      body: new UnauthorizedError()
    }
  }

  static serverError () {
    return {
      statusCode: 500,
      body: new ServerError()
    }
  }
}
