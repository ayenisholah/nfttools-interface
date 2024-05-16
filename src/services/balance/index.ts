import axios, { AxiosInstance } from "axios";
import Bottleneck from "bottleneck";

export async function getBitcoinBalance(address: string, apiKey: string, limiter: Bottleneck, axiosInstance: AxiosInstance): Promise<number> {
  try {
    const response = await limiter.schedule(() => axiosInstance
      .get('https://nfttools.pro', {
        headers: {
          'url': `https://blockchain.info/q/addressbalance/${address}`,
          'x-nft-api-key': apiKey
        }
      }))

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