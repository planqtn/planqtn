import { create } from "zustand";
import { LegoPiece } from "../stores/droppedLegoStore.ts";

interface DraggedLegoStore {
  draggedLego: LegoPiece | null;
  setDraggedLego: (lego: LegoPiece | null) => void;
}

export const useDraggedLegoStore = create<DraggedLegoStore>((set) => ({
  draggedLego: null,

  setDraggedLego: (lego: LegoPiece | null) => {
    set({ draggedLego: lego });
  }
}));
