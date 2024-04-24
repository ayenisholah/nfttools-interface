import axios from "axios";

export async function getBitcoinBalance(address: string): Promise<number> {
  try {
    const response = await axios
      .get('https://nfttools.pro', {
        headers: {
          'url': `https://blockchain.info/q/addressbalance/${address}`,
          'x-nft-api-key': 'a4eae399-f135-4627-829a-18435bb631ae'
        }
      })

    const balance = response.data;
    console.log('--------------------------------------------------------------------------------');
    console.log("BALANCE: ", balance);
    console.log('--------------------------------------------------------------------------------');

    return balance;
  } catch (error: any) {
    console.error('getBitcoinBalance:', error?.response);
    throw error;
  }
}