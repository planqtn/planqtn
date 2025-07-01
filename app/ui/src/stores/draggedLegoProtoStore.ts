import { create } from "zustand";
import { LegoPiece as LegoProto } from "./droppedLegoStore.ts";

interface DraggedLegoProtoStore {
  draggedLegoProto: LegoProto | null;
  setDraggedLegoProto: (lego: LegoProto | null) => void;
}

export const useDraggedLegoStore = create<DraggedLegoProtoStore>((set) => ({
  draggedLegoProto: null,

  setDraggedLegoProto: (lego: LegoProto | null) => {
    set({ draggedLegoProto: lego });
  }
}));
