import { NextApiRequest, NextApiResponse } from "next";
import * as bitcoin from "bitcoinjs-lib"
import { ICollectionOffer, IOffer, cancelCollectionOffer, getBestCollectionOffer, getUserOffers, retrieveCancelOfferFormat, signData, submitCancelOfferData } from "@/services/offers";
import { bidHistory } from "../bid";

import tinysecp from '@bitcoinerlab/secp256k1'
import { ECPairFactory, ECPairAPI } from 'ecpair';


const ECPair: ECPairAPI = ECPairFactory(tinysecp);
const network = bitcoin.networks.bitcoin;



export default async function handler(req: NextApiRequest, res: NextApiResponse) {

  try {
    if (req.method === 'GET') {
      const { requestType } = req.query

      if (requestType === "getCollectionOffers") {
        const { tokenReceiveAddress, collectionSymbol, apiKey, offerType } = req.query as unknown as FetchOffersQuery

        if (offerType === "ITEM") {
          const offerData = await getUserOffers(tokenReceiveAddress, apiKey)
          const offers = offerData?.offers.filter((item) => item.token.collectionSymbol === collectionSymbol)

          res.status(200).json(offers)

        } else if (offerType === "COLLECTION") {
          const offerData = await getBestCollectionOffer(collectionSymbol, apiKey)
          const offers = offerData?.offers.filter((item) => item.btcParams.makerOrdinalReceiveAddress.toLowerCase() === tokenReceiveAddress.toLowerCase())
          res.status(200).json(offers)
        }
      }
    } else if (req.method === "POST") {

      if (req.body.requestType === 'cancelAll') {
        const { offers, fundingWalletWIF, apiKey, collection, offerType, tokenReceiveAddress } = req.body.data as ICancelBulkOffers

        const privateKey = fundingWalletWIF

        const keyPair = ECPair.fromWIF(privateKey, network);
        const publicKey = keyPair.publicKey.toString('hex');

        if (offerType === "ITEM") {

          const cancelOps = []

          console.log({ offers, fundingWalletWIF, apiKey });

          for (const offer of offers) {
            const cancelOperation = cancelBid(offer, fundingWalletWIF, apiKey)
            cancelOps.push(cancelOperation)

            delete bidHistory[collection]
          }
          Promise.all(cancelOps)
          res.status(201).json({ success: true })
        } else if (offerType === "COLLECTION") {
          const bestOffers = await getBestCollectionOffer(collection, apiKey)
          const ourOffers = bestOffers?.offers.find((item) => item.btcParams.makerOrdinalReceiveAddress.toLowerCase() === tokenReceiveAddress.toLowerCase()) as ICollectionOffer

          if (ourOffers) {
            const offerIds = [ourOffers.id]
            await cancelCollectionOffer(offerIds, publicKey, privateKey, apiKey)
          }
        }
      } else if (req.body.requestType === 'cancel') {
        const { offer, fundingWalletWIF, apiKey, tokenReceiveAddress, offerType, collection } = req.body.data as ICancelOffer
        const privateKey = fundingWalletWIF

        const keyPair = ECPair.fromWIF(privateKey, network);
        const publicKey = keyPair.publicKey.toString('hex');

        if (offerType === "ITEM") {
          await cancelBid(offer.id, fundingWalletWIF, apiKey)
          delete bidHistory[offer.token.collectionSymbol]?.topBids[offer.tokenId]
          delete bidHistory[offer.token.collectionSymbol]?.ourBids[offer.tokenId]
          res.status(201).json({ success: true })
        } else if (offerType === "COLLECTION") {
          const bestOffers = await getBestCollectionOffer(collection, apiKey)
          const ourOffers = bestOffers?.offers.find((item) => item.btcParams.makerOrdinalReceiveAddress.toLowerCase() === tokenReceiveAddress.toLowerCase()) as ICollectionOffer

          if (ourOffers) {
            const offerIds = [ourOffers.id]
            await cancelCollectionOffer(offerIds, publicKey, privateKey, apiKey)
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
}

interface ICancelOffer {
  offerType: "ITEM" | "COLLECTION";
  tokenReceiveAddress: string;
  offer: IOffer;
  fundingWalletWIF: string;
  apiKey: string;
  collection: string;
}
interface FetchOffersQuery {
  offerType: "ITEM" | "COLLECTION";
  requestType: string;
  tokenReceiveAddress: string;
  collectionSymbol: string;
  apiKey: string;
}

export async function cancelBid(offerId: string, privateKey: string, apiKey: string) {
  try {
    const offerFormat = await retrieveCancelOfferFormat(offerId, apiKey)
    if (offerFormat) {
      const signedOfferFormat = signData(offerFormat, privateKey)
      if (signedOfferFormat) {
        await submitCancelOfferData(offerId, signedOfferFormat, apiKey)
      }
    }
  } catch (error) {
    console.log(error);
  }
}