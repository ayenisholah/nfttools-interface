export interface Wallet {
  address: string;
  privateKey: string;
}


export interface IValidateWallet {
  address: string;
  privateKey: string;
  isBitcoin: boolean
}