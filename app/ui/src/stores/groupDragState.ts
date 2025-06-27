import { create } from "zustand";
import { GroupDragState } from "../lib/types";

interface GroupDragStateStore {
  groupDragState: GroupDragState | null;
  setGroupDragState: (
    groupDragStateOrUpdater:
      | GroupDragState
      | null
      | ((prev: GroupDragState | null) => GroupDragState | null)
  ) => void;
}

export const useGroupDragStateStore = create<GroupDragStateStore>((set) => ({
  groupDragState: null,

  setGroupDragState: (
    groupDragStateOrUpdater:
      | GroupDragState
      | null
      | ((prev: GroupDragState | null) => GroupDragState | null)
  ) => {
    if (typeof groupDragStateOrUpdater === "function") {
      set((state) => ({
        groupDragState: groupDragStateOrUpdater(state.groupDragState)
      }));
    } else {
      set({ groupDragState: groupDragStateOrUpdater });
    }
  }
}));
