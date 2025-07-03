import { StateCreator } from "zustand";
import { CanvasStore } from "./canvasStateStore";
import { LogicalPoint } from "../types/coordinates";

// Add a new interface for group drag state
export interface GroupDragState {
  legoInstanceIds: string[];
  originalPositions: { [instanceId: string]: LogicalPoint };
}
export interface GroupDragStateSlice {
  groupDragState: GroupDragState | null;
  setGroupDragState: (
    groupDragStateOrUpdater:
      | GroupDragState
      | null
      | ((prev: GroupDragState | null) => GroupDragState | null)
  ) => void;
  clearGroupDragState: () => void;
}

export const useGroupDragStateSlice: StateCreator<
  CanvasStore,
  [["zustand/immer", never]],
  [],
  GroupDragStateSlice
> = (set, get) => ({
  groupDragState: null,

  setGroupDragState: (
    groupDragStateOrUpdater:
      | GroupDragState
      | null
      | ((prev: GroupDragState | null) => GroupDragState | null)
  ) => {
    if (typeof groupDragStateOrUpdater === "function") {
      set({
        groupDragState: groupDragStateOrUpdater(get().groupDragState)
      });
    } else {
      set({ groupDragState: groupDragStateOrUpdater });
    }
  },

  clearGroupDragState: () => {
    set({ groupDragState: null });
  }
});
