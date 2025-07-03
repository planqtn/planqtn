import { StateCreator } from "zustand";
import { LegDragState } from "../lib/types";
import { CanvasStore } from "./canvasStateStore";

export interface LegDragStateSlice {
  legDragState: LegDragState | null;
  setLegDragState: (legDragState: LegDragState | null) => void;
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
  }
});
