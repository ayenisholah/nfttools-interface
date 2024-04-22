import axiosInstance, { limiter } from "@/axios";


let apiKey: string = '';
if (typeof window !== "undefined") {
  let settings: any = localStorage.getItem("settings");

  if (settings) {
    settings = JSON.parse(settings);
    apiKey = settings?.state?.apiKey
  }
}

const headers = {
  'Content-Type': 'application/json',
  'X-NFT-API-Key': apiKey,
}

export async function validateCollection(collectionSymbol: string) {
  try {
    const url = `https://nfttools.pro/magiceden/v2/ord/btc/stat?collectionSymbol=${collectionSymbol}`
    const { data } = await limiter.schedule(() => axiosInstance.get<CollectionData>(url, { headers }));

    return data

  } catch (error: any) {
    console.log('collectionDetailsError: ', error.response);
  }
}

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