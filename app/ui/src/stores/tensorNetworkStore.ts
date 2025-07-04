import { StateCreator } from "zustand";
import { TensorNetwork } from "../lib/TensorNetwork";
import { CanvasStore } from "./canvasStateStore";

export interface TensorNetworkSlice {
  tensorNetwork: TensorNetwork | null;
  setTensorNetwork: (network: TensorNetwork | null) => void;
}

export const useTensorNetworkSlice: StateCreator<
  CanvasStore,
  [["zustand/immer", never]],
  [],
  TensorNetworkSlice
> = (set) => ({
  tensorNetwork: null,

  setTensorNetwork: (network) => {
    set({ tensorNetwork: network });
  }
});
