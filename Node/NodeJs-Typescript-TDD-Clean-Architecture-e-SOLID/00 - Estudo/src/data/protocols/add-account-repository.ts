import { AccountModel, AddAccountModel } from '../usescase/add-account/db-add-account-protocols'

export interface AddAccountRepository {
  add: (accountData: AddAccountModel) => Promise<AccountModel>

}
