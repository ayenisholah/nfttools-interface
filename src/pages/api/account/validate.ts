import type { NextApiRequest, NextApiResponse } from 'next';
import * as bitcoin from 'bitcoinjs-lib';
import { ECPairFactory, ECPairAPI, TinySecp256k1Interface } from 'ecpair';

const tinysecp: TinySecp256k1Interface = require('tiny-secp256k1');
const ECPair: ECPairAPI = ECPairFactory(tinysecp);
const network = bitcoin.networks.bitcoin;


export default function handler(req: NextApiRequest, res: NextApiResponse) {
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
  } else {
    res.status(405).json({ message: 'Method not allowed' });
  }
}

interface RequestBody {
  privateKey: string;
};
