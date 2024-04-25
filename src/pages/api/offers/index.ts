import { getUserOffers } from "@/services/offers";
import { NextApiRequest, NextApiResponse } from "next";


export default async function handler(req: NextApiRequest, res: NextApiResponse) {

  try {
    if (req.method === 'GET') {
      const { requestType } = req.query

      if (requestType === "getCollectionOffers") {
        const { tokenReceiveAddress, collectionSymbol, apiKey } = req.query as unknown as FetchOffersQuery

        const offerData = await getUserOffers(tokenReceiveAddress, apiKey)
        const offers = offerData?.offers.filter((item) => item.token.collectionSymbol)

        res.status(200).json(offers)
      }
    }

  } catch (error) {
    res.status(500).json({ error: "something went  wrong!!!" })
  }
}

interface FetchOffersQuery {
  requestType: string;
  tokenReceiveAddress: string;
  collectionSymbol: string;
  apiKey: string;
}