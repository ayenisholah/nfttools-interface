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
