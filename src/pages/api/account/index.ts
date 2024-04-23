import { NextApiRequest, NextApiResponse } from 'next';
import * as bitcoin from 'bitcoinjs-lib';
import { ECPairFactory, ECPairAPI, TinySecp256k1Interface } from 'ecpair';
import { Wallet } from '@/interface/account.interface';

const tinysecp: TinySecp256k1Interface = require('tiny-secp256k1');
const ECPair: ECPairAPI = ECPairFactory(tinysecp);
const network = bitcoin.networks.bitcoin;


function createP2PKHwallet(): Wallet {
  const keyPair = ECPair.makeRandom({ network: network });
  const privateKey = keyPair.toWIF();
  const address = bitcoin.payments.p2wpkh({ pubkey: keyPair.publicKey, network: network }).address as string;
  const wallet = { address, privateKey };
  const isBitcoin = !!bitcoin.address.toOutputScript(address, network);
  return wallet;
}

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === "GET") {
    const wallet = createP2PKHwallet();
    res.status(200).json(wallet);
  } else {
    res.status(405).json({ error: 'Method not allowed. Only POST requests are accepted.' });
  }
}