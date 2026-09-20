import bcrypt from 'bcrypt'
import { BcryptAdapter } from './bcrypt-adapter'
jest.mock('bcrypt', () => ({
  async hash (): Promise<string> {
    return await new Promise(resolve => { resolve('any_value') })
  }
}))

const salt = 12
const makeSut = (): BcryptAdapter => {
  const sut = new BcryptAdapter(salt)
  return sut
}
describe('bcrypt adapter', () => {
  test('should call bcrypt with correct value', async () => {
    const sut = makeSut()

    const hashSpy = jest.spyOn(bcrypt, 'hash')
    await sut.encrypt('any_value')
    expect(hashSpy).toHaveBeenCalledWith('any_value', salt)
  })

  test('should return a hash on success', async () => {
    const sut = makeSut()

    const hash = await sut.encrypt('any_value')
    expect(hash).toBe('any_value')
  })

  // test('should throw if bcrypt throw', async () => {
  //   const sut = makeSut()
  //   jest.spyOn(bcrypt, 'hash').mockReturnValueOnce(new Promise((resolve, reject) => { reject(new Error()) }) as any)

  //   const promise = await sut.encrypt('any_value')
  //   await expect(promise).rejects.toThrow()
  // })
})
