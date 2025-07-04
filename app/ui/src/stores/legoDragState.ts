import { StateCreator } from "zustand";
import { CanvasStore } from "./canvasStateStore";

export enum DraggingStage {
  NOT_DRAGGING,
  MAYBE_DRAGGING,
  DRAGGING,
  JUST_FINISHED
}

export interface LegoDragState {
  draggingStage: DraggingStage;
  draggedLegoIndex: number;
  startX: number;
  startY: number;
  originalX: number;
  originalY: number;
}

export interface LegoDragStateSlice {
  dragState: LegoDragState;
  setDragState: (dragState: LegoDragState) => void;
}

export const createLegoDragStateSlice: StateCreator<
  CanvasStore,
  [["zustand/immer", never]],
  [],
  LegoDragStateSlice
> = (set) => ({
  dragState: {
    draggingStage: DraggingStage.NOT_DRAGGING,
    draggedLegoIndex: -1,
    startX: 0,
    startY: 0,
    originalX: 0,
    originalY: 0
  },

  setDragState: (dragState: LegoDragState) => {
    set((state) => {
      state.dragState = dragState;
    });
  }
});
