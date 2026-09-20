const httpResponse = require('../helpers/http-response')
const { MissingParamError, InvalidParamError } = require('../../utils/errors')
module.exports = class LoginRouter {
    constructor({ authUseCase, emailValidator } = {}) {
        this.authUseCase = authUseCase
        this.emailValidator = emailValidator
    }

    async route(httpRequest) {
        try {
            const { email, password } = httpRequest.body

            if (!email) return httpResponse.badRequest(new MissingParamError('email'))
            if (!password) return httpResponse.badRequest(new MissingParamError('password'))

            if (!this.emailValidator.isValid(email)) return httpResponse.badRequest(new InvalidParamError('email'))

            const acessToken = this.authUseCase.auth(email, password)
            if (!acessToken) return await httpResponse.unauthorizedError()

            return httpResponse.ok(acessToken)
        } catch (error) {
            // console.error(error)
            return httpResponse.serverError()
        }
    }
}