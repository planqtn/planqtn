import { create } from "zustand";
import { CanvasDragState } from "../lib/types";

interface CanvasDragStateStore {
  canvasDragState: CanvasDragState | null;
  setCanvasDragState: (
    canvasDragStateOrUpdater:
      | CanvasDragState
      | null
      | ((prev: CanvasDragState | null) => CanvasDragState | null)
  ) => void;
}

export const useCanvasDragStateStore = create<CanvasDragStateStore>((set) => ({
  canvasDragState: null,

  setCanvasDragState: (
    canvasDragStateOrUpdater:
      | CanvasDragState
      | null
      | ((prev: CanvasDragState | null) => CanvasDragState | null)
  ) => {
    if (typeof canvasDragStateOrUpdater === "function") {
      set((state) => ({
        canvasDragState: canvasDragStateOrUpdater(state.canvasDragState)
      }));
    } else {
      set({ canvasDragState: canvasDragStateOrUpdater });
    }
  }
}));
