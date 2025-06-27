import { create } from "zustand";
import { DragState } from "../lib/types";

interface DragStateStore {
  dragState: DragState | null;
  setDragState: (
    dragState: DragState | null | ((prev: DragState | null) => DragState | null)
  ) => void;
}

export const useDragStateStore = create<DragStateStore>((set) => ({
  dragState: null,

  setDragState: (
    dragStateOrUpdater:
      | DragState
      | null
      | ((prev: DragState | null) => DragState | null)
  ) => {
    if (typeof dragStateOrUpdater === "function") {
      set((state) => ({
        dragState: dragStateOrUpdater(state.dragState)
      }));
    } else {
      set({ dragState: dragStateOrUpdater });
    }
  }
}));
