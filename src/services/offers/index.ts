import * as bitcoin from "bitcoinjs-lib"
import { ECPairInterface, ECPairFactory, ECPairAPI } from 'ecpair';
import tinysecp from '@bitcoinerlab/secp256k1'
import axios, { AxiosInstance } from "axios";
import { cancelBid } from "../bid/cancel";
import Bottleneck from "bottleneck";
import axiosInstance from "@/axios";

const ECPair: ECPairAPI = ECPairFactory(tinysecp);
const network = bitcoin.networks.bitcoin;



export function signCollectionOffer(unsignedData: ICollectionOfferResponseData, privateKey: string) {
  const offers = unsignedData.offers[0]
  const offerPsbt = bitcoin.Psbt.fromBase64(offers.psbtBase64);
  const cancelPsbt = bitcoin.Psbt.fromBase64(offers.cancelPsbtBase64);
  const keyPair: ECPairInterface = ECPair.fromWIF(privateKey, network)


  offerPsbt.signInput(0, keyPair);
  cancelPsbt.signInput(0, keyPair);

  const signedOfferPSBTBase64 = offerPsbt.toBase64();
  const signedCancelledPSBTBase64 = cancelPsbt.toBase64();

  return { signedOfferPSBTBase64, signedCancelledPSBTBase64 };
}

export async function createCollectionOffer(
  collectionSymbol: string,
  priceSats: number,
  expirationAt: string,
  feeSatsPerVbyte: number,
  makerPublicKey: string,
  makerReceiveAddress: string,
  apiKey: string,
  limiter: Bottleneck,
  axiosInstance: AxiosInstance,
) {
  const params = {
    collectionSymbol,
    quantity: 1,
    priceSats,
    expirationAt,
    feeSatsPerVbyte,
    makerPublicKey,
    makerPaymentType: 'p2wpkh',
    makerReceiveAddress
  };

  try {
    const headers = {
      'Content-Type': 'application/json',
      'X-NFT-API-Key': apiKey,
    }
    const url = 'https://nfttools.pro/magiceden/v2/ord/btc/collection-offers/psbt/create'
    const { data } = await limiter.schedule(() => axiosInstance.get<ICollectionOfferResponseData>(url, { params, headers }))
    return data
  } catch (error: any) {
    console.log(error.response.data);
  }
}

export async function submitCollectionOffer(
  signedPsbtBase64: string,
  signedCancelPsbtBase64: string,
  collectionSymbol: string,
  priceSats: number,
  expirationAt: string,
  makerPublicKey: string,
  makerReceiveAddress: string,
  apiKey: string,
  limiter: Bottleneck,
  axiosInstance: AxiosInstance
) {

  const requestData = {
    collectionSymbol,
    quantity: 1,
    priceSats,
    expirationAt,
    makerPublicKey,
    makerPaymentType: 'p2wpkh',
    makerReceiveAddress,
    offers: [
      {
        signedPsbtBase64,
        signedCancelPsbtBase64
      }
    ]
  };

  const url = 'https://nfttools.pro/magiceden/v2/ord/btc/collection-offers/psbt/create'

  const headers = {
    'Content-Type': 'application/json',
    'X-NFT-API-Key': apiKey,
  }
  try {
    const { data } = await limiter.schedule(() => axiosInstance.post<ISubmitCollectionOfferResponse>(url, requestData, { headers }))
    return data

  } catch (error) {
    console.log(error);
  }
}

export async function getBestCollectionOffer(collectionSymbol: string, apiKey: string, limiter: Bottleneck, axiosInstance: AxiosInstance) {
  const headers = {
    'Content-Type': 'application/json',
    'X-NFT-API-Key': apiKey,
  }

  const url = `https://nfttools.pro/magiceden/v2/ord/btc/collection-offers/collection/${collectionSymbol}`;
  const params = {
    sort: 'priceDesc',
    status: ['valid'],
    limit: 2,
    offset: 0
  };

  try {
    const { data } = await limiter.schedule(() => axiosInstance.get<CollectionOfferData>(url, { params, headers }))
    return data
  } catch (error: any) {
  }
}

export async function cancelCollectionOfferRequest(offerIds: string[], makerPublicKey: string, apiKey: string, limiter: Bottleneck, axiosInstance: AxiosInstance) {

  const headers = {
    'Content-Type': 'application/json',
    'X-NFT-API-Key': apiKey,
  }
  const url = 'https://nfttools.pro/magiceden/v2/ord/btc/collection-offers/psbt/cancel';
  const params = {
    offerIds,
    makerPublicKey,
    makerPaymentType: 'p2wpkh'
  };
  try {
    const { data } = await limiter.schedule(() => axiosInstance.get<ICancelCollectionOfferRequest>(url, { params, headers }))

    return data

  } catch (error: any) {
    console.log(error.response.data);
  }
}

export async function cancelCollectionOffer(
  offerIds: string[],
  makerPublicKey: string,
  privateKey: string,
  apiKey: string,
  limiter: Bottleneck,
  axiosInstance: AxiosInstance
) {
  try {
    const unsignedData = await cancelCollectionOfferRequest(offerIds, makerPublicKey, apiKey, limiter, axiosInstance)

    if (unsignedData) {
      const signedData = signCancelCollectionOfferRequest(unsignedData, privateKey)
      await submitCancelCollectionOffer(offerIds, makerPublicKey, signedData, apiKey, limiter, axiosInstance)
    }
  } catch (error) {
    console.log(error);
  }
}

export function signCancelCollectionOfferRequest(unsignedData: ICancelCollectionOfferRequest, privateKey: string) {
  const psbtBase64 = unsignedData.psbtBase64
  const offerPsbt = bitcoin.Psbt.fromBase64(psbtBase64);
  const keyPair: ECPairInterface = ECPair.fromWIF(privateKey, network)

  offerPsbt.signInput(0, keyPair);
  const signedPsbtBase64 = offerPsbt.toBase64();

  return signedPsbtBase64
}

export async function submitCancelCollectionOffer(
  offerIds: string[],
  makerPublicKey: string,
  signedPsbtBase64: string,
  apiKey: string,
  limiter: Bottleneck,
  axiosInstance: AxiosInstance
) {
  try {

    const headers = {
      'Content-Type': 'application/json',
      'X-NFT-API-Key': apiKey,
    }

    const url = 'https://nfttools.pro/magiceden/v2/ord/btc/collection-offers/psbt/cancel';
    const data = {
      makerPublicKey,
      offerIds,
      signedPsbtBase64,
      makerPaymentType: 'p2wpkh'
    };

    const response = await limiter.schedule(() => axiosInstance.post<ICancelOfferResponse>(url, data, { headers }))


    return response

  } catch (error: any) {
    console.log(error.response.data);
  }
}


export async function createOffer(
  tokenId: string,
  price: number,
  expiration: number,
  buyerTokenReceiveAddress: string,
  buyerPaymentAddress: string,
  publicKey: string,
  feerateTier: string,
  apiKey: string,
  limiter: Bottleneck,
  axiosInstance: AxiosInstance
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
    const { data } = await limiter.schedule(() => axiosInstance.get(baseURL, { params, headers }))
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
  privateKey: string,
  apiKey: string,
  limiter: Bottleneck,
  axiosInstance: AxiosInstance
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

  let errorOccurred = false;
  do {
    try {
      const response = await limiter.schedule(() => axiosInstance.post(url, data, { headers }))
      return response.data;
    } catch (error: any) {
      if (error.response?.data?.error === "You already have an offer for this token") {
        await new Promise(resolve => setTimeout(resolve, 2500)); // Wait before retrying
        const offerData = await getOffers(tokenId, apiKey, limiter, axiosInstance, buyerReceiveAddress);
        if (offerData && offerData.offers.length > 0) {
          for (const item of offerData.offers) {
            await cancelBid(
              item,
              privateKey,
              item.token.collectionSymbol,
              item.tokenId,
              buyerPaymentAddress,
              apiKey,
              limiter,
              axiosInstance
            );
          }
        }
        errorOccurred = true;  // Signal to retry
      } else {
        errorOccurred = false;
        // throw error;  // Rethrow other types of errors that are not handled specifically
      }
    }
  } while (errorOccurred);
}

export async function getBestOffer(tokenId: string, apiKey: string, limiter: Bottleneck, axiosInstance: AxiosInstance) {
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
    const { data } = await limiter.schedule(() => axiosInstance.get<OfferData>(url, { params, headers }))
    return data
  } catch (error: any) {
  }
}


export async function cancelAllUserOffers(buyerTokenReceiveAddress: string, privateKey: string, apiKey: string, limiter: Bottleneck, axiosInstance: AxiosInstance) {
  try {
    console.log('--------------------------------------------------------------------------------');
    console.log('CANCEL ALL OFFERS!!!');
    console.log('--------------------------------------------------------------------------------');

    const offerData = await getUserOffers(buyerTokenReceiveAddress, apiKey, limiter, axiosInstance)

    if (offerData && offerData.offers && offerData.offers.length > 0) {
      const offers = offerData.offers
      console.log('--------------------------------------------------------------------------------');
      console.log('NUMBER OF CURRENT ACTIVE OFFERS: ', offers.length);
      console.log('--------------------------------------------------------------------------------');

      for (const offer of offers) {
        const offerFormat = await retrieveCancelOfferFormat(offer.id, apiKey, limiter, axiosInstance)
        const signedOfferFormat = signData(offerFormat, privateKey)
        if (signedOfferFormat) {
          await submitCancelOfferData(offer.id, signedOfferFormat, apiKey, limiter, axiosInstance)

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

export async function cancelBulkTokenOffers(tokenIds: string[], buyerTokenReceiveAddress: string, privateKey: string, apiKey: string, limiter: Bottleneck, axiosInstance: AxiosInstance) {
  try {
    for (const token of tokenIds) {
      const offerData = await getOffers(token, apiKey, limiter, axiosInstance, buyerTokenReceiveAddress)
      const offer = offerData?.offers[0]
      if (offer) {
        const offerFormat = await retrieveCancelOfferFormat(offer.id, apiKey, limiter, axiosInstance)
        const signedOfferFormat = signData(offerFormat, privateKey)

        if (signedOfferFormat) {
          await submitCancelOfferData(offer.id, signedOfferFormat, apiKey, limiter, axiosInstance)
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
  limiter: Bottleneck,
  axiosInstance: AxiosInstance,
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
    const { data } = await limiter.schedule(() => axiosInstance.get<OfferData>(url, { params, headers }))
    return data
  } catch (error: any) {
  }
}


export async function retrieveCancelOfferFormat(offerId: string, apiKey: string, limiter: Bottleneck, axiosInstance: AxiosInstance) {
  const url = `https://nfttools.pro/magiceden/v2/ord/btc/offers/cancel?offerId=${offerId}`
  try {
    const headers = {
      'Content-Type': 'application/json',
      'X-NFT-API-Key': apiKey,
    }
    const { data } = await limiter.schedule(() => axiosInstance.get(url, { headers }))

    return data
  } catch (error: any) {
    // console.log("retrieveCancelOfferFormat: ", error.response.data.error);
  }
}

export async function submitCancelOfferData(offerId: string, signedPSBTBase64: string, apiKey: string, limiter: Bottleneck, axiosInstance: AxiosInstance) {
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
    const response = await limiter.schedule(() => axiosInstance.post(url, data, { headers }))
    return response.data.ok
  } catch (error: any) {
    console.log('submitCancelOfferData: ', error.response.data);
  }
}
export async function getUserOffers(buyerPaymentAddress: string, apiKey: string, limiter: Bottleneck, axiosInstance: AxiosInstance) {
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

    const { data } = await limiter.schedule(() => axiosInstance.get<UserOffer>(url, { params, headers }))
    return data
  } catch (error) {
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

export interface CollectionOfferData {
  total: string;
  offers: ICollectionOffer[];
}

export interface ICollectionOffer {
  chain: string;
  id: string;
  collectionSymbol: string;
  status: string;
  quantity: number;
  price: {
    amount: number;
    currency: string;
    decimals: number;
  };
  maker: string;
  expiresAt: string;
  createdAt: string;
  updatedAt: string;
  fees: any[]; // Adjust this type based on the actual structure of the 'fees' property
  btcParams: {
    makerOrdinalReceiveAddress: string;
    makerPaymentAddress: string;
    pendingDeposits: any[]; // Adjust this type based on the actual structure of the 'pendingDeposits' property
  };
}

interface ICancelCollectionOfferRequest {
  offerIds: string[];
  psbtBase64: string;
}

interface ICancelOfferResponse {
  offerIds: string[];
  ok: boolean;
}

export interface ICollectionOfferResponseData {
  offers: ICollectionOfferData[];
}

export interface ICollectionOfferData {
  psbtBase64: string;
  transactionFeeSats: number;
  cancelPsbtBase64: string;
  cancelTransactionFeeSats: number;
}

interface ISubmitCollectionOfferResponse {
  offerIds: string[];
}
