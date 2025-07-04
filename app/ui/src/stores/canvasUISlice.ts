import { StateCreator } from "zustand";
import { CanvasStore } from "./canvasStateStore";
import { Connection, SelectionBoxState } from "../lib/types";

export interface CanvasUISlice {
  selectionBox: SelectionBoxState;
  setSelectionBox: (selectionBox: SelectionBoxState) => void;
  updateSelectionBox: (updates: Partial<SelectionBoxState>) => void;
  hoveredConnection: Connection | null;
  setHoveredConnection: (hoveredConnection: Connection | null) => void;
  setError: (error: string | null) => void;
  error: string | null;
}

export const createCanvasUISlice: StateCreator<
  CanvasStore,
  [["zustand/immer", never]],
  [],
  CanvasUISlice
> = (set) => ({
  selectionBox: {
    isSelecting: false,
    startX: 0,
    startY: 0,
    currentX: 0,
    currentY: 0,
    justFinished: false
  },

  setSelectionBox: (selectionBox) =>
    set((state) => {
      state.selectionBox = selectionBox;
    }),

  updateSelectionBox: (updates) =>
    set((state) => {
      state.selectionBox = { ...state.selectionBox, ...updates };
    }),

  hoveredConnection: null,
  setHoveredConnection: (hoveredConnection) => {
    set((state) => {
      state.hoveredConnection = hoveredConnection;
    });
  },
  error: null,
  setError: (error) => {
    set((state) => {
      state.error = error;
    });
  }
});
