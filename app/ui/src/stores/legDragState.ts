import { StateCreator } from "zustand";
import { CanvasStore } from "./canvasStateStore";
import { WindowPoint } from "../types/coordinates";

export interface LegDragState {
  isDragging: boolean;
  legoId: string;
  leg_index: number;
  startMouseWindowPoint: WindowPoint;
  currentMouseWindowPoint: WindowPoint;
}

export interface LegDragStateSlice {
  legDragState: LegDragState | null;
  setLegDragState: (legDragState: LegDragState | null) => void;
  clearLegDragState: () => void;
}

export const useLegDragStateStore: StateCreator<
  CanvasStore,
  [["zustand/immer", never]],
  [],
  LegDragStateSlice
> = (set) => ({
  legDragState: null,

  setLegDragState: (legDragState: LegDragState | null) => {
    set({
      legDragState: legDragState
    });
  },
  clearLegDragState: () => {
    set({
      legDragState: null
    });
  }
});
