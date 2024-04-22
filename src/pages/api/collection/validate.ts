import type { NextApiRequest, NextApiResponse } from 'next';
import * as bitcoin from 'bitcoinjs-lib';
import { ECPairFactory, ECPairAPI, TinySecp256k1Interface } from 'ecpair';
import axiosInstance, { limiter } from '@/axios';

const tinysecp: TinySecp256k1Interface = require('tiny-secp256k1');
const ECPair: ECPairAPI = ECPairFactory(tinysecp);
const network = bitcoin.networks.bitcoin;


export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'POST') {
    const { collectionSymbol, apiKey } = req.body as RequestBody;

    console.log({ collectionSymbol, apiKey });

    const headers = {
      'Content-Type': 'application/json',
      'X-NFT-API-Key': apiKey,
    }
    const url = `https://nfttools.pro/magiceden/v2/ord/btc/stat?collectionSymbol=${collectionSymbol}`

    const { data: collection } = await limiter.schedule(() => axiosInstance.get<CollectionData>(url, { headers }));

    res.status(200).json(collection);
  } else {
    res.status(405).json({ message: 'Method not allowed' });
  }
}

interface RequestBody {
  collectionSymbol: string;
  apiKey: string;
};

interface CollectionData {
  totalVolume: string;
  owners: string;
  supply: string;
  floorPrice: string;
  totalListed: string;
  pendingTransactions: string;
  inscriptionNumberMin: string;
  inscriptionNumberMax: string;
  symbol: string;
}