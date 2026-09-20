import { Collection, MongoClient, MongoClientOptions } from 'mongodb'

// const connectOptions: MongoClientOptions = {
//   useNewUrlParser: true,
//   useUnifiedTopology: true
// }

// eslint-disable-next-line @typescript-eslint/consistent-type-assertions
const options = { useNewUrlParser: true, useUnifiedTopology: true } as MongoClientOptions

export const MongoHelper = {
  client: null as unknown as MongoClient,
  async connect (uri: string): Promise<void> {
    this.client = await MongoClient.connect(uri, options)
  },
  async disconnect (): Promise<void> {
    await this.client.close()
  },
  getCollection (name: string): Collection {
    return this.client.db().collection(name)
  },
  map: (collection: any): any => {
    const { _id, ...collectionWithoutId } = collection
    return Object.assign({}, collectionWithoutId, { id: _id })
  }

}
