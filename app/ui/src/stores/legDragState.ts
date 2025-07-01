import { StateCreator } from "zustand";
import { LegDragState } from "../lib/types";
import { CanvasStore } from "./canvasStateStore";

export interface LegDragStateSlice {
  legDragState: LegDragState | null;
  setLegDragState: (
    stateOrUpdater:
      | LegDragState
      | null
      | ((prev: LegDragState | null) => LegDragState | null)
  ) => void;
}

export const useLegDragStateStore: StateCreator<
  CanvasStore,
  [["zustand/immer", never]],
  [],
  LegDragStateSlice
> = (set) => ({
  legDragState: null,

  setLegDragState: (
    stateOrUpdater:
      | LegDragState
      | null
      | ((prev: LegDragState | null) => LegDragState | null)
  ) => {
    set((state) => ({
      legDragState:
        typeof stateOrUpdater === "function"
          ? stateOrUpdater(state.legDragState)
          : stateOrUpdater
    }));
  }
});
