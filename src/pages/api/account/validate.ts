import type { NextApiRequest, NextApiResponse } from 'next';
import * as bitcoin from 'bitcoinjs-lib';
import { ECPairFactory, ECPairAPI } from 'ecpair';
import tinysecp from '@bitcoinerlab/secp256k1'

const ECPair: ECPairAPI = ECPairFactory(tinysecp);
const network = bitcoin.networks.bitcoin;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {

  try {
    if (req.method === 'POST') {
      const { privateKey } = req.body as RequestBody;

      if (!privateKey) {
        res.status(400).json({ message: 'Missing privateKey parameter' });
        return;
      }

      const keyPair = ECPair.fromWIF(privateKey, network);
      const address = bitcoin.payments.p2wpkh({ pubkey: keyPair.publicKey, network: network }).address as string;
      const isBitcoin = !!bitcoin.address.toOutputScript(address, network);
      const wallet = { address, privateKey, isBitcoin };

      res.status(200).json(wallet);
    } else if (req.method === "GET") {
      const { address } = req.query as unknown as RequestQuery
      const valid = isOrdinalAddress(address)
      console.log({ address, valid });

      res.status(200).json(valid)
    }

  } catch (error) {
    res.status(500).json({ message: 'Server not allowed' });
  }
}

interface RequestBody {
  privateKey: string;
};

interface RequestQuery {
  address: string
}


function isOrdinalAddress(address: string) {
  try {
    const decodedAddress = bitcoin.address.fromBech32(address);

    if (decodedAddress.data.length === 32) {
      return true;
    } else if (decodedAddress.data.length === 20) {
      return false;
    }
  } catch (error) {
    return false;
  }
  return false;
}