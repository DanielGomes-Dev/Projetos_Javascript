import express from 'express'
import setupMiddlewares from './middlewares'
import routes from './routes'

const app = express()
console.log('ok')
setupMiddlewares(app)
console.log('ok2')
routes(app)
console.log('ok3')

export default app
