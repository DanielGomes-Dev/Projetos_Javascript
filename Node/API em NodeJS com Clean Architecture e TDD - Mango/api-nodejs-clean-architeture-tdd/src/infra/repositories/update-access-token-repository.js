const MissingParamError = require('../../utils/errors/missing-param-error')

module.exports = class UpdateAcessTokenRepository {
  constructor (userModel) {
    this.userModel = userModel
  }

  async update (userId, acessToken) {
    if (!userId) throw new MissingParamError('userId')
    if (!acessToken) throw new MissingParamError('acessToken')

    await this.userModel.updateOne({
      _id: userId
    }, {
      $set: {
        acessToken
      }
    })
  }
}
