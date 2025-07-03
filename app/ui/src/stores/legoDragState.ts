import { StateCreator } from "zustand";
import { CanvasStore } from "./canvasStateStore";
import { LogicalPoint, WindowPoint } from "../types/coordinates";

export enum DraggingStage {
  NOT_DRAGGING,
  MAYBE_DRAGGING,
  DRAGGING,
  JUST_FINISHED
}

export interface LegoDragState {
  draggingStage: DraggingStage;
  draggedLegoIndex: number;
  startMouseWindowPoint: WindowPoint;
  startLegoLogicalPoint: LogicalPoint;
}

export interface LegoDragStateSlice {
  legoDragState: LegoDragState;
  setLegoDragState: (dragState: LegoDragState) => void;
  resetLegoDragState: (justFinished?: boolean) => void;
}

const initialLegoDragState: LegoDragState = {
  draggingStage: DraggingStage.NOT_DRAGGING,
  draggedLegoIndex: -1,
  startMouseWindowPoint: new WindowPoint(0, 0),
  startLegoLogicalPoint: new LogicalPoint(0, 0)
};

export const createLegoDragStateSlice: StateCreator<
  CanvasStore,
  [["zustand/immer", never]],
  [],
  LegoDragStateSlice
> = (set) => ({
  legoDragState: initialLegoDragState,

  setLegoDragState: (dragState: LegoDragState) => {
    set((state) => {
      state.legoDragState = dragState;
    });
  },

  resetLegoDragState: (justFinished?: boolean) => {
    set((state) => {
      state.legoDragState = justFinished
        ? {
            ...initialLegoDragState,
            draggingStage: DraggingStage.JUST_FINISHED
          }
        : initialLegoDragState;
    });
  }
});
