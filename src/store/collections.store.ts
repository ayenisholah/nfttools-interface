import { create } from 'zustand';
import { persist, PersistOptions } from 'zustand/middleware';

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
  addCollection: (collection: CollectionData) => void;
  removeCollection: (index: number) => void;
}

const persistOptions: PersistOptions<CollectionsState> = {
  name: 'collections',
};

export const useCollectionsState = create<CollectionsState>()(
  persist(
    (set, get) => ({
      collections: [],
      addCollection: (collection) =>
        set((state) => ({
          collections: [...state.collections, collection],
        })),

      removeCollection: (index) =>
        set((state) => ({
          collections: state.collections.filter((_, i) => i !== index),
        })),
    }),
    persistOptions
  )
);