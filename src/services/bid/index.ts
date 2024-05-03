import * as bitcoin from "bitcoinjs-lib"
import tinysecp from '@bitcoinerlab/secp256k1'
import { ECPairFactory, ECPairAPI } from 'ecpair';
import { getBitcoinBalance } from "../balance";
import { collectionDetails } from "../collections";
import { BidData, bidHistory } from "@/pages/api/bid";
import { createOffer, getBestOffer, getOffers, getUserOffers, signData, submitSignedOfferOrder } from "../offers";
import { retrieveTokens } from "../tokens";
import { cancelBid } from "./cancel";
import PQueue, { QueueAddOptions } from "p-queue";

const ECPair: ECPairAPI = ECPairFactory(tinysecp);
const network = bitcoin.networks.bitcoin;
let RESTART = true
const CONVERSION_RATE = 1e8
const FEE_RATE_TIER = 'halfHourFee'

export async function processScheduledLoop(item: BidData, queue: PQueue<any, QueueAddOptions>) {
  console.log('----------------------------------------------------------------------');
  console.log(`START AUTOBID SCHEDULE FOR ${item.collectionSymbol}`);
  console.log('----------------------------------------------------------------------');

  const collectionSymbol = item.collectionSymbol
  const minBid = item.minBid
  const maxBid = item.maxBid
  const bidCount = item.bidCount
  const duration = item.duration
  const outBidMargin = item.outBidMargin
  const buyerTokenReceiveAddress = item.tokenReceiveAddress
  const privateKey = item.fundingWalletWIF
  const keyPair = ECPair.fromWIF(privateKey, network);
  const apiKey = item.apiKey
  const publicKey = keyPair.publicKey.toString('hex');

  const buyerPaymentAddress = bitcoin.payments.p2wpkh({ pubkey: keyPair.publicKey, network: network }).address as string

  try {
    const balance = 50000

    console.log({ balance });

    const collectionData = await collectionDetails(collectionSymbol, item.apiKey)

    console.log({ collectionData });


    if (!bidHistory[collectionSymbol]) {
      bidHistory[collectionSymbol] = {
        offerType: "ITEM",
        topOffers: {},
        ourBids: {},
        topBids: {},
        bottomListings: [],
        lastSeenActivity: null
      };
    }

    if (RESTART) {
      const offerData = await getUserOffers(buyerTokenReceiveAddress, apiKey)
      if (offerData && offerData.offers.length > 0) {
        const offers = offerData.offers
        offers.forEach((item) => {
          if (!bidHistory[item.token.collectionSymbol]) {
            bidHistory[item.token.collectionSymbol] = {
              offerType: "ITEM",
              topOffers: {},
              ourBids: {},
              topBids: {},
              bottomListings: [],
              lastSeenActivity: null
            };
          }
          bidHistory[item.token.collectionSymbol].topBids[item.tokenId] = true
          bidHistory[item.token.collectionSymbol].ourBids[item.tokenId] = {
            price: item.price,
            expiration: item.expirationDate
          }
          bidHistory[collectionSymbol].lastSeenActivity = Date.now()
        })
      }
      RESTART = false
    }

    let tokens = await retrieveTokens(collectionSymbol, bidCount, apiKey)
    tokens = tokens.slice(0, bidCount)

    bidHistory[collectionSymbol].bottomListings = tokens.map(item => ({ id: item.id, price: item.listedPrice }))
      .sort((a, b) => a.price - b.price)

    const bottomListings = bidHistory[collectionSymbol].bottomListings

    console.log('--------------------------------------------------------------------------------');
    console.log(`BOTTOM LISTING FOR ${collectionSymbol}`);
    console.table(bottomListings)
    console.log('--------------------------------------------------------------------------------');

    console.log('--------------------------------------------------------------------------------');
    console.log(`BUYER PAYMENT ADDRESS: ${buyerPaymentAddress}`);
    console.log(`BUYER TOKEN RECEIVE ADDRESS: ${buyerTokenReceiveAddress}`);
    console.log('--------------------------------------------------------------------------------');

    const currentTime = new Date().getTime();
    const expiration = currentTime + (duration * 60 * 1000);
    const minPrice = Math.round(minBid * CONVERSION_RATE)
    const maxPrice = Math.round(maxBid * CONVERSION_RATE)
    const floorPrice = Number(collectionData?.floorPrice) ?? 0

    console.log('--------------------------------------------------------------------------------');
    console.log(`COLLECTION SYMBOL: ${collectionSymbol}`);
    console.log("MAX PRICE: ", maxPrice);
    console.log("MIN PRICE: ", minPrice);
    console.log("FLOOR PRICE: ", floorPrice);
    console.log('--------------------------------------------------------------------------------');

    const maxFloorBid = item.maxFloorBid <= 100 ? item.maxFloorBid : 100
    const minFloorBid = item.minFloorBid

    console.log('--------------------------------------------------------------------------------');
    console.log('BID RANGE AS A PERCENTAGE FLOOR PRICE');

    console.log("MAX PRICE PERCENTAGE OF FLOOR: ", Math.round(maxFloorBid * floorPrice / 100));
    console.log("MIN PRICE PERCENTAGE OF FLOOR: ", Math.round(minFloorBid * floorPrice / 100));
    console.log('--------------------------------------------------------------------------------');


    const minOffer = Math.max(minPrice, Math.round(minFloorBid * floorPrice / 100))
    const maxOffer = Math.min(maxPrice, Math.round(maxFloorBid * floorPrice / 100))


    const userBids = Object.entries(bidHistory).flatMap(([collectionSymbol, bidData]) => {
      return Object.entries(bidData.ourBids).map(([tokenId, bidInfo]) => ({
        collectionSymbol,
        tokenId,
        price: bidInfo.price,
        expiration: new Date(bidInfo.expiration).toISOString(),
      }));
    }).sort((a, b) => a.price - b.price)

    const ourBids = userBids.map((item) => item.tokenId)
    const tokensToCancel = findTokensToCancel(tokens, ourBids)

    console.log('--------------------------------------------------------------------------------');
    console.log('USER BIDS');
    console.table(userBids)
    console.log('--------------------------------------------------------------------------------');

    const bottomListingBids = combineBidsAndListings(userBids, bottomListings)
    console.log('--------------------------------------------------------------------------------');
    console.log('BOTTOM LISTING BIDS');
    console.table(bottomListingBids)
    console.log('--------------------------------------------------------------------------------');


    console.log('--------------------------------------------------------------------------------');
    console.log('TOKENS TO CANCEL');
    console.table(tokensToCancel)
    console.log('--------------------------------------------------------------------------------');


    if (tokensToCancel.length > 0) {

      await queue.addAll(
        tokensToCancel.map(tokenId => async () => {
          const offerData = await getOffers(tokenId,
            apiKey,
            buyerTokenReceiveAddress)
          if (offerData && Number(offerData.total) > 0) {
            const offer = offerData.offers[0]
            await cancelBid(offer, privateKey, collectionSymbol, tokenId, buyerPaymentAddress, apiKey)
          }
          delete bidHistory[collectionSymbol].ourBids[tokenId]
          delete bidHistory[collectionSymbol].topBids[tokenId]
        })
      )
    }

    await queue.addAll(
      bottomListings.map(token => async () => {
        const { id: tokenId, price: listedPrice } = token

        const bestOffer = await getBestOffer(tokenId, apiKey);
        const ourExistingOffer = bidHistory[collectionSymbol].ourBids[tokenId]?.expiration > Date.now()
        const currentBidCount = Object.values(bidHistory[collectionSymbol].topBids).length;

        const currentExpiry = bidHistory[collectionSymbol]?.ourBids[tokenId]?.expiration
        const newExpiry = duration * 60 * 1000

        if (currentExpiry - Date.now() > newExpiry) {
          const offerData = await getOffers(tokenId, apiKey, buyerTokenReceiveAddress)
          const offer = offerData?.offers[0]

          if (offer) {
            await cancelBid(offer, privateKey, collectionSymbol, tokenId, buyerPaymentAddress, apiKey)
          }
          delete bidHistory[collectionSymbol].ourBids[tokenId]
          delete bidHistory[collectionSymbol].topBids[tokenId]
        }

        if (!ourExistingOffer) {

          if (bestOffer && Number(bestOffer.total) > 0) {
            const topOffer = bestOffer.offers[0]
            if (topOffer.buyerPaymentAddress !== buyerPaymentAddress) {
              const currentPrice = topOffer.price
              const bidPrice = currentPrice + (outBidMargin * CONVERSION_RATE)
              if (bidPrice <= maxOffer) {
                console.log('-----------------------------------------------------------------------------------------------------------------------------');
                console.log(`OUTBID CURRENT OFFER ${currentPrice} OUR OFFER ${bidPrice} FOR ${collectionSymbol} ${tokenId}`);
                console.log('-----------------------------------------------------------------------------------------------------------------------------');

                try {
                  const status = await placeBid(tokenId, bidPrice, expiration, buyerTokenReceiveAddress, buyerPaymentAddress, publicKey, privateKey, collectionSymbol, apiKey)

                  if (status === true) {
                    bidHistory[collectionSymbol].topBids[tokenId] = true
                    bidHistory[collectionSymbol].ourBids[tokenId] = {
                      price: bidPrice,
                      expiration: expiration
                    }
                  }
                } catch (error) {
                  console.log(error);
                }
              } else {
                console.log('-----------------------------------------------------------------------------------------------------------------------------');
                console.log(`CALCULATED BID PRICE ${bidPrice} IS GREATER THAN MAX BID ${maxOffer} FOR ${collectionSymbol} ${tokenId}`);
                console.log('-----------------------------------------------------------------------------------------------------------------------------');
                delete bidHistory[collectionSymbol].topBids[tokenId]
                delete bidHistory[collectionSymbol].ourBids[tokenId]
              }
            }
          }

          else {
            const bidPrice = Math.max(listedPrice * 0.5, minOffer)

            if (bidPrice <= maxOffer) {
              try {
                const status = await placeBid(tokenId, bidPrice, expiration, buyerTokenReceiveAddress, buyerPaymentAddress, publicKey, privateKey, collectionSymbol, apiKey)
                if (status === true) {
                  bidHistory[collectionSymbol].topBids[tokenId] = true
                  bidHistory[collectionSymbol].ourBids[tokenId] = {
                    price: bidPrice,
                    expiration: expiration
                  }
                }

              } catch (error) {
                console.log(error);
              }
            } else {
              console.log('-----------------------------------------------------------------------------------------------------------------------------');
              console.log(`CALCULATED BID PRICE ${bidPrice} IS GREATER THAN MAX BID ${maxOffer} FOR ${collectionSymbol} ${tokenId}`);
              console.log('-----------------------------------------------------------------------------------------------------------------------------');

              delete bidHistory[collectionSymbol].topBids[tokenId]
              delete bidHistory[collectionSymbol].ourBids[tokenId]
            }
          }
        }
        else if (ourExistingOffer) {
          if (bestOffer && Number(bestOffer.total) > 0) {
            const [topOffer, secondTopOffer] = bestOffer.offers
            const bestPrice = topOffer.price

            if (topOffer.buyerPaymentAddress !== buyerPaymentAddress) {
              const offerData = await getOffers(tokenId, apiKey, buyerTokenReceiveAddress)
              if (offerData && Number(offerData.total) > 0) {
                const offer = offerData.offers[0]

                try {
                  await cancelBid(offer, privateKey, collectionSymbol, tokenId, buyerPaymentAddress, apiKey)
                  delete bidHistory[collectionSymbol].ourBids[tokenId]
                  delete bidHistory[collectionSymbol].topBids[tokenId]

                } catch (error) {
                  console.log(error);
                }

              }
              const currentPrice = topOffer.price
              const bidPrice = currentPrice + (outBidMargin * CONVERSION_RATE)

              if (bidPrice <= maxOffer) {
                console.log('-----------------------------------------------------------------------------------------------------------------------------');
                console.log(`OUTBID CURRENT OFFER ${currentPrice} OUR OFFER ${bidPrice} FOR ${collectionSymbol} ${tokenId}`);
                console.log('-----------------------------------------------------------------------------------------------------------------------------');

                try {
                  const status = await placeBid(tokenId, bidPrice, expiration, buyerTokenReceiveAddress, buyerPaymentAddress, publicKey, privateKey, collectionSymbol, apiKey)


                  if (status === true) {
                    bidHistory[collectionSymbol].topBids[tokenId] = true
                    bidHistory[collectionSymbol].ourBids[tokenId] = {
                      price: bidPrice,
                      expiration: expiration
                    }
                  }
                } catch (error) {
                  console.log(error);
                }

              } else {
                console.log('-----------------------------------------------------------------------------------------------------------------------------');
                console.log(`CALCULATED BID PRICE ${bidPrice} IS GREATER THAN MAX BID ${maxOffer} FOR ${collectionSymbol} ${tokenId}`);
                console.log('-----------------------------------------------------------------------------------------------------------------------------');

                delete bidHistory[collectionSymbol].topBids[tokenId]
                delete bidHistory[collectionSymbol].ourBids[tokenId]
              }

            } else {
              if (secondTopOffer) {
                const secondBestPrice = secondTopOffer.price
                const outBidAmount = outBidMargin * CONVERSION_RATE
                if (bestPrice - secondBestPrice > outBidAmount) {
                  const bidPrice = secondBestPrice + outBidAmount

                  try {
                    await cancelBid(topOffer, privateKey, collectionSymbol, tokenId, buyerPaymentAddress, apiKey)
                    delete bidHistory[collectionSymbol].ourBids[tokenId]
                    delete bidHistory[collectionSymbol].topBids[tokenId]

                  } catch (error) {
                    console.log(error);
                  }

                  if (bidPrice <= maxOffer) {
                    console.log('-----------------------------------------------------------------------------------------------------------------------------');
                    console.log(`ADJUST OUR CURRENT OFFER ${bestPrice} TO ${bidPrice} FOR ${collectionSymbol} ${tokenId}`);
                    console.log('-----------------------------------------------------------------------------------------------------------------------------');

                    try {

                      const status = await placeBid(tokenId, bidPrice, expiration, buyerTokenReceiveAddress, buyerPaymentAddress, publicKey, privateKey, collectionSymbol, apiKey)

                      if (status === true) {
                        bidHistory[collectionSymbol].topBids[tokenId] = true
                        bidHistory[collectionSymbol].ourBids[tokenId] = {
                          price: bidPrice,
                          expiration: expiration
                        }
                      }
                    } catch (error) {
                      console.log(error);
                    }
                  } else {
                    console.log('-----------------------------------------------------------------------------------------------------------------------------');
                    console.log(`CALCULATED BID PRICE ${bidPrice} IS GREATER THAN MAX BID ${maxOffer} FOR ${collectionSymbol} ${tokenId}`);
                    console.log('-----------------------------------------------------------------------------------------------------------------------------');

                    delete bidHistory[collectionSymbol].topBids[tokenId]
                    delete bidHistory[collectionSymbol].ourBids[tokenId]
                  }
                }
              } else {
                const bidPrice = Math.max(minOffer, listedPrice * 0.5)
                if (bestPrice !== bidPrice) { // self adjust bids.

                  try {
                    await cancelBid(topOffer, privateKey, collectionSymbol, tokenId, buyerPaymentAddress, apiKey)
                    delete bidHistory[collectionSymbol].ourBids[tokenId]
                    delete bidHistory[collectionSymbol].topBids[tokenId]
                  } catch (error) {
                    console.log(error);
                  }

                  console.log('-----------------------------------------------------------------------------------------------------------------------------');
                  console.log(`ADJUST OUR CURRENT OFFER ${bestPrice} TO ${bidPrice} FOR ${collectionSymbol} ${tokenId}`);
                  console.log('-----------------------------------------------------------------------------------------------------------------------------');

                  if (bidPrice <= maxOffer) {

                    try {
                      const status = await placeBid(tokenId, bidPrice, expiration, buyerTokenReceiveAddress, buyerPaymentAddress, publicKey, privateKey, collectionSymbol, apiKey)

                      if (status === true) {
                        bidHistory[collectionSymbol].topBids[tokenId] = true
                        bidHistory[collectionSymbol].ourBids[tokenId] = {
                          price: bidPrice,
                          expiration: expiration
                        }
                      }
                    } catch (error) {
                      console.log(error);
                    }
                  } else {
                    console.log('-----------------------------------------------------------------------------------------------------------------------------');
                    console.log(`CALCULATED BID PRICE ${bidPrice} IS GREATER THAN MAX BID ${maxOffer} FOR ${collectionSymbol} ${tokenId}`);
                    console.log('-----------------------------------------------------------------------------------------------------------------------------');

                    delete bidHistory[collectionSymbol].topBids[tokenId]
                    delete bidHistory[collectionSymbol].ourBids[tokenId]
                  }

                } else if (bidPrice > maxOffer) {
                  console.log('\x1b[31m%s\x1b[0m', '🛑 CURRENT PRICE IS GREATER THAN MAX OFFER!!! 🛑');
                  const offerData = await getOffers(tokenId, apiKey, buyerTokenReceiveAddress)

                  const offer = offerData?.offers[0]

                  if (offer) {
                    await cancelBid(offer, privateKey, collectionSymbol, tokenId, buyerPaymentAddress, apiKey)
                  }

                  delete bidHistory[collectionSymbol].ourBids[tokenId]
                  delete bidHistory[collectionSymbol].topBids[tokenId]
                }
              }
            }
          }
        }
      })
    )
  } catch (error) {
    throw error
  }
}

function findTokensToCancel(tokens: ITokenData[], ourBids: string[]): string[] {
  const missingBids = ourBids.filter(bid =>
    !tokens.some(token => token.id === bid)
  );
  return missingBids;
}

function combineBidsAndListings(userBids: UserBid[], bottomListings: BottomListing[]) {
  const combinedArray = userBids
    .map(bid => {
      const matchedListing = bottomListings.find(listing => listing.id === bid.tokenId);
      if (matchedListing) {
        return {
          bidId: bid.tokenId.slice(-8),
          bottomListingId: matchedListing.id.slice(-8),
          expiration: bid.expiration,
          price: bid.price,
          listedPrice: matchedListing.price
        };
      }
      return null;
    })
    .filter(entry => entry !== null);

  return combinedArray.sort((a: any, b: any) => a.listedPrice - b.listedPrice);
}

export interface ITokenData {
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
  meta: Meta;
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
  collection: object;
  itemType: string;
  sat: number;
  satName: string;
  satRarity: string;
  satBlockHeight: number;
  satBlockTime: string;
  satributes: any[];
}

interface Attribute { }

interface Meta {
  name: string;
  attributes: Attribute[];
  high_res_img_url: string;
}

interface UserBid {
  collectionSymbol: string;
  tokenId: string;
  price: number;
  expiration: string;
}

interface BottomListing {
  id: string;
  price: number;
}



async function placeBid(
  tokenId: string,
  offerPrice: number,
  expiration: number,
  buyerTokenReceiveAddress: string,
  buyerPaymentAddress: string,
  publicKey: string,
  privateKey: string,
  collectionSymbol: string,
  apiKey: string
) {
  try {
    const price = Math.round(offerPrice)
    const unsignedOffer = await createOffer(tokenId, price, expiration, buyerTokenReceiveAddress, buyerPaymentAddress, publicKey, FEE_RATE_TIER, apiKey)
    const signedOffer = await signData(unsignedOffer, privateKey)
    if (signedOffer) {
      await submitSignedOfferOrder(signedOffer, tokenId, offerPrice, expiration, buyerPaymentAddress, buyerTokenReceiveAddress, publicKey, FEE_RATE_TIER, apiKey)
      return true
    }
  } catch (error) {
    console.log(error);
    return false
  }
}