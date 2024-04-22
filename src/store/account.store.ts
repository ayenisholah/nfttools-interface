import { create } from 'zustand';
import { persist, PersistOptions } from 'zustand/middleware';
import { toast } from 'react-toastify';

interface Wallet {
  privateKey: string;
  address: string;
  label: string;
}

interface SettingsState {
  wallets: Wallet[];
  addWallet: (privateKey: string, address: string) => void;
  removeWallet: (index: number) => void;
}

const persistOptions: PersistOptions<SettingsState> = {
  name: 'accounts',
};

export const useAccountState = create<SettingsState>()(
  persist(
    (set, get) => ({
      wallets: [],
      addWallet: (privateKey, address) => {
        const { wallets } = get();
        const existingWallet = wallets.find(
          (wallet) => wallet.privateKey === privateKey
        );
        if (existingWallet) {
          toast.warning('Wallet with the same private key already exists');
        } else {
          set((state) => {
            const newWallet: Wallet = {
              privateKey,
              address,
              label: `Account ${state.wallets.length + 1}`,
            };
            return {
              ...state,
              wallets: [...state.wallets, newWallet],
            };
          });
          toast.success('Wallet created successfully!');
        }
      },
      removeWallet: (index) => {
        set((state) => {
          const updatedWallets = [...state.wallets];
          updatedWallets.splice(index, 1);
          return {
            ...state,
            wallets: updatedWallets,
          };
        });
      },
    }),
    persistOptions
  )
);