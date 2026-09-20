import SignUpController from './signup'
import { InvalidParamError, MissingParamError, ServerError } from '../../errors'
import { EmailValidator, HttpRequest, HttpResponse, AddAccount, AddAccountModel } from './signup-protocols'
import { AccountModel } from '../../../domain/models/account'

interface SutTypes {
  sut: SignUpController
  emailValidatorStub: EmailValidator
  addAccountStub: AddAccount
}

const makeEmailValidator = (): EmailValidator => {
  class EmailValidatorStub implements EmailValidator { // Versão Mockada do Email validator
    // Stub -> duble de teste -> tipos de mock
    isValid (email: string): boolean {
      return true
    }
  }
  const emailValidatorStub = new EmailValidatorStub()
  return emailValidatorStub
}

const makeAddAccount = (): AddAccount => {
  class AddAccountStub implements AddAccount { // Versão Mockada do Email validator
    // Stub -> duble de teste -> tipos de mock
    async add (account: AddAccountModel): Promise<AccountModel> {
      const fakeAccount = {
        id: 'valid_id',
        name: account.name,
        email: account.email,
        password: account.password
      }
      return await new Promise(resolve => { resolve(fakeAccount) })
    }
  }
  const addAccountStubStub = new AddAccountStub()
  return addAccountStubStub
}

// const makeEmailValidatorWithError = (): EmailValidator => {
//   class EmailValidatorStub implements EmailValidator {
//     isValid (email: string): boolean {
//       throw new Error()
//     }
//   }
//   const emailValidatorStub = new EmailValidatorStub()
//   return emailValidatorStub
// }

const makeSut = (): SutTypes => {
  const addAccountStub = makeAddAccount()
  const emailValidatorStub = makeEmailValidator()
  const sut = new SignUpController(emailValidatorStub, addAccountStub)
  return { sut, emailValidatorStub, addAccountStub }
}

describe('SignUp Controller', () => {
  test('should return 400 if no name is provided', async () => {
    // sut = system under test
    const { sut } = makeSut()
    const httpRequest: HttpRequest = {
      body: {
        // name: 'any_name',
        email: 'any_email@mail.com',
        password: 'any_password',
        passwordConfirmation: 'any_password'
      }
    }
    const httpResponse: HttpResponse = await sut.handle(httpRequest)
    expect(httpResponse?.statusCode).toBe(400)
    expect(httpResponse?.body).toEqual(new MissingParamError('name'))
  })

  test('should return 400 if no email is provided', async () => {
    // sut = system under test
    const { sut } = makeSut()
    const httpRequest: HttpRequest = {
      body: {
        name: 'any_name',
        // email: 'any_email@mail.com',
        password: 'any_password',
        passwordConfirmation: 'any_password'
      }
    }
    const httpResponse: HttpResponse = await sut.handle(httpRequest)
    expect(httpResponse?.statusCode).toBe(400)
    expect(httpResponse?.body).toEqual(new MissingParamError('email'))
  })

  test('should return 400 if no password is provided', async () => {
    // sut = system under test
    const { sut } = makeSut()
    const httpRequest: HttpRequest = {
      body: {
        name: 'any_name',
        email: 'any_email@mail.com',
        // password: 'any_password',
        passwordConfirmation: 'any_password'
      }
    }
    const httpResponse: HttpResponse = await sut.handle(httpRequest)
    expect(httpResponse?.statusCode).toBe(400)
    expect(httpResponse?.body).toEqual(new MissingParamError('password'))
  })

  test('should return 400 if no passwordConfirmation is provided', async () => {
    // sut = system under test
    const { sut } = makeSut()
    const httpRequest: HttpRequest = {
      body: {
        name: 'any_name',
        email: 'any_email@mail.com',
        password: 'any_password'
        // passwordConfirmation: 'any_password'
      }
    }
    const httpResponse: HttpResponse = await sut.handle(httpRequest)
    expect(httpResponse?.statusCode).toBe(400)
    expect(httpResponse?.body).toEqual(new MissingParamError('passwordConfirmation'))
  })
  // Email Validator
  test('should return 400 if invalid email is provided', async () => {
    // sut = system under test
    const { sut, emailValidatorStub } = makeSut()
    jest.spyOn(emailValidatorStub, 'isValid').mockReturnValueOnce(false)
    const httpRequest: HttpRequest = {
      body: {
        name: 'any_name',
        email: 'invalid_email@mail.com',
        password: 'any_password',
        passwordConfirmation: 'any_password'
      }
    }
    const httpResponse: HttpResponse = await sut.handle(httpRequest)
    expect(httpResponse?.statusCode).toBe(400)
    expect(httpResponse?.body).toEqual(new InvalidParamError('email'))
  })

  test('should return 400 if password confirmation fails', async () => {
    // sut = system under test
    const { sut } = makeSut()
    const httpRequest: HttpRequest = {
      body: {
        name: 'any_name',
        email: 'invalid_email@mail.com',
        password: 'any_password',
        passwordConfirmation: 'invalid_password'
      }
    }
    const httpResponse: HttpResponse = await sut.handle(httpRequest)
    expect(httpResponse?.statusCode).toBe(400)
    expect(httpResponse?.body).toEqual(new InvalidParamError('passwordConfirmation'))
  })

  describe('Email Validator', () => {
    test('should call email validator with correct email', async () => {
      // sut = system under test
      const { sut, emailValidatorStub } = makeSut()
      jest.spyOn(emailValidatorStub, 'isValid')
      const httpRequest: HttpRequest = {
        body: {
          name: 'any_name',
          email: 'invalid_email@mail.com',
          password: 'any_password',
          passwordConfirmation: 'any_password'
        }
      }
      await sut.handle(httpRequest)
      expect(emailValidatorStub.isValid).toHaveBeenCalledWith(httpRequest.body.email)
    })

    // test('should return 500 if emailValidatorStub throws', () => {
    //   const emailValidatorWithError: EmailValidator = makeEmailValidatorWithError()
    //   const sut = new SignUpController(emailValidatorWithError)
    //   const httpRequest: httpRequest = {
    //     body: {
    //       name: 'any_name',
    //       email: 'iany_email@mail.com',
    //       password: 'any_password',
    //       passwordConfirmation: 'any_password'
    //     }
    //   }
    //   const httpResponse: httpResponse = await sut.handle(httpRequest)
    //   expect(httpResponse?.statusCode).toBe(500)
    //   expect(httpResponse?.body).toEqual(new ServerError())
    // })

    test('should return 500 if emailValidatorStub throws', async () => {
      // sut = system under test
      const { sut, emailValidatorStub } = makeSut()
      jest.spyOn(emailValidatorStub, 'isValid').mockImplementation(() => { throw new Error() })
      const httpRequest: HttpRequest = {
        body: {
          name: 'any_name',
          email: 'any_email@mail.com',
          password: 'any_password',
          passwordConfirmation: 'any_password'
        }
      }
      const httpResponse: HttpResponse = await sut.handle(httpRequest)
      expect(httpResponse?.statusCode).toBe(500)
      expect(httpResponse?.body).toEqual(new ServerError())
    })
  })

  describe('AddAccount', () => {
    test('should call AddAccount with correct values', async () => {
      // sut = system under test
      const { sut, addAccountStub } = makeSut()
      const addSpy = jest.spyOn(addAccountStub, 'add')
      const httpRequest: HttpRequest = {
        body: {
          name: 'any_name',
          email: 'any_email@mail.com',
          password: 'any_password',
          passwordConfirmation: 'any_password'
        }
      }
      await sut.handle(httpRequest)
      expect(addSpy).toHaveBeenCalledWith({
        name: 'any_name',
        email: 'any_email@mail.com',
        password: 'any_password'
      })
    })

    test('should return 500 if AddAccount throws', async () => {
      // sut = system under test
      const { sut, addAccountStub } = makeSut()
      jest.spyOn(addAccountStub, 'add').mockImplementation(async () => {
        return await new Promise((resolve, reject) => { reject(new Error()) })
      })
      const httpRequest: HttpRequest = {
        body: {
          name: 'any_name',
          email: 'any_email@mail.com',
          password: 'any_password',
          passwordConfirmation: 'any_password'
        }
      }
      const httpResponse: HttpResponse = await sut.handle(httpRequest)
      expect(httpResponse?.statusCode).toBe(500)
      expect(httpResponse?.body).toEqual(new ServerError())
    })
  })

  test('should return 200 if valid date is provided', async () => {
    // sut = system under test
    const { sut } = makeSut()
    const httpRequest: HttpRequest = {
      body: {
        name: 'valid_name',
        email: 'valid_email@mail.com',
        password: 'valid_password',
        passwordConfirmation: 'valid_password'
      }
    }
    const httpResponse: HttpResponse = await sut.handle(httpRequest)
    expect(httpResponse?.statusCode).toBe(200)
    expect(httpResponse?.body).toEqual({
      id: 'valid_id',
      name: 'valid_name',
      email: 'valid_email@mail.com',
      password: 'valid_password'
    })
  })
})
