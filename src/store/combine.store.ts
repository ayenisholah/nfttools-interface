import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

interface CollectionData {
  collectionSymbol: string;
  minBid: number;
  maxBid: number;
  minFloorBid: number;
  maxFloorBid: number;
  outBidMargin: number;
  bidCount: number;
  duration?: number;
  fundingWalletWIF?: string;
  tokenReceiveAddress?: string;
  scheduledLoop?: number;
  counterbidLoop?: number;
}

interface BidState extends CollectionData {
  fundingWalletWIF: string;
  tokenReceiveAddress: string;
  duration: number;
  scheduledLoop: number;
  counterbidLoop: number;
  running: boolean;
}

interface SettingsState {
  apiKey: string;
  fundingWif: string;
  tokenReceiveAddress: string;
  rateLimit: number;
  bidExpiration: number;
  defaultOutbidMargin: number;
  defaultLoopTime: number;
  defaultCounterLoopTime: number;
  updateSettings: (settings: Partial<SettingsState>) => void;
}

interface CombinedState {
  settings: SettingsState;
  collections: CollectionData[];
  bidStates: BidState[];
  addCollection: (collection: CollectionData) => boolean;
  removeCollection: (index: number) => void;
  editCollection: (index: number, updatedCollection: CollectionData) => void;
  setBidStates: (bidStates: BidState[]) => void;
  startAll: (collectionSymbols: string[]) => void;
  stopAll: (collectionSymbols: string[]) => void;
  startBid: (index: number) => void;
  stopBid: (index: number) => void;
  combinedCollections: (BidState & { apiKey: string; rateLimit: number })[];
}

type StorageValue<T> = T extends object ? Record<string, unknown> : T;
const localStorage = createJSONStorage(() => window.localStorage);
const sessionStorage = createJSONStorage(() => window.sessionStorage);

export const useCombinedState = create<CombinedState>()(
  persist(
    persist(
      persist(
        (set, get) => ({
          settings: {
            apiKey: "",
            fundingWif: "",
            tokenReceiveAddress: "",
            rateLimit: 0,
            bidExpiration: 10,
            defaultOutbidMargin: 0.00000001,
            defaultLoopTime: 600,
            defaultCounterLoopTime: 600,
            updateSettings: (settings) => set((state) => ({ ...state, settings: { ...state.settings, ...settings } })),
          },
          collections: [],
          bidStates: [],
          addCollection: (collection) => {
            const { collections, settings } = get();
            const existingCollection = collections.find(
              (c) => c.collectionSymbol === collection.collectionSymbol
            );
            if (existingCollection) {
              return false;
            }
            set((state) => ({
              collections: [...state.collections, collection],
              bidStates: [
                ...state.bidStates,
                {
                  ...collection,
                  fundingWalletWIF: collection.fundingWalletWIF || settings.fundingWif,
                  tokenReceiveAddress: collection.tokenReceiveAddress || settings.tokenReceiveAddress,
                  duration: collection.duration || settings.bidExpiration,
                  scheduledLoop: collection.scheduledLoop || settings.defaultLoopTime,
                  counterbidLoop: collection.counterbidLoop || settings.defaultCounterLoopTime,
                  running: false,
                },
              ],
            }));
            return true;
          },
          removeCollection: (index) =>
            set((state) => ({
              collections: state.collections.filter((_, i) => i !== index),
              bidStates: state.bidStates.filter((_, i) => i !== index),
            })),
          editCollection: (index, updatedCollection) =>
            set((state) => ({
              collections: state.collections.map((collection, i) => (i === index ? updatedCollection : collection)),
            })),
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
          combinedCollections: [],
        }),
        {
          name: 'settings',
          storage: localStorage,
        }
      ),
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