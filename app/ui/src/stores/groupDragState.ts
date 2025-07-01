import { StateCreator } from "zustand";
import { GroupDragState } from "../lib/types";
import { CanvasStore } from "./canvasStateStore";

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
