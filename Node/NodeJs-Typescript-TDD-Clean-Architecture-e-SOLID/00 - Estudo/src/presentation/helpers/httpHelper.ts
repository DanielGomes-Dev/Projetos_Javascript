import { ServerError } from '../errors'
import { httpResponse } from '../protocols/http'
export const ok = (data: any): httpResponse => ({ body: data, statusCode: 200 })

export const badRequest = (error: Error): httpResponse => ({ body: error, statusCode: 400 })

export const serverError = (): httpResponse => ({ body: new ServerError(), statusCode: 500 })
