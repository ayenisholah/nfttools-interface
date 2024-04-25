import { create } from 'zustand';
import { persist, PersistOptions } from 'zustand/middleware';
import { useSettingsState } from './settings.store';
import { BidState, useBidStateStore } from './bid.store';

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
  removeCollection: (index: number) => void;
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
      removeCollection: (index) => {
        set((state) => ({
          collections: state.collections.filter((_, i) => i !== index),
        }));

        useBidStateStore.getState().setBidStates(
          useBidStateStore.getState().bidStates.filter((_, i) => i !== index)
        );
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