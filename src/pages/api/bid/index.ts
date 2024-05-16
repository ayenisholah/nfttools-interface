import * as bitcoin from "bitcoinjs-lib"
import WebSocket from 'ws';

import { ECPairFactory, ECPairAPI } from 'ecpair';

import type { NextApiRequest, NextApiResponse } from 'next';
import PQueue from "p-queue"
import tinysecp from '@bitcoinerlab/secp256k1'
import { collectionDetails } from "@/services/collections";
import { ICollectionOffer, cancelCollectionOffer, createCollectionOffer, createOffer, getBestCollectionOffer, getBestOffer, getOffers, getUserOffers, signCollectionOffer, signData, submitCollectionOffer, submitSignedOfferOrder } from "@/services/offers";
import { retrieveTokens } from "@/services/tokens";
import { cancelBid } from "@/services/bid/cancel";
import { getBitcoinBalance } from "@/services/balance";
import axiosRetry, { IAxiosRetryConfig } from "axios-retry";
import axios, { Axios, AxiosInstance } from "axios";
import Bottleneck from "bottleneck";

export const bidHistory: BidHistory = {};
const network = bitcoin.networks.bitcoin;
const ECPair: ECPairAPI = ECPairFactory(tinysecp);
const CONVERSION_RATE = 1e8
const FEE_RATE_TIER = 'halfHourFee'

export const axiosInstance: AxiosInstance = axios.create({
  timeout: 300000,
});

let data: CollectionData[];


export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    if (req.method === 'POST') {
      const { rateLimit, apiKey, collections } = req.body.data as BidData

      const limiter = new Bottleneck({
        minTime: 1 / (rateLimit * 0.9),
      });

      const retryConfig: IAxiosRetryConfig = {
        retries: 3,
        retryDelay: (retryCount, error) => {
          limiter.schedule(() => Promise.resolve());
          if (error.response && error.response.status === 429) {
            return 2000;
          }
          return axiosRetry.exponentialDelay(retryCount);
        },
        retryCondition: async (error: any) => {
          if (/have reached the maximum number of offers you can make: 20/i.test(error.response.data.error)) {
            return false;
          }
          if (/Insufficient funds. Required/i.test(error.response.data.error)) {
            return false;
          }
          if (/This offer does not exists. It is either not valid anymore or canceled by the offerer./i.test(error.response.data.error)) {
            return false;
          }

          if (/You already have an offer for this token/i.test(error.response.data.error)) {
            return true
          }
          if (
            axiosRetry.isNetworkError(error) || (error.response && error.response.status === 429)) {
            return true;
          }
          return false;
        },
      };

      axiosRetry(axiosInstance, retryConfig);


      const eventManager = new EventManager(collections, apiKey, rateLimit, limiter, axiosInstance)

      if (collections.length > 0) {
        connectWebSocket(collections, eventManager)
        startProcessing(collections, eventManager);
      }

      res.status(200).json({ status: "running" })
    }
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: 'something went wrong' })
  }
}

let ws: WebSocket;
let heartbeatIntervalId: NodeJS.Timeout | null = null;
let reconnectTimeoutId: any
let retryCount: number = 0;

async function startProcessing(collections: CollectionData[], eventManager: EventManager) {
  console.log("Running");
  let startScheduled = true
  collections.map(async (item) => {
    const loop = item.scheduledLoop * 1000
    startScheduled = item.running

    console.log({ loop, startScheduled });

    while (startScheduled) {
      await eventManager.runScheduledTask(item);
      await delay(loop)
    }
  })
}


function connectWebSocket(collections: CollectionData[], eventManager: EventManager): void {
  const baseEndpoint: string = 'wss://wss-mainnet.magiceden.io/CJMw7IPrGPUb13adEQYW2ASbR%2FIWToagGUCr02hWp1oWyLAtf5CS0XF69WNXj0MbO6LEQLrFQMQoEqlX7%2Fny2BP08wjFc9MxzEmM5v2c5huTa3R1DPqGSbuO2TXKEEneIc4FMEm5ZJruhU8y4cyfIDzGqhWDhxK3iRnXtYzI0FGG1%2BMKyx9WWOpp3lLA3Gm2BgNpHHp3wFEas5TqVdJn0GtBrptg8ZEveG8c44CGqfWtEsS0iI8LZDR7tbrZ9fZpbrngDaimEYEH6MgvhWPTlKrsGw%3D%3D';

  ws = new WebSocket(baseEndpoint);

  ws.addEventListener("open", function open() {
    console.log("Connected to Magic Eden Websocket");
    retryCount = 0;
    if (reconnectTimeoutId !== null) {
      clearTimeout(reconnectTimeoutId);
      reconnectTimeoutId = null;
    }
    if (heartbeatIntervalId !== null) {
      clearInterval(heartbeatIntervalId);
    }
    heartbeatIntervalId = setInterval(() => {
      if (ws) {
        ws.send(
          JSON.stringify({
            topic: "nfttools",
            event: "heartbeat",
            payload: {},
            ref: 0,
          })
        );
      }
    }, 10000);

    if (collections && collections.length > 0) {
      subscribeToCollections(collections);
    }



    ws.on("message", function incoming(data: string) {
      if (isValidJSON(data.toString())) {
        const message: CollectOfferActivity = JSON.parse(data);
        eventManager.receiveWebSocketEvent(message);
      }
    });
  });

  ws.addEventListener("close", function close() {
    console.log("Disconnected from OpenSea Stream API");
    if (heartbeatIntervalId !== null) {
      clearInterval(heartbeatIntervalId);
      heartbeatIntervalId = null;
    }
    attemptReconnect(collections, eventManager);
  });

  ws.addEventListener("error", function error(err: any) {
    console.error("WebSocket error:", err);
    if (ws) {
      ws.close();
    }
  });


}



const MAX_RETRIES: number = 5;

function attemptReconnect(collections: CollectionData[], eventManager: EventManager): void {
  if (retryCount < MAX_RETRIES) {
    if (reconnectTimeoutId !== null) {
      clearTimeout(reconnectTimeoutId);
    }
    let delay: number = Math.pow(2, retryCount) * 1000;
    console.log(`Attempting to reconnect in ${delay / 1000} seconds...`);
    reconnectTimeoutId = setTimeout(() => { connectWebSocket(collections, eventManager) }, delay);
    retryCount++;
  } else {
    console.log("Max retries reached. Giving up on reconnecting.");
  }
}

function subscribeToCollections(collections: CollectionData[]) {

  collections.forEach((item) => {
    const subscriptionMessage = {
      type: 'subscribeCollection',
      constraint: {
        chain: 'bitcoin',
        collectionSymbol: item.collectionSymbol
      }
    };

    if (item.enableCounterBidding && item.running) {
      ws.send(JSON.stringify(subscriptionMessage));
      console.log('----------------------------------------------------------------------');
      console.log(`SUBSCRIBED TO COLLECTION: ${item.collectionSymbol}`);
      console.log('----------------------------------------------------------------------');
    }

  });
}

class EventManager {
  queue: any[];
  rateLimit: number;
  isScheduledRunning: boolean;
  isProcessingQueue: boolean;
  collections: CollectionData[];
  apiKey: string
  processingTokens: Record<string, boolean> = {};
  limiter: Bottleneck;
  axiosInstance: AxiosInstance;

  constructor(collections: CollectionData[], apiKey: string, rateLimit: number,
    limiter: Bottleneck,
    axiosInstance: AxiosInstance
  ) {
    this.limiter = limiter
    this.axiosInstance = axiosInstance
    this.collections = collections;
    this.apiKey = apiKey
    this.rateLimit = rateLimit
    this.queue = [];
    this.processingTokens = {}
    this.isScheduledRunning = false;
    this.isProcessingQueue = false;
  }

  async receiveWebSocketEvent(event: CollectOfferActivity): Promise<void> {
    this.queue.push(event);
    this.processQueue();
  }

  async processQueue(): Promise<void> {
    // Ensure that the queue is not currently being processed and that there is something to process
    if (!this.isProcessingQueue && this.queue.length > 0) {
      this.isProcessingQueue = true;
      // Process the queue
      while (this.queue.length > 0) {
        // Wait until `this.isScheduledRunning` is false before starting processing
        while (this.isScheduledRunning) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
        const event = this.queue.shift();
        if (event) {
          this.handleIncomingBid(event);
        }
      }
      this.isProcessingQueue = false
    }
  }

  async handleIncomingBid(message: CollectOfferActivity) {
    try {
      const { newOwner: incomingBuyerTokenReceiveAddress, collectionSymbol, tokenId, listedPrice: incomingBidAmount, createdAt } = message

      const watchedEvents = [
        "offer_placed",
        "coll_offer_created",
        "offer_cancelled",
        "buying_broadcasted",
        "offer_accepted_broadcasted",
        "coll_offer_created",
        "coll_offer_fulfill_broadcasted"
      ]

      if (!watchedEvents.includes(message.kind)) return
      const collection = this.collections.find((item) => item.collectionSymbol === collectionSymbol)
      if (!collection) return

      if (!bidHistory[collectionSymbol]) {
        bidHistory[collectionSymbol] = {
          offerType: collection.offerType,
          topOffers: {},
          ourBids: {},
          topBids: {},
          bottomListings: [],
          lastSeenActivity: null,
          quantity: 0
        };
      }

      const outBidMargin = +collection?.outBidMargin
      const duration = +collection?.duration
      const buyerTokenReceiveAddress = collection?.tokenReceiveAddress;
      const bidCount = +collection.bidCount
      const bottomListings = bidHistory[collectionSymbol].bottomListings.sort((a, b) => a.price - b.price).map((item) => item.id).slice(0, bidCount)
      const privateKey = collection.fundingWalletWIF;
      const currentTime = new Date().getTime();
      const expiration = currentTime + (duration * 60 * 1000);
      const keyPair = ECPair.fromWIF(privateKey, network);
      const publicKey = keyPair.publicKey.toString('hex');
      const buyerPaymentAddress = bitcoin.payments.p2wpkh({ pubkey: keyPair.publicKey, network: network }).address as string
      const outBidAmount = +outBidMargin * 1e8
      const maxFloorBid = +collection.maxFloorBid <= 100 ? collection.maxFloorBid : 100

      const collectionData = await collectionDetails(collectionSymbol, this.apiKey, this.limiter, this.axiosInstance)

      const floorPrice = Number(collectionData?.floorPrice) ?? 0
      const maxPrice = +Math.round(collection.maxBid * CONVERSION_RATE)
      const maxOffer = +Math.min(maxPrice, Math.round(maxFloorBid * floorPrice / 100))
      const offerType = collection.offerType

      const maxBuy = collection.quantity ?? 1
      const quantity = bidHistory[collectionSymbol].quantity

      if (quantity === maxBuy) return


      if (offerType === "ITEM") {
        if (message.kind === "offer_placed") {
          const incomingItemKey = `${tokenId}:${new Date(createdAt).getTime()}`
          if (bottomListings.includes(tokenId)) {
            if (incomingBuyerTokenReceiveAddress.toLowerCase() != buyerTokenReceiveAddress.toLowerCase()) {
              console.log(`COUNTERBID FOR ${collectionSymbol} ${tokenId}`);
              const bidPrice = +(incomingBidAmount) + outBidAmount

              try {
                const userBids = Object.entries(bidHistory).flatMap(([collectionSymbol, bidData]) => {
                  return Object.entries(bidData.ourBids).map(([tokenId, bidInfo]) => ({
                    collectionSymbol,
                    tokenId,
                    price: bidInfo.price,
                    expiration: new Date(bidInfo.expiration).toISOString(),
                  }));
                }).sort((a, b) => a.price - b.price)

                userBids.forEach((bid) => {
                  const givenTimestamp = new Date(bid.expiration);
                  const bidExpiration = new Date();
                  bidExpiration.setMinutes(bidExpiration.getMinutes() + duration);

                  if (givenTimestamp.getTime() >= bidExpiration.getTime()) {
                    console.log('REMOVE EXPIRED BIDS');
                    delete bidHistory[collectionSymbol].ourBids[bid.tokenId]
                    delete bidHistory[collectionSymbol].topBids[bid.tokenId]
                  }
                })

                if (bidPrice <= maxOffer) {

                  let status;
                  // Wait if token is already being processed
                  while (this.processingTokens[tokenId]) {
                    await new Promise(resolve => setTimeout(resolve, 500));
                  }

                  // Mark the token as being processed
                  this.processingTokens[tokenId] = true;

                  try {
                    status = await placeBid(tokenId, bidPrice, expiration, buyerTokenReceiveAddress, buyerPaymentAddress, publicKey, privateKey, collectionSymbol, this.apiKey, this.limiter, this.axiosInstance);
                  } finally {
                    // Always mark the token as not being processed when done
                    this.processingTokens[tokenId] = false;
                  }
                  if (status === true) {
                    bidHistory[collectionSymbol].topBids[tokenId] = true
                    bidHistory[collectionSymbol].ourBids[tokenId] = {
                      price: bidPrice,
                      expiration: expiration
                    }
                  }
                }

              } catch (error) {
                console.log(error);
              } finally {
                this.processingTokens[tokenId] = false;

              }
            }
          }
        }
      } else if (offerType === "COLLECTION") {
        if (message.kind === "coll_offer_created") {
          if (incomingBuyerTokenReceiveAddress.toLowerCase() != buyerTokenReceiveAddress.toLowerCase()) {
            console.log(`INCOMING COLLECTION OFFER ${collectionSymbol}: `, message);
            console.log(`COUNTERBID FOR ${collectionSymbol} COLLECTION OFFER`);


            while (this.processingTokens[collectionSymbol]) {
              console.log(`Processing existing collection offer: ${collectionSymbol}`.toUpperCase());
              await new Promise(resolve => setTimeout(resolve, 500));
            }

            this.processingTokens[collectionSymbol] = true

            const bidPrice = +(incomingBidAmount) + outBidAmount

            const offerData = await getBestCollectionOffer(collectionSymbol, this.apiKey, this.limiter, this.axiosInstance)
            const ourOffer = offerData?.offers.find((item) => item.btcParams.makerOrdinalReceiveAddress.toLowerCase() === buyerTokenReceiveAddress.toLowerCase())

            if (ourOffer) {
              const offerIds = [ourOffer.id]
              await cancelCollectionOffer(offerIds, publicKey, privateKey, this.apiKey, this.limiter, this.axiosInstance)
            }
            const feeSatsPerVbyte = 28

            try {
              if (bidPrice < maxOffer || bidPrice < floorPrice) {
                await placeCollectionBid(bidPrice, expiration, collectionSymbol, buyerTokenReceiveAddress, publicKey, privateKey, feeSatsPerVbyte, this.apiKey, this.limiter, this.axiosInstance)
                bidHistory[collectionSymbol].highestCollectionOffer = {
                  price: bidPrice,
                  buyerPaymentAddress: buyerPaymentAddress
                }
              }

            } catch (error) {

            } finally {
              delete this.processingTokens[collectionSymbol]

            }
          }
        }
      }

      if (message.kind === "buying_broadcasted" || message.kind === "offer_accepted_broadcasted" || message.kind === "coll_offer_fulfill_broadcasted") {
        if (incomingBuyerTokenReceiveAddress === buyerTokenReceiveAddress) {
          bidHistory[collectionSymbol].quantity += 1
        }
      }
    } catch (error) {
      console.log(error);
    }
  }

  async runScheduledTask(item: CollectionData): Promise<void> {
    console.log('Scheduled task is waiting for queue to complete.');
    while (this.isProcessingQueue) {
      await new Promise(resolve => setTimeout(resolve, 100)); // Wait for queue processing to pause
    }
    console.log('Scheduled task running...');
    this.isScheduledRunning = true;
    this.processScheduledLoop(item);
    console.log('Scheduled task completed.');
    this.isScheduledRunning = false;
  }

  async processScheduledLoop(item: CollectionData) {

    console.log('----------------------------------------------------------------------');
    console.log(`START AUTOBID SCHEDULE FOR ${item.collectionSymbol}`);
    console.log('----------------------------------------------------------------------');

    const collectionSymbol = item.collectionSymbol
    const feeSatsPerVbyte = item.feeSatsPerVbyte ?? 28
    const offerType = item.offerType.toUpperCase()
    const minBid = item.minBid
    const maxBid = item.maxBid
    const bidCount = item.bidCount ?? 20
    const duration = item.duration
    const outBidMargin = item.outBidMargin
    const buyerTokenReceiveAddress = item.tokenReceiveAddress;
    const privateKey = item.fundingWalletWIF;
    const keyPair = ECPair.fromWIF(privateKey, network);
    const publicKey = keyPair.publicKey.toString('hex');
    const maxBuy = item.quantity ?? 1
    const enableCounterBidding = item.enableCounterBidding ?? false

    const buyerPaymentAddress = bitcoin.payments.p2wpkh({ pubkey: keyPair.publicKey, network: network }).address as string

    try {

      if (!bidHistory[collectionSymbol]) {
        bidHistory[collectionSymbol] = {
          offerType: "ITEM",
          topOffers: {},
          ourBids: {},
          topBids: {},
          bottomListings: [],
          lastSeenActivity: null,
          quantity: 0
        };
      }

      const quantity = bidHistory[collectionSymbol].quantity
      if (quantity === maxBuy) {
        return
      }

      const balance = await getBitcoinBalance(buyerPaymentAddress, this.apiKey, this.limiter, this.axiosInstance)
      const collectionData = await collectionDetails(collectionSymbol, this.apiKey, this.limiter, this.axiosInstance)
      let RESTART = true
      if (RESTART) {
        const offerData = await getUserOffers(buyerTokenReceiveAddress, this.apiKey, this.limiter, this.axiosInstance)
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
                lastSeenActivity: null,
                quantity: 0
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
      }

      let tokens = await retrieveTokens(collectionSymbol, bidCount, this.apiKey, this.limiter, this.axiosInstance)
      tokens = tokens.slice(0, bidCount)

      const bottomTokens = tokens
        .sort((a, b) => a.listedPrice - b.listedPrice)
        .map((item) => ({ id: item.id, price: item.listedPrice }))

      const uniqueIds = new Set();
      const uniqueBottomListings: BottomListing[] = [];

      bottomTokens.forEach(listing => {
        if (!uniqueIds.has(listing.id)) {
          uniqueIds.add(listing.id);
          uniqueBottomListings.push(listing);
        }
      });

      bidHistory[collectionSymbol].bottomListings = uniqueBottomListings

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

      const ourBids = userBids.map((item) => ({ tokenId: item.tokenId, collectionSymbol: item.collectionSymbol })).filter((item) => item.collectionSymbol === collectionSymbol)
      const collectionBottomBids: CollectionBottomBid[] = tokens.map((item) => ({ tokenId: item.id, collectionSymbol: item.collectionSymbol })).filter((item) => item.collectionSymbol === collectionSymbol)
      const tokensToCancel = findTokensToCancel(collectionBottomBids, ourBids)
      const bottomListingBids = combineBidsAndListings(userBids, bottomListings)
      console.log('--------------------------------------------------------------------------------');
      console.log(`BOTTOM LISTING BIDS FOR ${collectionSymbol}`);
      console.table(bottomListingBids)
      console.log('--------------------------------------------------------------------------------');


      console.log('--------------------------------------------------------------------------------');
      console.log(`TOKENS TO CANCEL ${collectionSymbol}`);
      console.table(tokensToCancel)
      console.log('--------------------------------------------------------------------------------');

      const queue = new PQueue({
        concurrency: 1.5 * this.rateLimit
      });

      if (tokensToCancel.length > 0) {
        await queue.addAll(
          tokensToCancel.map(token => async () => {
            const offerData = await getOffers(token.tokenId, this.apiKey, this.limiter, this.axiosInstance, buyerTokenReceiveAddress)
            if (offerData && Number(offerData.total) > 0) {
              const offers = offerData?.offers.filter((item) => item.buyerPaymentAddress === buyerPaymentAddress)
              offers.forEach(async (item) => {
                await cancelBid(
                  item,
                  privateKey,
                  collectionSymbol,
                  item.tokenId,
                  buyerPaymentAddress,
                  this.apiKey,
                  this.limiter,
                  this.axiosInstance
                );
                delete bidHistory[collectionSymbol].ourBids[token.tokenId]
                delete bidHistory[collectionSymbol].topBids[token.tokenId]
              })
            }
          })
        )
      }

      userBids.forEach((bid) => {
        const givenTimestamp = new Date(bid.expiration);
        const bidExpiration = new Date();
        bidExpiration.setMinutes(bidExpiration.getMinutes() + duration);

        if (givenTimestamp.getTime() >= bidExpiration.getTime()) {
          console.log('REMOVE EXPIRED BIDS');
          delete bidHistory[collectionSymbol].ourBids[bid.tokenId]
          delete bidHistory[collectionSymbol].topBids[bid.tokenId]
        }
      })

      const uniqueIdStore: any = {};
      const uniqueListings = bottomListings.filter(listing => {
        if (!uniqueIdStore[listing.id]) {
          uniqueIdStore[listing.id] = true;
          return true;
        }
        return false;
      });

      if (offerType.toUpperCase() === "ITEM") {
        await queue.addAll(
          uniqueListings.sort((a, b) => a.price - b.price)
            .slice(0, bidCount)
            .map(token => async () => {
              const { id: tokenId, price: listedPrice } = token

              const bestOffer = await getBestOffer(tokenId, this.apiKey, this.limiter, this.axiosInstance);
              const ourExistingOffer = bidHistory[collectionSymbol].ourBids[tokenId]?.expiration > Date.now()

              const currentExpiry = bidHistory[collectionSymbol]?.ourBids[tokenId]?.expiration
              const newExpiry = duration * 60 * 1000
              const offerData = await getOffers(tokenId, this.apiKey, this.limiter, this.axiosInstance, buyerTokenReceiveAddress)
              const offer = offerData?.offers.filter((item) => item.buyerPaymentAddress === buyerPaymentAddress)

              if (currentExpiry - Date.now() > newExpiry) {
                if (offer) {
                  offer.forEach(async (item) => {
                    await cancelBid(
                      item,
                      privateKey,
                      collectionSymbol,
                      tokenId,
                      buyerPaymentAddress,
                      this.apiKey,
                      this.limiter,
                      this.axiosInstance
                    );
                    delete bidHistory[collectionSymbol].ourBids[tokenId]
                    delete bidHistory[collectionSymbol].topBids[tokenId]
                  })
                }
              }


              /*
              * This condition executes in a scenario where we're not currently bidding on a token,
              * and our total bids for that collection are less than the desired bid count.
              *
              * If there's an existing offer on that token:
              *   - It first checks to ensure that we're not the owner of the existing offer.
              *   - If we're not the owner, it proceeds to outbid the existing offer.
              *
              * If there's no existing offer on the token:
              *   - We place a minimum bid on the token.
              */

              // expire bid if configuration has changed and we are not trying to outbid
              if (!ourExistingOffer) {

                if (bestOffer && Number(bestOffer.total) > 0) {
                  const topOffer = bestOffer.offers[0]
                  /*
                   * This condition executes where we don't have an existing offer on a token
                   * And there's a current offer on that token
                   * we outbid the current offer on the token if the calculated bid price is less than our max bid amount
                  */
                  if (topOffer?.buyerPaymentAddress !== buyerPaymentAddress) {
                    const currentPrice = topOffer.price
                    const bidPrice = currentPrice + (outBidMargin * CONVERSION_RATE)
                    if (bidPrice <= maxOffer) {


                      if (RESTART || !enableCounterBidding) {
                        console.log('-----------------------------------------------------------------------------------------------------------------------------');
                        console.log(`OUTBID CURRENT OFFER ${currentPrice} OUR OFFER ${bidPrice} FOR ${collectionSymbol} ${tokenId}`);
                        console.log('-----------------------------------------------------------------------------------------------------------------------------');
                        try {
                          const status = await placeBid(tokenId, bidPrice, expiration, buyerTokenReceiveAddress, buyerPaymentAddress, publicKey, privateKey, collectionSymbol, this.apiKey, this.limiter, this.axiosInstance)
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
                      }

                    } else {
                      console.log('-----------------------------------------------------------------------------------------------------------------------------');
                      console.log(`CALCULATED BID PRICE ${bidPrice} IS GREATER THAN MAX BID ${maxOffer} FOR ${collectionSymbol} ${tokenId}`);
                      console.log('-----------------------------------------------------------------------------------------------------------------------------');
                    }
                  }
                }
                /*
                 * This condition executes where we don't have an existing offer on a token
                 * and there is no active offer on that token
                 * we bid the minimum on that token
                */
                else {
                  const bidPrice = Math.max(listedPrice * 0.5, minOffer)
                  if (bidPrice <= maxOffer) {
                    try {
                      const status = await placeBid(tokenId, bidPrice, expiration, buyerTokenReceiveAddress, buyerPaymentAddress, publicKey, privateKey, collectionSymbol, this.apiKey, this.limiter, this.axiosInstance)
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
                  }
                }
              }

              /**
               * This block of code handles situations where there exists an offer on the token:
               * It first checks if there's any offer on the token
               * If an offer is present, it determines whether we have the highest offer
               * If we don't have highest offer, it attempts to outbid the current highest offer
               * In case of being the highest offer, it tries to adjust the bid downwards if the difference between our offer and the second best offer exceeds the outbid margin.
               * If our offer stands alone, it ensures that our offer remains at the minimum possible value
               */
              else if (ourExistingOffer) {
                if (bestOffer && Number(bestOffer.total) > 0) {
                  const [topOffer, secondTopOffer] = bestOffer.offers
                  const bestPrice = topOffer.price

                  if (topOffer.buyerPaymentAddress !== buyerPaymentAddress) {
                    const currentPrice = topOffer.price
                    const bidPrice = currentPrice + (outBidMargin * CONVERSION_RATE)

                    if (bidPrice <= maxOffer) {

                      if (RESTART || !enableCounterBidding) {
                        console.log('-----------------------------------------------------------------------------------------------------------------------------');
                        console.log(`OUTBID CURRENT OFFER ${currentPrice} OUR OFFER ${bidPrice} FOR ${collectionSymbol} ${tokenId}`);
                        console.log('-----------------------------------------------------------------------------------------------------------------------------');
                        try {
                          const status = await placeBid(tokenId, bidPrice, expiration, buyerTokenReceiveAddress, buyerPaymentAddress, publicKey, privateKey, collectionSymbol, this.apiKey, this.limiter, this.axiosInstance)
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
                      }
                    } else {
                      console.log('-----------------------------------------------------------------------------------------------------------------------------');
                      console.log(`CALCULATED BID PRICE ${bidPrice} IS GREATER THAN MAX BID ${maxOffer} FOR ${collectionSymbol} ${tokenId}`);
                      console.log('-----------------------------------------------------------------------------------------------------------------------------');

                    }

                  } else {
                    if (secondTopOffer) {
                      const secondBestPrice = secondTopOffer.price
                      const outBidAmount = outBidMargin * CONVERSION_RATE
                      if (bestPrice - secondBestPrice > outBidAmount) {
                        const bidPrice = secondBestPrice + outBidAmount

                        if (bidPrice <= maxOffer) {
                          console.log('-----------------------------------------------------------------------------------------------------------------------------');
                          console.log(`ADJUST OUR CURRENT OFFER ${bestPrice} TO ${bidPrice} FOR ${collectionSymbol} ${tokenId}`);
                          console.log('-----------------------------------------------------------------------------------------------------------------------------');

                          try {
                            const status = await placeBid(tokenId, bidPrice, expiration, buyerTokenReceiveAddress, buyerPaymentAddress, publicKey, privateKey, collectionSymbol, this.apiKey, this.limiter, this.axiosInstance)
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
                        }
                      }
                    } else {
                      const bidPrice = Math.max(minOffer, listedPrice * 0.5)
                      if (bestPrice !== bidPrice) { // self adjust bids.
                        console.log('-----------------------------------------------------------------------------------------------------------------------------');
                        console.log(`ADJUST OUR CURRENT OFFER ${bestPrice} TO ${bidPrice} FOR ${collectionSymbol} ${tokenId}`);
                        console.log('-----------------------------------------------------------------------------------------------------------------------------');

                        if (bidPrice <= maxOffer) {
                          try {
                            const status = await placeBid(tokenId, bidPrice, expiration, buyerTokenReceiveAddress, buyerPaymentAddress, publicKey, privateKey, collectionSymbol, this.apiKey, this.limiter, this.axiosInstance)
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
                        }

                      } else if (bidPrice > maxOffer) {
                        console.log('\x1b[31m%s\x1b[0m', '🛑 CURRENT PRICE IS GREATER THAN MAX OFFER!!! 🛑');
                      }
                    }
                  }
                }
              }
            })
        )

      } else if (offerType.toUpperCase() === "COLLECTION") {
        const bestOffer = await getBestCollectionOffer(collectionSymbol, this.apiKey, this.limiter, this.axiosInstance)
        if (bestOffer && bestOffer.offers.length > 0) {

          const [topOffer, secondTopOffer] = bestOffer.offers
          const bestPrice = topOffer.price.amount

          bidHistory[collectionSymbol].highestCollectionOffer = {
            price: bestPrice,
            buyerPaymentAddress: topOffer.btcParams.makerPaymentAddress
          };

          const ourOffer = bestOffer.offers.find((item) => item.btcParams.makerPaymentAddress.toLowerCase() === buyerPaymentAddress.toLowerCase()) as ICollectionOffer

          if (topOffer.btcParams.makerPaymentAddress !== buyerPaymentAddress) {
            try {
              if (ourOffer) {
                const offerIds = [ourOffer.id]
                await cancelCollectionOffer(offerIds, publicKey, privateKey, this.apiKey, this.limiter, this.axiosInstance)
              }
            } catch (error) {
              console.log(error);
            }

            const currentPrice = topOffer.price.amount
            const bidPrice = currentPrice + (outBidMargin * CONVERSION_RATE)
            if (bidPrice <= maxOffer) {
              console.log('-----------------------------------------------------------------------------------------------------------------------------');
              console.log(`OUTBID CURRENT COLLECTION OFFER ${currentPrice} OUR OFFER ${bidPrice} FOR ${collectionSymbol}`);
              console.log('-----------------------------------------------------------------------------------------------------------------------------');

              try {
                if (bidPrice < floorPrice) {
                  await placeCollectionBid(bidPrice, expiration, collectionSymbol, buyerTokenReceiveAddress, publicKey, privateKey, feeSatsPerVbyte, this.apiKey, this.limiter, this.axiosInstance)
                  bidHistory[collectionSymbol].offerType = "COLLECTION"

                  bidHistory[collectionSymbol].highestCollectionOffer = {
                    price: bidPrice,
                    buyerPaymentAddress: buyerPaymentAddress
                  }
                }

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
                    await cancelCollectionOffer(offerIds, publicKey, privateKey, this.apiKey, this.limiter, this.axiosInstance)
                  }

                } catch (error) {
                  console.log(error);
                }

                if (bidPrice <= maxOffer) {
                  console.log('-----------------------------------------------------------------------------------------------------------------------------');
                  console.log(`ADJUST OUR CURRENT COLLECTION OFFER ${bestPrice} TO ${bidPrice} FOR ${collectionSymbol}`);
                  console.log('-----------------------------------------------------------------------------------------------------------------------------');
                  try {

                    if (bidPrice < floorPrice) {
                      await placeCollectionBid(bidPrice, expiration, collectionSymbol, buyerTokenReceiveAddress, publicKey, privateKey, feeSatsPerVbyte, this.apiKey, this.limiter, this.axiosInstance)
                      bidHistory[collectionSymbol].offerType = "COLLECTION"
                      bidHistory[collectionSymbol].highestCollectionOffer = {
                        price: bidPrice,
                        buyerPaymentAddress: buyerPaymentAddress
                      }
                    }
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
                    await cancelCollectionOffer(offerIds, publicKey, privateKey, this.apiKey, this.limiter, this.axiosInstance)
                  }
                } catch (error) {
                  console.log(error);
                }

                console.log('-----------------------------------------------------------------------------------------------------------------------------');
                console.log(`ADJUST OUR CURRENT COLLECTION OFFER ${bestPrice} TO ${bidPrice} FOR ${collectionSymbol} `);
                console.log('-----------------------------------------------------------------------------------------------------------------------------');

                if (bidPrice <= maxOffer) {

                  try {

                    if (bidPrice < floorPrice) {
                      await placeCollectionBid(bidPrice, expiration, collectionSymbol, buyerTokenReceiveAddress, publicKey, privateKey, feeSatsPerVbyte, this.apiKey, this.limiter, this.axiosInstance)
                      bidHistory[collectionSymbol].offerType = "COLLECTION"
                      bidHistory[collectionSymbol].highestCollectionOffer = {
                        price: bidPrice,
                        buyerPaymentAddress: buyerPaymentAddress
                      }
                    }
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
          if (bidPrice <= maxOffer) {
            if (bidPrice < floorPrice) {
              await placeCollectionBid(bidPrice, expiration, collectionSymbol, buyerTokenReceiveAddress, publicKey, privateKey, feeSatsPerVbyte, this.apiKey, this.limiter, this.axiosInstance)
              bidHistory[collectionSymbol].offerType = "COLLECTION"

              bidHistory[collectionSymbol].highestCollectionOffer = {
                price: bidPrice,
                buyerPaymentAddress: buyerPaymentAddress
              }
            }
          }
        }
      }

      RESTART = false
    } catch (error) {
      throw error
    }
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

function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}


async function placeCollectionBid(
  offerPrice: number,
  expiration: number,
  collectionSymbol: string,
  buyerTokenReceiveAddress: string,
  publicKey: string,
  privateKey: string,
  feeSatsPerVbyte: number = 28,
  apiKey: string,
  limiter: Bottleneck,
  axiosInstance: AxiosInstance
) {
  const priceSats = Math.ceil(offerPrice)
  const expirationAt = new Date(expiration).toISOString();

  const unsignedCollectionOffer = await createCollectionOffer(collectionSymbol, priceSats, expirationAt, feeSatsPerVbyte, publicKey, buyerTokenReceiveAddress, apiKey, limiter, axiosInstance)
  if (unsignedCollectionOffer) {
    const { signedOfferPSBTBase64, signedCancelledPSBTBase64 } = signCollectionOffer(unsignedCollectionOffer, privateKey)
    await submitCollectionOffer(signedOfferPSBTBase64, signedCancelledPSBTBase64, collectionSymbol, priceSats, expirationAt, publicKey, buyerTokenReceiveAddress, apiKey, limiter, axiosInstance)
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
  apiKey: string,
  limiter: Bottleneck,
  axiosInstance: AxiosInstance
) {
  try {
    const price = Math.round(offerPrice)
    const unsignedOffer = await createOffer(tokenId, price, expiration, buyerTokenReceiveAddress, buyerPaymentAddress, publicKey, FEE_RATE_TIER, apiKey, limiter, axiosInstance)
    const signedOffer = await signData(unsignedOffer, privateKey)
    if (signedOffer) {
      await submitSignedOfferOrder(signedOffer, tokenId, offerPrice, expiration, buyerPaymentAddress, buyerTokenReceiveAddress, publicKey, FEE_RATE_TIER, privateKey, apiKey, limiter, axiosInstance)
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


function isValidJSON(str: string) {
  try {
    JSON.parse(str);
    return true;
  } catch (e) {
    return false;
  }
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
    highestCollectionOffer?: {
      price: number;
      buyerPaymentAddress: string;
    };
    quantity: number;
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
  collections: CollectionData[];
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

export interface CollectOfferActivity {
  createdAt: string;
  kind: string;
  tokenId: string;
  listedPrice: string | number;
  sellerPaymentReceiverAddress: string;
  tokenInscriptionNumber: string;
  tokenSatRarity: string;
  tokenSatBlockHeight: number;
  tokenSatBlockTime: string;
  collectionSymbol: string;
  chain: string;
  newOwner: string;
  brc20TransferAmt: null; // Change this to the appropriate type if not always null
  brc20ListedUnitPrice: null; // Change this to the appropriate type if not always null
  btcUsdPrice: number;
  oldLocation: string;
  oldOwner: string;
  buyerPaymentAddress: string;
  listedMakerFeeBp: number;
  listedTakerFeeBp: number;
  reasonForActivity: string;
}

export interface CollectionData {
  collectionSymbol: string;
  minBid: number;
  maxBid: number;
  minFloorBid: number;
  maxFloorBid: number;
  outBidMargin: number;
  bidCount: number;
  duration: number;
  running: boolean;
  offerType: 'ITEM' | 'COLLECTION';
  quantity: number;
  fundingWalletWIF: string;
  tokenReceiveAddress: string;
  scheduledLoop: number;
  feeSatsPerVbyte: number
  enableCounterBidding: boolean;
}
