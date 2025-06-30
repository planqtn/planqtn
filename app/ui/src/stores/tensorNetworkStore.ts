import { create } from "zustand";
import { TensorNetwork } from "../lib/TensorNetwork";

interface TensorNetworkStore {
  tensorNetwork: TensorNetwork | null;
  setTensorNetwork: (
    networkOrUpdater:
      | TensorNetwork
      | null
      | ((prev: TensorNetwork | null) => TensorNetwork | null)
  ) => void;
  updateTensorNetwork: (
    updater: (prev: TensorNetwork | null) => TensorNetwork | null
  ) => void;
}

export const useTensorNetworkStore = create<TensorNetworkStore>((set) => ({
  tensorNetwork: null,

  setTensorNetwork: (
    networkOrUpdater:
      | TensorNetwork
      | null
      | ((prev: TensorNetwork | null) => TensorNetwork | null)
  ) => {
    console.log("setTensorNetwork", new Error().stack);
    if (typeof networkOrUpdater === "function") {
      set((state) => ({
        tensorNetwork: networkOrUpdater(state.tensorNetwork)
      }));
    } else {
      set({ tensorNetwork: networkOrUpdater });
    }
  },

  updateTensorNetwork: (
    updater: (prev: TensorNetwork | null) => TensorNetwork | null
  ) => {
    set((state) => ({ tensorNetwork: updater(state.tensorNetwork) }));
  }
}));
