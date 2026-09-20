const validator = require('validator')
const MissingParamError = require('../errors/missing-param-error')
const EmailValidator = require('./email-validator')

const makeSut = () => {
  // Criar um makeSut para caso ela precise de alguma dependencia não sera nescessario alterar todos os testes;
  return new EmailValidator()
}

describe('Email Validator', () => {
  test('Should return true if validator return true', () => {
    const sut = makeSut()
    const isEmailvalid = sut.isValid('valid_email@mail.com')
    expect(isEmailvalid).toBe(true)
  })

  test('Should return false if validator return false', () => {
    validator.isEmailValid = false
    const sut = makeSut()
    const isEmailValid = sut.isValid('invalid_email@mail.com')

    expect(isEmailValid).toBe(false)
  })

  test('Should call validator with correct email', () => {
    const sut = makeSut()
    const emailValid = 'any_email@mail.com'
    sut.isValid(emailValid)
    expect(validator.email).toBe(emailValid)
  })

  test('Should throw if no email are provided', async () => {
    const sut = makeSut()
    expect(() => { sut.isValid() }).toThrow(new MissingParamError('email'))
  })
})
