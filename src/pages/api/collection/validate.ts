import type { NextApiRequest, NextApiResponse } from 'next';
import axiosInstance, { limiter } from '@/axios';


export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'POST') {
    const { collectionSymbol, apiKey } = req.body as RequestBody;
    const headers = {
      'Content-Type': 'application/json',
      'X-NFT-API-Key': apiKey,
    }
    const url = `https://nfttools.pro/magiceden/v2/ord/btc/stat?collectionSymbol=${collectionSymbol}`
    const { data: collection } = await limiter.schedule(() => axiosInstance.get<CollectionData>(url, { headers }));
    res.status(200).json(collection);
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