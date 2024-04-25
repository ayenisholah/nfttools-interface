import { CollectionData, useCollectionsState } from './collections.store';
import { create } from 'zustand';
import { persist, createJSONStorage, PersistOptions } from 'zustand/middleware';
import { useSettingsState } from './settings.store';

export interface BidState extends CollectionData {
  fundingWalletWIF: string;
  tokenReceiveAddress: string;
  scheduledLoop: number;
  counterbidLoop: number;
  running: boolean;
}

interface BidStateStore {
  bidStates: BidState[];
  setBidStates: (bidStates: BidState[]) => void;
  startAll: (collectionSymbols: string[]) => void;
  stopAll: (collectionSymbols: string[]) => void;
  startBid: (index: number) => void;
  stopBid: (index: number) => void;
}

type StorageValue<T> = T extends object ? Record<string, unknown> : T;

const localStorage = createJSONStorage(() => window.localStorage);
const sessionStorage = createJSONStorage(() => window.sessionStorage);

export const useBidStateStore = create<BidStateStore>()(
  persist(
    persist(
      (set, get) => ({
        bidStates: [],
        setBidStates: (bidStates) => set({ bidStates }),
        startAll: (collectionSymbols) => {
          const updatedBidStates = get().bidStates.map((bidState) => {
            if (collectionSymbols.includes(bidState.collectionSymbol)) {
              return { ...bidState, running: true };
            }
            return bidState;
          });
          set({ bidStates: updatedBidStates });
        },
        stopAll: (collectionSymbols) => {
          const updatedBidStates = get().bidStates.map((bidState) => {
            if (collectionSymbols.includes(bidState.collectionSymbol)) {
              return { ...bidState, running: false };
            }
            return bidState;
          });
          set({ bidStates: updatedBidStates });
        },
        startBid: (index) =>
          set((state) => {
            const updatedBidStates = [...state.bidStates];
            updatedBidStates[index] = { ...updatedBidStates[index], running: true };
            return { bidStates: updatedBidStates };
          }),
        stopBid: (index) =>
          set((state) => {
            const updatedBidStates = [...state.bidStates];
            updatedBidStates[index] = { ...updatedBidStates[index], running: false };
            return { bidStates: updatedBidStates };
          }),
      }),
      {
        name: 'bidStateStore',
        storage: localStorage,
        partialize: (state) => {
          const partializedBidStates = state.bidStates.map((bidState) => {
            const { running, ...restOfBidState } = bidState;
            return restOfBidState;
          });
          return { bidStates: partializedBidStates as BidState[] };
        },
      }
    ),
    {
      name: 'bidStateRunning',
      storage: sessionStorage,
      partialize: (state) => {
        const runningStates = state.bidStates.map((bidState) => ({
          collectionSymbol: bidState.collectionSymbol,
          running: bidState.running,
        }));
        return { bidStates: runningStates };
      },
    }
  )
);