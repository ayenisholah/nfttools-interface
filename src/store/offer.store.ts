import { IOffer } from '@/services/offers';
import { toast } from 'react-toastify';
import { create } from 'zustand';

interface OfferStateStore {
  cancelAll: (offers: string[], fundingWalletWIF: string, apiKey: string, rateLimit: number, collection: string, tokenReceiveAddress: string, offerType: "ITEM" | "COLLECTION") => Promise<void>;
  cancel: (offer: IOffer, fundingWalletWIF: string, apiKey: string, rateLimit: number, collection: string, tokenReceiveAddress: string, offerType: "ITEM" | "COLLECTION") => Promise<void>;
}

export const useOfferStateStore = create<OfferStateStore>()(() => ({
  cancelAll: async (offers, fundingWalletWIF, apiKey, rateLimit, collection, tokenReceiveAddress, offerType) => {

    if (offers.length > 0) {
      await fetch("/api/offers", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          requestType: "cancelAll",
          data: { offers, fundingWalletWIF, apiKey, collection, tokenReceiveAddress, offerType, rateLimit },
        }),
      });
      toast.success(`successfully submitted cancel orders for ${collection}`);
    }
  },
  cancel: async (offer, fundingWalletWIF, apiKey, rateLimit, collection, tokenReceiveAddress, offerType) => {
    console.log(`Canceling offer: ${offer.id}`);

    if (offer) {
      await fetch("/api/offers", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          requestType: "cancel",
          data: { offer, fundingWalletWIF, apiKey, rateLimit, collection, tokenReceiveAddress, offerType },
        }),
      });
      toast.success(`successfully submitted cancel orders for ${offer.token.collectionSymbol}  ${offer.tokenId.slice(-8)}`);
    }
  },
}));