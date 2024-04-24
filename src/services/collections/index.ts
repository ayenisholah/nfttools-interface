import axios from "axios";


export async function collectionDetails(collectionSymbol: string, apiKey: string) {

  const headers = {
    'Content-Type': 'application/json',
    'X-NFT-API-Key': apiKey,
  }

  try {
    const url = `https://nfttools.pro/magiceden/v2/ord/btc/stat?collectionSymbol=${collectionSymbol}`
    const { data } = await axios.get<CollectionData>(url, { headers })

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