import { create } from "zustand";
import { LegoPiece } from "../lib/types";

export interface BuildingBlockDragState {
  isDragging: boolean;
  draggedLego: LegoPiece | null;
  mouseX: number;
  mouseY: number;
  dragEnterCounter: number;
}

const initialBuildingBlockDragState: BuildingBlockDragState = {
  isDragging: false,
  draggedLego: null,
  mouseX: 0,
  mouseY: 0,
  dragEnterCounter: 0
};

interface BuildingBlockDragStateStore {
  buildingBlockDragState: BuildingBlockDragState;
  setBuildingBlockDragState: (
    buildingBlockDragState:
      | BuildingBlockDragState
      | ((prev: BuildingBlockDragState) => BuildingBlockDragState)
  ) => void;
  clearBuildingBlockDragState: () => void;
}

export const useBuildingBlockDragStateStore =
  create<BuildingBlockDragStateStore>((set) => ({
    buildingBlockDragState: initialBuildingBlockDragState,

    setBuildingBlockDragState: (
      buildingBlockDragStateOrUpdater:
        | BuildingBlockDragState
        | ((prev: BuildingBlockDragState) => BuildingBlockDragState)
    ) => {
      if (typeof buildingBlockDragStateOrUpdater === "function") {
        set((state) => ({
          buildingBlockDragState: buildingBlockDragStateOrUpdater(
            state.buildingBlockDragState
          )
        }));
      } else {
        set({ buildingBlockDragState: buildingBlockDragStateOrUpdater });
      }
    },

    clearBuildingBlockDragState: () => {
      set({ buildingBlockDragState: initialBuildingBlockDragState });
    }
  }));
