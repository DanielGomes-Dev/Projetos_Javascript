module.exports = {
  id: '',
  token: 'any_token',
  secret: '',
  sign (id, secret) {
    this.id = id
    this.secret = secret
    return this.token
  }
}
