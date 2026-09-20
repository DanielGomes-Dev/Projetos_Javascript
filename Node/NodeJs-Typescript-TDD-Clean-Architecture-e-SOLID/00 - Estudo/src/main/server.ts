import env from './config/env'

import { MongoHelper } from '../infra/db/mongodb/helper/mongo-helper'

const port = env.port

MongoHelper.connect(env.mongoUrl).then(async () => {
  console.log('ok0')
  const setupApp = await import('./config/app')
  const app = setupApp.default

  app.listen(port, () => {
    console.log(`Server Running at http://localhost:${port}`)
  })
  console.log('ok5')
}).catch(error => {
  console.log('erro')
  console.log(error)
})
