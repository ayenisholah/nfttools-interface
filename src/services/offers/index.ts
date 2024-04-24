import * as bitcoin from "bitcoinjs-lib"
import { ECPairInterface, ECPairFactory, ECPairAPI } from 'ecpair';
import tinysecp from '@bitcoinerlab/secp256k1'
import axios from "axios";

const ECPair: ECPairAPI = ECPairFactory(tinysecp);
const network = bitcoin.networks.bitcoin;



export async function createOffer(
  tokenId: string,
  price: number,
  expiration: number,
  buyerTokenReceiveAddress: string,
  buyerPaymentAddress: string,
  publicKey: string,
  feerateTier: string,
  apiKey: string
) {

  const headers = {
    'Content-Type': 'application/json',
    'X-NFT-API-Key': apiKey,
  }
  const baseURL = 'https://nfttools.pro/magiceden/v2/ord/btc/offers/create';
  const params = {
    tokenId: tokenId,
    price: price,
    expirationDate: expiration,
    buyerTokenReceiveAddress: buyerTokenReceiveAddress,
    buyerPaymentAddress: buyerPaymentAddress,
    buyerPaymentPublicKey: publicKey,
    feerateTier: feerateTier
  };

  try {
    const { data } = await axios.get(baseURL, { params, headers })
    return data
  } catch (error: any) {
    console.log("createOfferError: ", error.response.data);
  }
}

export function signData(unsignedData: any, privateKey: string) {
  if (typeof unsignedData !== "undefined") {
    const psbt = bitcoin.Psbt.fromBase64(unsignedData.psbtBase64);
    const keyPair: ECPairInterface = ECPair.fromWIF(privateKey, network)

    for (let index of unsignedData.toSignInputs) {
      psbt.signInput(index, keyPair);
      psbt.finalizeInput(index);
    }
    psbt.signAllInputs(keyPair)

    const signedBuyingPSBTBase64 = psbt.toBase64();
    return signedBuyingPSBTBase64;
  }
}


export async function submitSignedOfferOrder(
  signedPSBTBase64: string,
  tokenId: string,
  price: number,
  expiration: number,
  buyerPaymentAddress: string,
  buyerReceiveAddress: string,
  publicKey: string,
  feerateTier: string,
  apiKey: string
) {
  const url = 'https://nfttools.pro/magiceden/v2/ord/btc/offers/create'

  const headers = {
    'Content-Type': 'application/json',
    'X-NFT-API-Key': apiKey,
  }

  const data = {
    signedPSBTBase64: signedPSBTBase64,
    feerateTier: feerateTier,
    tokenId: tokenId,
    price: price,
    expirationDate: expiration.toString(),
    buyerPaymentAddress: buyerPaymentAddress,
    buyerPaymentPublicKey: publicKey,
    buyerReceiveAddress: buyerReceiveAddress
  };

  try {
    const response = await axios.post(url, data, { headers })
    return response.data;
  } catch (error: any) {
    console.log(error.response.data);

  }
}

export async function getBestOffer(tokenId: string, apiKey: string) {
  const url = 'https://nfttools.pro/magiceden/v2/ord/btc/offers/';
  const params = {
    status: 'valid',
    limit: 2,
    offset: 0,
    sortBy: 'priceDesc',
    token_id: tokenId
  };

  const headers = {
    'Content-Type': 'application/json',
    'X-NFT-API-Key': apiKey,
  }

  try {

    const { data } = await axios.get<OfferData>(url, { params, headers })
    return data
  } catch (error: any) {
    console.log('getBestOffer: ', error.response);
  }
}


export async function cancelAllUserOffers(buyerTokenReceiveAddress: string, privateKey: string, apiKey: string) {
  try {
    console.log('--------------------------------------------------------------------------------');
    console.log('CANCEL ALL OFFERS!!!');
    console.log('--------------------------------------------------------------------------------');

    const offerData = await getUserOffers(buyerTokenReceiveAddress, apiKey)

    if (offerData && offerData.offers && offerData.offers.length > 0) {
      const offers = offerData.offers
      console.log('--------------------------------------------------------------------------------');
      console.log('NUMBER OF CURRENT ACTIVE OFFERS: ', offers.length);
      console.log('--------------------------------------------------------------------------------');

      for (const offer of offers) {
        const offerFormat = await retrieveCancelOfferFormat(offer.id, apiKey)
        const signedOfferFormat = signData(offerFormat, privateKey)
        if (signedOfferFormat) {
          await submitCancelOfferData(offer.id, signedOfferFormat, apiKey)

          console.log('--------------------------------------------------------------------------------');
          console.log(`CANCELLED OFFER FOR ${offer.token.collectionSymbol} ${offer.token.id}`);
          console.log('--------------------------------------------------------------------------------');

        }
      }
    }
  } catch (error) {
    console.log("cancelAllUserOffers: ", error);
  }
}

export async function cancelBulkTokenOffers(tokenIds: string[], buyerTokenReceiveAddress: string, privateKey: string, apiKey: string) {
  try {
    for (const token of tokenIds) {
      const offerData = await getOffers(token, apiKey, buyerTokenReceiveAddress)
      const offer = offerData?.offers[0]
      if (offer) {
        const offerFormat = await retrieveCancelOfferFormat(offer.id, apiKey)
        const signedOfferFormat = signData(offerFormat, privateKey)

        if (signedOfferFormat) {
          await submitCancelOfferData(offer.id, signedOfferFormat, apiKey)
          console.log('--------------------------------------------------------------------------------');
          console.log(`CANCELLED OFFER FOR ${offer.token.collectionSymbol} ${offer.token.id}`);
          console.log('--------------------------------------------------------------------------------');
        }
      }
    }
  } catch (error) {
    console.log('cancelBulkTokenOffers: ', error);

  }

}

export async function getOffers(tokenId: string,
  apiKey: string,
  buyerTokenReceiveAddress?: string) {
  const url = 'https://nfttools.pro/magiceden/v2/ord/btc/offers/';

  let params: any = {
    status: 'valid',
    limit: 100,
    offset: 0,
    sortBy: 'priceDesc',
    token_id: tokenId
  };

  if (buyerTokenReceiveAddress) {
    params = {
      status: 'valid',
      limit: 1,
      offset: 0,
      sortBy: 'priceDesc',
      token_id: tokenId,
      wallet_address_buyer: buyerTokenReceiveAddress
    };
  }

  try {
    const headers = {
      'Content-Type': 'application/json',
      'X-NFT-API-Key': apiKey,
    }
    const { data } = await axios.get<OfferData>(url, { params, headers })
    return data
  } catch (error: any) {
    console.log("getOffers ", error.response.data);
  }
}


export async function retrieveCancelOfferFormat(offerId: string, apiKey: string) {
  const url = `https://nfttools.pro/magiceden/v2/ord/btc/offers/cancel?offerId=${offerId}`
  try {
    const headers = {
      'Content-Type': 'application/json',
      'X-NFT-API-Key': apiKey,
    }
    const { data } = await axios.get(url, { headers })

    return data
  } catch (error: any) {
    // console.log("retrieveCancelOfferFormat: ", error.response.data.error);
  }
}

export async function submitCancelOfferData(offerId: string, signedPSBTBase64: string, apiKey: string) {
  const headers = {
    'Content-Type': 'application/json',
    'X-NFT-API-Key': apiKey,
  }
  const url = 'https://nfttools.pro/magiceden/v2/ord/btc/offers/cancel';
  const data = {
    offerId: offerId,
    signedPSBTBase64: signedPSBTBase64
  };
  try {
    const response = await axios.post(url, data, { headers })
    return response.data.ok
  } catch (error: any) {
    console.log('submitCancelOfferData: ', error.response.data);
  }
}

export async function counterBid(
  offerId: string,
  tokenId: string,
  price: number,
  expiration: number,
  buyerTokenReceiveAddress: string,
  buyerPaymentAddress: string,
  publicKey: string,
  feerateTier: string,
  privateKey: string,
  apiKey: string
) {
  console.log('--------------------------------------------------------------------------------');
  console.log("COUNTER BID");
  console.log('--------------------------------------------------------------------------------');

  const cancelOfferFormat = await retrieveCancelOfferFormat(offerId, apiKey)

  console.log('--------------------------------------------------------------------------------');
  console.log({ cancelOfferFormat });
  console.log('--------------------------------------------------------------------------------');

  const signedCancelOffer = signData(cancelOfferFormat, privateKey)

  console.log('--------------------------------------------------------------------------------');
  console.log({ signedCancelOffer });
  console.log('--------------------------------------------------------------------------------');

  if (signedCancelOffer) {
    const submitCancelOffer = await submitCancelOfferData(offerId, signedCancelOffer, apiKey)

    console.log('--------------------------------------------------------------------------------');
    console.log({ submitCancelOffer });
    console.log('--------------------------------------------------------------------------------');

  }

  const unsignedOffer = await createOffer(tokenId, price, expiration, buyerTokenReceiveAddress, buyerPaymentAddress, publicKey, feerateTier, apiKey)

  console.log('--------------------------------------------------------------------------------');
  console.log({ unsignedOffer });
  console.log('--------------------------------------------------------------------------------');

  const signedOfferData = signData(unsignedOffer, privateKey)

  console.log('--------------------------------------------------------------------------------');
  console.log({ signedOfferData });
  console.log('--------------------------------------------------------------------------------');

  if (signedOfferData) {

    const offerData = await submitSignedOfferOrder(signedOfferData, tokenId, price, expiration, buyerPaymentAddress, buyerTokenReceiveAddress, publicKey, feerateTier, apiKey)

    console.log('--------------------------------------------------------------------------------');
    console.log({ offerData });
    console.log('--------------------------------------------------------------------------------');
  }

}

export async function getUserOffers(buyerPaymentAddress: string, apiKey: string) {
  try {
    const url = 'https://nfttools.pro/magiceden/v2/ord/btc/offers/';
    const params = {
      status: 'valid',
      limit: 100,
      offset: 0,
      sortBy: 'priceDesc',
      wallet_address_buyer: buyerPaymentAddress.toLowerCase()
    };

    const headers = {
      'Content-Type': 'application/json',
      'X-NFT-API-Key': apiKey,
    }

    const { data } = await axios.get<UserOffer>(url, { params, headers })
    return data
  } catch (error) {
    console.log('getUserOffers: ', error);
  }
}

interface Offer {
  id: string;
  tokenId: string;
  sellerReceiveAddress: string;
  sellerOrdinalsAddress: string;
  price: number;
  buyerReceiveAddress: string;
  buyerPaymentAddress: string;
  expirationDate: number;
  isValid: boolean;
  token: any;
}

interface OfferData {
  total: string;
  offers: Offer[];
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

interface UserOffer {
  total: string,
  offers: IOffer[]
}