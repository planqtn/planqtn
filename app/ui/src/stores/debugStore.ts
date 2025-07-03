import { create } from "zustand";
import { WindowPoint } from "../types/coordinates";

export const useDebugStore = create<DebugStore>((set) => ({
  debugMousePos: new WindowPoint(0, 0),
  setDebugMousePos: (mousePos) => set({ debugMousePos: mousePos })
}));

interface DebugStore {
  debugMousePos: WindowPoint;
  setDebugMousePos: (mousePos: WindowPoint) => void;
}
