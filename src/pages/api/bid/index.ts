import * as bitcoin from "bitcoinjs-lib"
import { ECPairFactory, ECPairAPI } from 'ecpair';

import type { NextApiRequest, NextApiResponse } from 'next';
import PQueue from "p-queue"
import tinysecp from '@bitcoinerlab/secp256k1'
import { collectionDetails } from "@/services/collections";
import { ICollectionOffer, cancelCollectionOffer, createCollectionOffer, createOffer, getBestCollectionOffer, getBestOffer, getOffers, getUserOffers, signCollectionOffer, signData, submitCollectionOffer, submitSignedOfferOrder } from "@/services/offers";
import { retrieveTokens } from "@/services/tokens";
import { cancelBid } from "@/services/bid/cancel";
import { getBitcoinBalance } from "@/services/balance";
import axios from "axios";

export const bidHistory: BidHistory = {};
const network = bitcoin.networks.bitcoin;
const ECPair: ECPairAPI = ECPairFactory(tinysecp);
const CONVERSION_RATE = 1e8
const FEE_RATE_TIER = 'halfHourFee'

const runningState: { [collectionSymbol: string]: boolean } = {};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method === 'POST') {
      const { rateLimit, apiKey, tokenReceiveAddress, fundingWalletWIF, duration, bidCount, outBidMargin, maxFloorBid, minFloorBid, maxBid, minBid, collectionSymbol, offerType } = req.body.data as BidData

      const feeSatsPerVbyte = 28

      console.log({ offerType });
      if (req.body.data.running !== undefined) {
        runningState[collectionSymbol] = req.body.data.running;
      }
      console.log({ running: runningState[collectionSymbol], collectionSymbol });

      if (!runningState[collectionSymbol]) {
        return res.status(200).json({ message: "stopped" });
      }


      const queue = new PQueue({
        concurrency: 1.5 * rateLimit
      });

      if (req.body.requestType === 'processScheduledLoop' && runningState[collectionSymbol]) {
        console.log('----------------------------------------------------------------------');
        console.log(`START AUTOBID SCHEDULE FOR ${collectionSymbol}`);
        console.log('----------------------------------------------------------------------');

        const privateKey = fundingWalletWIF
        const keyPair = ECPair.fromWIF(privateKey, network);
        const publicKey = keyPair.publicKey.toString('hex');

        const buyerPaymentAddress = bitcoin.payments.p2wpkh({ pubkey: keyPair.publicKey, network: network }).address as string

        try {
          await getBitcoinBalance(buyerPaymentAddress)

          const collectionData = await collectionDetails(collectionSymbol, apiKey)

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

          const offerData = await getUserOffers(tokenReceiveAddress, apiKey)
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
          console.log(`BUYER TOKEN RECEIVE ADDRESS: ${tokenReceiveAddress}`);
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

          const ourBids = userBids.map((item) => ({ tokenId: item.tokenId, collectionSymbol: item.collectionSymbol })).filter((item) => item.collectionSymbol === collectionSymbol)

          const collectionBottomBids: CollectionBottomBid[] = tokens.map((item) => ({ tokenId: item.id, collectionSymbol: item.collectionSymbol })).filter((item) => item.collectionSymbol === collectionSymbol)

          const tokensToCancel = findTokensToCancel(collectionBottomBids, ourBids)

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
              tokensToCancel.map(token => async () => {
                const offerData = await getOffers(token.tokenId,
                  apiKey,
                  tokenReceiveAddress)
                if (offerData && Number(offerData.total) > 0) {
                  const offer = offerData.offers[0]
                  await cancelBid(offer, privateKey, collectionSymbol, token.tokenId, buyerPaymentAddress, apiKey)
                }
                delete bidHistory[collectionSymbol].ourBids[token.tokenId]
                delete bidHistory[collectionSymbol].topBids[token.tokenId]
              })
            )
          }


          if (offerType === "ITEM") {
            await queue.addAll(
              bottomListings.map(token => async () => {
                const { id: tokenId, price: listedPrice } = token

                const bestOffer = await getBestOffer(tokenId, apiKey);
                const ourExistingOffer = bidHistory[collectionSymbol].ourBids[tokenId]?.expiration > Date.now()
                const currentBidCount = Object.values(bidHistory[collectionSymbol].topBids).length;

                const currentExpiry = bidHistory[collectionSymbol]?.ourBids[tokenId]?.expiration
                const newExpiry = duration * 60 * 1000

                if (currentExpiry - Date.now() > newExpiry) {
                  const offerData = await getOffers(tokenId, apiKey, tokenReceiveAddress)
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
                          const status = await placeBid(tokenId, bidPrice, expiration, tokenReceiveAddress, buyerPaymentAddress, publicKey, privateKey, collectionSymbol, apiKey)

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
                        const status = await placeBid(tokenId, bidPrice, expiration, tokenReceiveAddress, buyerPaymentAddress, publicKey, privateKey, collectionSymbol, apiKey)
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
                      const offerData = await getOffers(tokenId, apiKey, tokenReceiveAddress)
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
                          const status = await placeBid(tokenId, bidPrice, expiration, tokenReceiveAddress, buyerPaymentAddress, publicKey, privateKey, collectionSymbol, apiKey)


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

                              const status = await placeBid(tokenId, bidPrice, expiration, tokenReceiveAddress, buyerPaymentAddress, publicKey, privateKey, collectionSymbol, apiKey)

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
                              const status = await placeBid(tokenId, bidPrice, expiration, tokenReceiveAddress, buyerPaymentAddress, publicKey, privateKey, collectionSymbol, apiKey)

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
                          const offerData = await getOffers(tokenId, apiKey, tokenReceiveAddress)

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
          } else if (offerType === "COLLECTION") {

            const bestOffer = await getBestCollectionOffer(collectionSymbol, apiKey)
            if (bestOffer && bestOffer.offers.length > 0) {

              const [topOffer, secondTopOffer] = bestOffer.offers
              const bestPrice = topOffer.price.amount
              const ourOffer = bestOffer.offers.find((item) => item.btcParams.makerPaymentAddress.toLowerCase() === buyerPaymentAddress.toLowerCase()) as ICollectionOffer


              if (topOffer.btcParams.makerPaymentAddress !== buyerPaymentAddress) {
                try {


                  if (ourOffer) {
                    const offerIds = [ourOffer.id]
                    await cancelCollectionOffer(offerIds, publicKey, privateKey, apiKey)
                  }
                } catch (error) {
                  console.log(error);
                }


                const currentPrice = topOffer.price.amount
                const bidPrice = currentPrice + (outBidMargin * CONVERSION_RATE)
                if (bidPrice <= maxOffer && bidPrice < floorPrice) {
                  console.log('-----------------------------------------------------------------------------------------------------------------------------');
                  console.log(`OUTBID CURRENT COLLECTION OFFER ${currentPrice} OUR OFFER ${bidPrice} FOR ${collectionSymbol}`);
                  console.log('-----------------------------------------------------------------------------------------------------------------------------');

                  try {
                    await placeCollectionBid(bidPrice, expiration, collectionSymbol, tokenReceiveAddress, publicKey, privateKey, feeSatsPerVbyte, apiKey)


                    bidHistory[collectionSymbol].offerType = "COLLECTION"

                  } catch (error) {
                    console.log(error);
                  }

                } else {
                  console.log('-----------------------------------------------------------------------------------------------------------------------------');
                  console.log(`CALCULATED COLLECTION OFFER PRICE ${bidPrice} IS GREATER THAN MAX BID ${maxOffer} FOR ${collectionSymbol}`);
                  console.log('-----------------------------------------------------------------------------------------------------------------------------');
                }

              } else {
                if (secondTopOffer) {
                  const secondBestPrice = secondTopOffer.price.amount
                  const outBidAmount = outBidMargin * CONVERSION_RATE
                  if (bestPrice - secondBestPrice > outBidAmount) {
                    const bidPrice = secondBestPrice + outBidAmount

                    try {
                      if (ourOffer) {
                        const offerIds = [ourOffer.id]
                        await cancelCollectionOffer(offerIds, publicKey, privateKey, apiKey)
                      }

                    } catch (error) {
                      console.log(error);
                    }

                    if (bidPrice <= maxOffer && bidPrice < floorPrice) {
                      console.log('-----------------------------------------------------------------------------------------------------------------------------');
                      console.log(`ADJUST OUR CURRENT COLLECTION OFFER ${bestPrice} TO ${bidPrice} FOR ${collectionSymbol}`);
                      console.log('-----------------------------------------------------------------------------------------------------------------------------');
                      try {

                        await placeCollectionBid(bidPrice, expiration, collectionSymbol, tokenReceiveAddress, publicKey, privateKey, feeSatsPerVbyte, apiKey)
                        bidHistory[collectionSymbol].offerType = "COLLECTION"
                      } catch (error) {
                        console.log(error);
                      }
                    } else {
                      console.log('-----------------------------------------------------------------------------------------------------------------------------');
                      console.log(`CALCULATED COLLECTION OFFER PRICE ${bidPrice} IS GREATER THAN MAX BID ${maxOffer} FOR ${collectionSymbol}`);
                      console.log('-----------------------------------------------------------------------------------------------------------------------------');
                    }
                  }
                } else {
                  const bidPrice = minOffer
                  if (bestPrice !== bidPrice) {
                    try {
                      if (ourOffer) {
                        const offerIds = [ourOffer.id]
                        await cancelCollectionOffer(offerIds, publicKey, privateKey, apiKey)
                      }
                    } catch (error) {
                      console.log(error);
                    }

                    console.log('-----------------------------------------------------------------------------------------------------------------------------');
                    console.log(`ADJUST OUR CURRENT COLLECTION OFFER ${bestPrice} TO ${bidPrice} FOR ${collectionSymbol} `);
                    console.log('-----------------------------------------------------------------------------------------------------------------------------');

                    if (bidPrice <= maxOffer && bidPrice < floorPrice) {

                      try {
                        await placeCollectionBid(bidPrice, expiration, collectionSymbol, tokenReceiveAddress, publicKey, privateKey, feeSatsPerVbyte, apiKey)
                        bidHistory[collectionSymbol].offerType = "COLLECTION"
                      } catch (error) {
                        console.log(error);
                      }
                    } else {
                      console.log('-----------------------------------------------------------------------------------------------------------------------------');
                      console.log(`CALCULATED BID PRICE ${bidPrice} IS GREATER THAN MAX BID ${maxOffer} FOR ${collectionSymbol}`);
                      console.log('-----------------------------------------------------------------------------------------------------------------------------');
                    }

                  }
                }
              }
            } else {
              const bidPrice = minOffer
              if (bidPrice <= maxOffer && bidPrice < floorPrice) {
                await placeCollectionBid(bidPrice, expiration, collectionSymbol, tokenReceiveAddress, publicKey, privateKey, feeSatsPerVbyte, apiKey)
                bidHistory[collectionSymbol].offerType = "COLLECTION"
              }
            }
          }
        } catch (error) {
          throw error
        }
        runningState[collectionSymbol] = false
        res.status(200).json({ message: `started bidding for ${collectionSymbol}` })
      }
      else if (req.body.requestType === 'processCounterBidLoop' && runningState[collectionSymbol]) {

        console.log('----------------------------------------------------------------------');
        console.log(`START COUNTERBID SCHEDULE FOR ${collectionSymbol}`);
        console.log('----------------------------------------------------------------------');

        const privateKey = fundingWalletWIF
        const keyPair = ECPair.fromWIF(privateKey, network);
        const publicKey = keyPair.publicKey.toString('hex');

        const buyerPaymentAddress = bitcoin.payments.p2wpkh({ pubkey: keyPair.publicKey, network: network }).address as string
        const currentTime = new Date().getTime();
        const expiration = currentTime + (duration * 60 * 1000);
        const maxPrice = Math.round(maxBid * CONVERSION_RATE)

        try {
          await getBitcoinBalance(buyerPaymentAddress)
          const collectionData = await collectionDetails(collectionSymbol, apiKey)
          const floorPrice = Number(collectionData?.floorPrice) ?? 0

          const maxOffer = Math.min(maxPrice, Math.round(maxFloorBid * floorPrice / 100))

          const lastSeenTimestamp = bidHistory[collectionSymbol]?.lastSeenActivity || null;

          const { offers, latestTimestamp, soldTokens } = await getCollectionActivity(
            collectionSymbol,
            apiKey,
            lastSeenTimestamp
          );

          bidHistory[collectionSymbol].lastSeenActivity = latestTimestamp
          const ourBids = Object.keys(bidHistory[collectionSymbol].ourBids);

          const latestOffers = offers
            .filter((offer) => ourBids.includes(offer.tokenId))
            .map((item) => ({ collectionSymbol: item.collectionSymbol, tokenId: item.tokenId, buyerPaymentAddress: item.buyerPaymentAddress, price: item.listedPrice, createdAt: new Date(item.createdAt).toISOString() }))
            .reduce((accumulator: Offer[], currentOffer: Offer) => {
              const existingItemIndex = accumulator.findIndex(item => item.tokenId === currentOffer.tokenId);
              if (existingItemIndex !== -1) {
                if (new Date(currentOffer.createdAt).getTime() > new Date(accumulator[existingItemIndex].createdAt).getTime()) {
                  accumulator[existingItemIndex] = currentOffer;
                }
              } else {
                accumulator.push(currentOffer);
              }
              return accumulator;
            }, []);


          latestOffers.forEach((item) => {
            const bidPrice = bidHistory[collectionSymbol].ourBids[item.tokenId].price
            if (item.price > bidPrice) {
              bidHistory[collectionSymbol].topOffers[item.tokenId] = {
                price: item.price,
                buyerPaymentAddress: item.buyerPaymentAddress
              }
            }
          })

          const sold = soldTokens
            .filter((offer) => ourBids.includes(offer.tokenId))
            .sort((a, b) => b.listedPrice - a.listedPrice)
            .map((item) => ({ collectionSymbol: item.collectionSymbol, tokenId: item.tokenId, buyerPaymentAddress: item.buyerPaymentAddress, price: item.listedPrice, createdAt: item.createdAt }))
            .reduce((accumulator: Offer[], currentOffer: Offer) => {
              const existingItemIndex = accumulator.findIndex(item => item.tokenId === currentOffer.tokenId);
              if (existingItemIndex !== -1) {
                if (new Date(currentOffer.createdAt).getTime() > new Date(accumulator[existingItemIndex].createdAt).getTime()) {
                  accumulator[existingItemIndex] = currentOffer;
                }
              } else {
                accumulator.push(currentOffer);
              }
              return accumulator;
            }, []);

          if (sold.length > 0) {

            for (const token of sold) {
              delete bidHistory[collectionSymbol].ourBids[token.tokenId]
              delete bidHistory[collectionSymbol].topBids[token.tokenId]
              delete bidHistory[collectionSymbol].topOffers[token.tokenId]

            }
          }

          console.log('-------------------------------------------------------------------------------');
          console.log(`LATEST OFFERS ${collectionSymbol}`);
          console.table(latestOffers);
          console.log('-------------------------------------------------------------------------------');

          console.log('-------------------------------------------------------------------------------');
          console.log(`SOLD TOKENS ${collectionSymbol}`);
          console.table(sold);
          console.log('-------------------------------------------------------------------------------');

          const bottomListings = bidHistory[collectionSymbol].bottomListings


          const userBids = Object.entries(bidHistory).flatMap(([collectionSymbol, bidData]) => {
            return Object.entries(bidData.ourBids).map(([tokenId, bidInfo]) => ({
              collectionSymbol,
              tokenId,
              price: bidInfo.price,
              expiration: new Date(bidInfo.expiration).toISOString(),
            }));
          }).sort((a, b) => a.price - b.price)


          const bottomListingBids = combineBidsAndListings(userBids, bottomListings)
          const bottomBids = bottomListingBids.map((item) => item?.bidId)

          const counterOffers = offers
            .filter((offer) =>
              ourBids.includes(offer.tokenId)
              && offer.buyerPaymentAddress !== buyerPaymentAddress)
            .filter((offer) => bottomBids.includes(offer.tokenId))
            .map((item) => ({ collectionSymbol: item.collectionSymbol, tokenId: item.tokenId, buyerPaymentAddress: item.buyerPaymentAddress, price: item.listedPrice, createdAt: item.createdAt }))

          console.log('-------------------------------------------------------------------------------');
          console.log('NEW COUNTER OFFERS');
          console.table(counterOffers)
          console.log('-------------------------------------------------------------------------------');

          const lastSeenActivity = Date.now()
          bidHistory[collectionSymbol].lastSeenActivity = lastSeenActivity


          if (counterOffers.length > 0) {
            const floorPrice = Number(collectionData?.floorPrice) ?? 0

            console.log('--------------------------------------------------------------------------------');
            console.log('BID RANGE AS A PERCENTAGE FLOOR PRICE');
            console.log("MAX PRICE PERCENTAGE OF FLOOR: ", Math.round(maxFloorBid * floorPrice / 100));
            console.log("MIN PRICE PERCENTAGE OF FLOOR: ", Math.round(minFloorBid * floorPrice / 100));
            console.log('--------------------------------------------------------------------------------');

            const maxOffer = Math.max(maxPrice, Math.round(maxFloorBid * floorPrice / 100))

            await queue.addAll(
              counterOffers.map((offers) => async () => {
                const { tokenId, price: listedPrice } = offers
                const bidPrice = listedPrice + (outBidMargin * CONVERSION_RATE)

                const ourBidPrice = bidHistory[collectionSymbol]?.ourBids[tokenId]?.price
                const offerData = await getOffers(tokenId, apiKey, tokenReceiveAddress)
                if (offerData && offerData.offers && +offerData.total > 0) {
                  const offer = offerData.offers[0]

                  if (listedPrice > ourBidPrice) {
                    console.log('-------------------------------------------------------------------------');
                    console.log('COUNTERBIDDING!!!!');
                    console.log('-------------------------------------------------------------------------');


                    try {
                      await cancelBid(offer, privateKey, collectionSymbol, tokenId, buyerPaymentAddress, apiKey)
                      delete bidHistory[collectionSymbol].ourBids[tokenId]
                      delete bidHistory[collectionSymbol].topBids[tokenId]
                    } catch (error) {
                      console.log(error);
                    }
                    if (bidPrice <= maxOffer) {
                      try {
                        const status = await placeBid(tokenId, bidPrice, expiration, tokenReceiveAddress, buyerPaymentAddress, publicKey, privateKey, collectionSymbol, apiKey)
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
                    console.log('-----------------------------------------------------------------------------------------------------------------------------');
                    console.log(`YOU CURRENTLY HAVE THE HIGHEST OFFER ${ourBidPrice} FOR ${collectionSymbol} ${tokenId}`);
                    console.log('-----------------------------------------------------------------------------------------------------------------------------');
                  }
                }
              })
            )
          }
        } catch (error) {
          console.log(error);
        }
        runningState[collectionSymbol] = false
        res.status(200).json({ status: "okay" })
      }
      runningState[collectionSymbol] = false
      res.status(200).json({ status: "okay" })
    }
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: 'something went wrong' })
  }
}

async function getCollectionActivity(
  collectionSymbol: string,
  apiKey: string,
  lastSeenTimestamp: number | null = null
): Promise<{ lists: OfferPlaced[]; offers: OfferPlaced[]; soldTokens: OfferPlaced[]; latestTimestamp: number | null }> {
  const url = "https://nfttools.pro/magiceden/v2/ord/btc/activities";
  const params: any = {
    limit: 100,
    collectionSymbol,
    kind: ["list", "offer_placed", "buying_broadcasted", "offer_accepted_broadcasted"],
  };

  try {
    let lists: OfferPlaced[] = [];
    let offers: OfferPlaced[] = [];
    let soldTokens: OfferPlaced[] = [];
    let response;
    let offset = 0;
    let latestTimestamp = lastSeenTimestamp;

    const headers = {
      'Content-Type': 'application/json',
      'X-NFT-API-Key': apiKey,
    }

    do {
      params.offset = offset;
      response = await axios.get(url, { params, headers })


      for (const activity of response.data.activities) {
        const activityTimestamp = new Date(activity.createdAt).getTime();

        if (lastSeenTimestamp !== null && activityTimestamp <= (lastSeenTimestamp - 10 * 1000)) {
          // Activity has already been seen, break the loop
          return { lists, offers, soldTokens, latestTimestamp };
        }

        if (activity.kind === "list") {
          lists.push(activity);
        } else if (activity.kind === "offer_placed") {
          offers.push(activity);
        } else if (activity.kind === "buying_broadcasted" || activity.kind === "offer_accepted_broadcasted") {
          soldTokens.push(activity)
        }

        if (lists.length + offers.length === params.limit) {
          break;
        }
      }

      offset += response.data.activities.length;
    } while (lists.length + offers.length < params.limit);

    if (response.data.activities.length > 0) {
      latestTimestamp = new Date(response.data.activities[0].createdAt).getTime();
    }

    return { lists, offers, soldTokens, latestTimestamp };
  } catch (error: any) {
    console.error("Error fetching collection activity:", error.response);
    return { lists: [], offers: [], soldTokens: [], latestTimestamp: lastSeenTimestamp };
  }
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

interface BottomListing {
  id: string;
  price: number;
}

async function placeCollectionBid(
  offerPrice: number,
  expiration: number,
  collectionSymbol: string,
  buyerTokenReceiveAddress: string,
  publicKey: string,
  privateKey: string,
  feeSatsPerVbyte: number = 28,
  apiKey: string
) {
  const priceSats = Math.ceil(offerPrice)
  const expirationAt = new Date(expiration).toISOString();

  const unsignedCollectionOffer = await createCollectionOffer(collectionSymbol, priceSats, expirationAt, feeSatsPerVbyte, publicKey, buyerTokenReceiveAddress, apiKey)
  if (unsignedCollectionOffer) {
    const { signedOfferPSBTBase64, signedCancelledPSBTBase64 } = signCollectionOffer(unsignedCollectionOffer, privateKey)
    await submitCollectionOffer(signedOfferPSBTBase64, signedCancelledPSBTBase64, collectionSymbol, priceSats, expirationAt, publicKey, buyerTokenReceiveAddress, apiKey)
  }

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

function findTokensToCancel(tokens: CollectionBottomBid[], ourBids: { tokenId: string, collectionSymbol: string }[]): {
  tokenId: string;
  collectionSymbol: string;
}[] {

  const missingBids = ourBids.filter(bid =>
    !tokens.some(token => token.tokenId === bid.tokenId && token.collectionSymbol === bid.collectionSymbol)
  );
  return missingBids;
}

interface Offer {
  collectionSymbol: string;
  tokenId: string;
  buyerPaymentAddress: string;
  price: number;
  createdAt: string;
}
interface CollectionBottomBid {
  tokenId: string;
  collectionSymbol: string
}

interface BidHistory {
  [collectionSymbol: string]: {
    offerType: 'ITEM' | 'COLLECTION';
    topOffers: {
      [tokenId: string]: {
        price: number,
        buyerPaymentAddress: string
      }
    },
    ourBids: {
      [tokenId: string]: {
        price: number,
        expiration: number
      };
    };
    topBids: {
      [tokenId: string]: boolean;
    };
    bottomListings: {
      id: string;
      price: number;
    }[]
    lastSeenActivity: number | null | undefined
  };
}
interface Attribute { }

interface Meta {
  name: string;
  attributes: Attribute[];
  high_res_img_url: string;
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

interface UserBid {
  collectionSymbol: string;
  tokenId: string;
  price: number;
  expiration: string;
}
export interface BidData {
  offerType: "ITEM" | "COLLECTION";
  collectionSymbol: string;
  minBid: number;
  maxBid: number;
  minFloorBid: number;
  maxFloorBid: number;
  outBidMargin: number;
  bidCount: number;
  duration: number;
  fundingWalletWIF: string;
  tokenReceiveAddress: string;
  scheduledLoop: number;
  counterbidLoop: number;
  running: boolean;
  apiKey: string;
  rateLimit: number;
}


export interface OfferPlaced {
  kind: 'offer_placed' | 'list';
  tokenId: string;
  chain: 'btc';
  collectionSymbol: string;
  collection: Collection;
  token: Token;
  createdAt: string;
  tokenInscriptionNumber: number;
  listedPrice: number;
  oldLocation: string;
  oldOwner: string;
  newOwner: string;
  txValue: number;
  sellerPaymentReceiverAddress: string;
  buyerPaymentAddress: string;
  selectedFeeType: string;
}

interface Collection {
  symbol: string;
  name: string;
  imageURI: string;
  chain: string;
  labels: string[];
}

export interface Token {
  inscriptionNumber: string;
  contentURI: string;
  contentType: string;
  contentBody: any;
  contentPreviewURI: string;
  meta: object;
  satRarity: string;
  satBlockHeight: number;
  satBlockTime: string;
  domain: any;
}