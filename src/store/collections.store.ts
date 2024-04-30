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
  maxFloorBid: number;
  outBidMargin: number;
  bidCount: number;
  duration: number;
  fundingWalletWIF?: string;
  tokenReceiveAddress?: string;
  scheduledLoop?: number;
  counterbidLoop?: number;
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

        const { defaultLoopTime, defaultCounterLoopTime, fundingWif, tokenReceiveAddress } = useSettingsState.getState();
        const newBidState: BidState = {
          ...collection,
          fundingWalletWIF: collection.fundingWalletWIF || fundingWif,
          tokenReceiveAddress: collection.tokenReceiveAddress || tokenReceiveAddress,
          scheduledLoop: collection.scheduledLoop || defaultLoopTime,
          counterbidLoop: collection.counterbidLoop || defaultCounterLoopTime,
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

        const { fundingWif, tokenReceiveAddress, apiKey } = useSettingsState.getState();

        const { cancelAll } = useOfferStateStore.getState()

        const wif = collection?.fundingWalletWIF || fundingWif

        const receiveAddress = collection?.tokenReceiveAddress || tokenReceiveAddress


        try {
          const url = `/api/offers?requestType=getCollectionOffers&tokenReceiveAddress=${receiveAddress}&collectionSymbol=${collectionSymbol}&apiKey=${apiKey}`;
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

          await cancelAll(offerIds, wif, apiKey, collectionSymbol)
          toast.success("successfully removed collection and delete all offers")

        } catch (error) {
          console.log(error);
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