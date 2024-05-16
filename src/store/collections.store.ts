import { create } from 'zustand';
import { persist, PersistOptions } from 'zustand/middleware';
import { useSettingsState } from './settings.store';
import { BidState, useBidStateStore } from './bid.store';
import { IOffer } from '@/services/offers';
import { useOfferStateStore } from './offer.store';
import { toast } from 'react-toastify';

export interface CollectionData {
  collectionSymbol: string;
  minBid: number;
  maxBid: number;
  minFloorBid: number;
  quantity: number;
  maxFloorBid: number;
  outBidMargin: number;
  bidCount: number;
  duration: number;
  enableCounterbidding: boolean;
  offerType: "ITEM" | "COLLECTION";
  fundingWalletWIF?: string;
  tokenReceiveAddress?: string;
  scheduledLoop?: number;
  floorPrice?: number;
}


interface CollectionsState {
  collections: CollectionData[];
  addCollection: (collection: CollectionData) => boolean;
  removeCollection: (index: number) => Promise<void>;
  editCollection: (index: number, updatedCollection: CollectionData) => void;
}

const persistOptions: PersistOptions<CollectionsState> = {
  name: 'collections',
};

export const useCollectionsState = create<CollectionsState>()(
  persist(
    (set, get) => ({
      collections: [],
      addCollection: (collection) => {
        const { collections } = get();
        const existingCollection = collections.find(
          (c) => c.collectionSymbol === collection.collectionSymbol
        );
        if (existingCollection) {
          return false;
        }
        set((state) => ({
          collections: [...state.collections, collection],
        }));

        const { defaultLoopTime, fundingWif, tokenReceiveAddress } = useSettingsState.getState();
        const newBidState: BidState = {
          ...collection,
          fundingWalletWIF: collection.fundingWalletWIF || fundingWif,
          tokenReceiveAddress: collection.tokenReceiveAddress || tokenReceiveAddress,
          scheduledLoop: collection.scheduledLoop || defaultLoopTime,
          running: false,
        };
        useBidStateStore.getState().setBidStates([...useBidStateStore.getState().bidStates, newBidState]);

        return true;
      },
      removeCollection: async (index) => {
        set((state) => ({
          collections: state.collections.filter((_, i) => i !== index),
        }));

        useBidStateStore.getState().setBidStates(
          useBidStateStore.getState().bidStates.filter((_, i) => i !== index)
        );
        const { collections } = get()
        const collection = collections.find((_, i) => i === index)

        const collectionSymbol = collection?.collectionSymbol as string

        const { fundingWif, tokenReceiveAddress, apiKey, rateLimit } = useSettingsState.getState();

        const { cancelAll } = useOfferStateStore.getState()

        const wif = collection?.fundingWalletWIF || fundingWif

        const receiveAddress = collection?.tokenReceiveAddress || tokenReceiveAddress

        if (collection) {
          const offerType = collection.offerType

          try {
            const url = `/api/offers?requestType=getCollectionOffers&tokenReceiveAddress=${receiveAddress}&collectionSymbol=${collectionSymbol}&apiKey=${apiKey}&rateLimit=${rateLimit}`;
            const response = await fetch(url.toString(), {
              method: "GET",
              headers: {
                "Content-Type": "application/json",
              },
            });
            if (!response.ok) {
              throw new Error("Failed to fetch data");
            }
            const responseData: IOffer[] = await response.json();

            const offers = responseData
              .filter((item) => item.token.collectionSymbol === collectionSymbol)
            const offerIds = offers.map((item) => item.id)

            await cancelAll(offerIds, wif, apiKey, rateLimit, collectionSymbol, receiveAddress, offerType)
            toast.success("successfully removed collection and delete all offers")

          } catch (error) {
            console.log(error);
          }

        }
      },
      editCollection: (index, updatedCollection) =>
        set((state) => ({
          collections: state.collections.map((collection, i) =>
            i === index ? updatedCollection : collection
          ),
        })),
    }),
    persistOptions
  )
);