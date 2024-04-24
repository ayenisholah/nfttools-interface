import { retrieveCancelOfferFormat, signData, submitCancelOfferData } from "../offers";

export async function cancelBid(offer: IOffer, privateKey: string, collectionSymbol: string, tokenId: string, buyerPaymentAddress: string, apiKey: string) {
  try {
    const offerFormat = await retrieveCancelOfferFormat(offer.id, apiKey)
    if (offerFormat) {
      const signedOfferFormat = signData(offerFormat, privateKey)
      if (signedOfferFormat) {
        await submitCancelOfferData(offer.id, signedOfferFormat, apiKey)
        console.log('--------------------------------------------------------------------------------');
        console.log(`CANCELLED OFFER FOR ${collectionSymbol} ${tokenId}`);
        console.log('--------------------------------------------------------------------------------');
      }
    }
  } catch (error) {
    console.log(error);
  }
}

export interface IOffer {
  id: string;
  tokenId: string;
  sellerReceiveAddress: string;
  sellerOrdinalsAddress: string;
  price: number;
  buyerReceiveAddress: string;
  buyerPaymentAddress: string;
  expirationDate: number;
  isValid: boolean;
  token: Token;
}

interface Token {
  id: string;
  contentURI: string;
  contentType: string;
  contentBody: string;
  contentPreviewURI: string;
  genesisTransaction: string;
  genesisTransactionBlockTime: string;
  genesisTransactionBlockHash: string;
  genesisTransactionBlockHeight: number;
  inscriptionNumber: number;
  chain: string;
  meta: {
    name: string;
    attributes: string[];
  };
  location: string;
  locationBlockHeight: number;
  locationBlockTime: string;
  locationBlockHash: string;
  output: string;
  outputValue: number;
  owner: string;
  listed: boolean;
  listedAt: string;
  listedPrice: number;
  listedMakerFeeBp: number;
  listedSellerReceiveAddress: string;
  listedForMint: boolean;
  collectionSymbol: string;
  itemType: string;
  sat: number;
  satName: string;
  satRarity: string;
  satBlockHeight: number;
  satBlockTime: string;
  satributes: string[];
}