import request from 'supertest'
import app from '../config/app'
import { MongoHelper } from '../../infra/db/mongodb/helper/mongo-helper'

describe('SignUp Routes', () => {
  beforeAll(async () => {
    await MongoHelper.connect(process.env.MONGO_URL as any)
  })

  afterAll(async () => {
    await MongoHelper.disconnect()
  })

  beforeEach(async () => {
    const accountCollection = MongoHelper.getCollection('accounts')
    await accountCollection.deleteMany({})
  })

  test('should return an account on success', async () => {
    // await request(app).post('/api/signup')
    //   .send({
    //     name: 'DanielTest',
    //     email: 'DanielTest@Mail.com',
    //     password: '1234',
    //     passwordConfirmation: '1234'
    //   })
    // .expect(200)
  })
})
