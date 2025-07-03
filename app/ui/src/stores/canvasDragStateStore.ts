import { create } from "zustand";
import { CanvasDragState } from "../lib/types";

interface CanvasDragStateStore {
  canvasDragState: CanvasDragState | null;
  setCanvasDragState: (canvasDragState: CanvasDragState | null) => void;
  resetCanvasDragState: () => void;
}

export const useCanvasDragStateStore = create<CanvasDragStateStore>((set) => ({
  canvasDragState: null,

  setCanvasDragState: (canvasDragState: CanvasDragState | null) => {
    set({ canvasDragState: canvasDragState });
  },
  resetCanvasDragState: () => {
    set({ canvasDragState: null });
  }
}));
