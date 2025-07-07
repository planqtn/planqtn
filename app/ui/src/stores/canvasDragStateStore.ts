import { create } from "zustand";

import { WindowPoint } from "../types/coordinates";

export interface CanvasDragState {
  isDragging: boolean;
  mouseWindowPoint: WindowPoint;
}

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
