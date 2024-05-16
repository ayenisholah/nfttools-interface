import { NextApiRequest, NextApiResponse } from "next";
import * as bitcoin from "bitcoinjs-lib"
import { ICollectionOffer, IOffer, cancelCollectionOffer, getBestCollectionOffer, getUserOffers, retrieveCancelOfferFormat, signData, submitCancelOfferData } from "@/services/offers";
import { axiosInstance, bidHistory } from "../bid";

import tinysecp from '@bitcoinerlab/secp256k1'
import { ECPairFactory, ECPairAPI } from 'ecpair';
import Bottleneck from "bottleneck";
import { AxiosInstance } from "axios";


const ECPair: ECPairAPI = ECPairFactory(tinysecp);
const network = bitcoin.networks.bitcoin;



export default async function handler(req: NextApiRequest, res: NextApiResponse) {

  try {
    if (req.method === 'GET') {
      const { requestType } = req.query

      if (requestType === "getCollectionOffers") {
        const { tokenReceiveAddress, collectionSymbol, apiKey, offerType, rateLimit } = req.query as unknown as FetchOffersQuery

        const limiter = new Bottleneck({
          minTime: 1 / (+rateLimit * 0.9),
        });



        if (offerType === "ITEM") {
          const offerData = await getUserOffers(tokenReceiveAddress, apiKey, limiter, axiosInstance)
          const offers = offerData?.offers.filter((item) => item.token.collectionSymbol === collectionSymbol)

          res.status(200).json(offers)

        } else if (offerType === "COLLECTION") {
          const offerData = await getBestCollectionOffer(collectionSymbol, apiKey, limiter, axiosInstance)
          const offers = offerData?.offers.filter((item) => item.btcParams.makerOrdinalReceiveAddress.toLowerCase() === tokenReceiveAddress.toLowerCase())
          res.status(200).json(offers)
        }
      }
    } else if (req.method === "POST") {

      if (req.body.requestType === 'cancelAll') {
        const { offers, fundingWalletWIF, apiKey, collection, offerType, tokenReceiveAddress, rateLimit } = req.body.data as ICancelBulkOffers

        const limiter = new Bottleneck({
          minTime: 1 / (+rateLimit * 0.9),
        });

        const privateKey = fundingWalletWIF

        const keyPair = ECPair.fromWIF(privateKey, network);
        const publicKey = keyPair.publicKey.toString('hex');

        if (offerType === "ITEM") {

          const cancelOps = []

          console.log({ offers, fundingWalletWIF, apiKey });

          for (const offer of offers) {
            const cancelOperation = cancelBid(offer, fundingWalletWIF, apiKey, limiter, axiosInstance)
            cancelOps.push(cancelOperation)

            delete bidHistory[collection]
          }
          Promise.all(cancelOps)
          res.status(201).json({ success: true })
        } else if (offerType === "COLLECTION") {
          const bestOffers = await getBestCollectionOffer(collection, apiKey, limiter, axiosInstance)
          const ourOffers = bestOffers?.offers.find((item) => item.btcParams.makerOrdinalReceiveAddress.toLowerCase() === tokenReceiveAddress.toLowerCase()) as ICollectionOffer

          if (ourOffers) {
            const offerIds = [ourOffers.id]
            await cancelCollectionOffer(offerIds, publicKey, privateKey, apiKey, limiter, axiosInstance)
          }
        }
      } else if (req.body.requestType === 'cancel') {
        const { offer, fundingWalletWIF, apiKey, tokenReceiveAddress, offerType, collection, rateLimit } = req.body.data as ICancelOffer
        const privateKey = fundingWalletWIF

        const limiter = new Bottleneck({
          minTime: 1 / (+rateLimit * 0.9),
        });

        const keyPair = ECPair.fromWIF(privateKey, network);
        const publicKey = keyPair.publicKey.toString('hex');

        if (offerType === "ITEM") {
          await cancelBid(offer.id, fundingWalletWIF, apiKey, limiter, axiosInstance)
          delete bidHistory[offer.token.collectionSymbol]?.topBids[offer.tokenId]
          delete bidHistory[offer.token.collectionSymbol]?.ourBids[offer.tokenId]
          res.status(201).json({ success: true })
        } else if (offerType === "COLLECTION") {
          const bestOffers = await getBestCollectionOffer(collection, apiKey, limiter, axiosInstance)
          const ourOffers = bestOffers?.offers.find((item) => item.btcParams.makerOrdinalReceiveAddress.toLowerCase() === tokenReceiveAddress.toLowerCase()) as ICollectionOffer

          if (ourOffers) {
            const offerIds = [ourOffers.id]
            await cancelCollectionOffer(offerIds, publicKey, privateKey, apiKey, limiter, axiosInstance)
          }
        }
      }
    }
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: "something went  wrong!!!" })
  }
}

interface ICancelBulkOffers {
  offerType: "ITEM" | "COLLECTION";
  offers: string[];
  fundingWalletWIF: string;
  apiKey: string;
  collection: string;
  tokenReceiveAddress: string;
  rateLimit: number;
}

interface ICancelOffer {
  offerType: "ITEM" | "COLLECTION";
  tokenReceiveAddress: string;
  offer: IOffer;
  fundingWalletWIF: string;
  apiKey: string;
  collection: string;
  rateLimit: number
}
interface FetchOffersQuery {
  offerType: "ITEM" | "COLLECTION";
  requestType: string;
  tokenReceiveAddress: string;
  collectionSymbol: string;
  apiKey: string;
  rateLimit: number
}

export async function cancelBid(offerId: string, privateKey: string, apiKey: string, limiter: Bottleneck, axiosInstance: AxiosInstance) {
  try {
    const offerFormat = await retrieveCancelOfferFormat(offerId, apiKey, limiter, axiosInstance)
    if (offerFormat) {
      const signedOfferFormat = signData(offerFormat, privateKey)
      if (signedOfferFormat) {
        await submitCancelOfferData(offerId, signedOfferFormat, apiKey, limiter, axiosInstance)
      }
    }
  } catch (error) {
    console.log(error);
  }
}