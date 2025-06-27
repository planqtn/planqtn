import { create } from "zustand";
import { LegDragState } from "../lib/types";

interface LegDragStateStore {
  legDragState: LegDragState | null;
  setLegDragState: (
    stateOrUpdater:
      | LegDragState
      | null
      | ((prev: LegDragState | null) => LegDragState | null)
  ) => void;
}

export const useLegDragStateStore = create<LegDragStateStore>((set) => ({
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
}));
