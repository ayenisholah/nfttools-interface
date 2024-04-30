import { IOffer } from '@/services/offers';
import { toast } from 'react-toastify';
import { create } from 'zustand';

interface OfferStateStore {
  cancelAll: (offers: string[], fundingWalletWIF: string, apiKey: string, collection: string) => Promise<void>;
  cancel: (offer: IOffer, fundingWalletWIF: string, apiKey: string) => Promise<void>;
}

export const useOfferStateStore = create<OfferStateStore>()(() => ({
  cancelAll: async (offers, fundingWalletWIF, apiKey, collection) => {

    if (offers.length > 0) {
      await fetch("/api/offers", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          requestType: "cancelAll",
          data: { offers, fundingWalletWIF, apiKey, collection },
        }),
      });
      toast.success(`successfully submitted cancel orders for ${collection}`);
    }
  },
  cancel: async (offer, fundingWalletWIF, apiKey) => {
    console.log(`Canceling offer: ${offer.id}`);

    if (offer) {
      await fetch("/api/offers", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          requestType: "cancel",
          data: { offer, fundingWalletWIF, apiKey },
        }),
      });
      toast.success(`successfully submitted cancel orders for ${offer.token.collectionSymbol}  ${offer.tokenId.slice(-8)}`);
    }
  },
}));