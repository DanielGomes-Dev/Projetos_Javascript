export interface SavePurchases {
  save: (purchases: SavePurchases.Params[]) => Promise<void>;
}

namespace SavePurchases {
  export type Params = {
    id: string;
    date: Date;
    value: number;
  };
}

// type PurchaseModel = {
//     id: string
//     date: date
//     value: number
// }
