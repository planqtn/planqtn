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
  draggedLegoInstanceId: string;
  startMouseWindowPoint: WindowPoint;
  startLegoLogicalPoint: LogicalPoint;
}

export interface LegoDragStateSlice {
  legoDragState: LegoDragState;
  setLegoDragState: (dragState: LegoDragState) => void;
  resetLegoDragState: (justFinished?: boolean) => void;
  isDraggedLego: (legoInstanceId: string) => boolean;
  clearLegoDragState: () => void;
}

const initialLegoDragState: LegoDragState = {
  draggingStage: DraggingStage.NOT_DRAGGING,
  draggedLegoInstanceId: "",
  startMouseWindowPoint: new WindowPoint(0, 0),
  startLegoLogicalPoint: new LogicalPoint(0, 0)
};

export const createLegoDragStateSlice: StateCreator<
  CanvasStore,
  [["zustand/immer", never]],
  [],
  LegoDragStateSlice
> = (set, get) => ({
  legoDragState: initialLegoDragState,
  clearLegoDragState: () => {
    set({
      legoDragState: initialLegoDragState
    });
  },

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

    // Clear clone mapping when drag ends
    get().clearCloneMapping();
  },

  // Check which legos are being dragged to hide them
  isDraggedLego: (legoInstanceId: string) => {
    const draggedIds = new Set<string>();

    // Add individually dragged lego
    if (get().legoDragState?.draggingStage === DraggingStage.DRAGGING) {
      draggedIds.add(get().legoDragState.draggedLegoInstanceId);
    }

    // Add group dragged legos (selected legos)
    if (
      get().tensorNetwork?.legos &&
      get().legoDragState?.draggingStage === DraggingStage.DRAGGING
    ) {
      get().tensorNetwork?.legos.forEach((lego) => {
        draggedIds.add(lego.instance_id);
      });
    }

    if (
      get().groupDragState &&
      get().legoDragState?.draggingStage === DraggingStage.DRAGGING
    ) {
      get().groupDragState?.legoInstanceIds.forEach((legoId) => {
        draggedIds.add(legoId);
      });
    }

    return draggedIds.has(legoInstanceId);
  }
});
