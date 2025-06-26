import { create } from "zustand";
import { DroppedLego } from "../lib/types";

interface LegoStore {
  droppedLegos: DroppedLego[];
  setDroppedLegos: (
    legos: DroppedLego[] | ((prev: DroppedLego[]) => DroppedLego[])
  ) => void;
  addDroppedLego: (lego: DroppedLego) => void;
  addDroppedLegos: (legos: DroppedLego[]) => void;
  removeDroppedLego: (instanceId: string) => void;
  updateDroppedLego: (
    instanceId: string,
    updates: Partial<DroppedLego>
  ) => void;
  removeDroppedLegos: (instanceIds: string[]) => void;
  updateDroppedLegos: (updates: DroppedLego[]) => void;
  clearDroppedLegos: () => void;
}

export const useLegoStore = create<LegoStore>((set) => ({
  droppedLegos: [],

  setDroppedLegos: (
    legos: DroppedLego[] | ((prev: DroppedLego[]) => DroppedLego[])
  ) =>
    set((state: LegoStore) => ({
      droppedLegos:
        typeof legos === "function" ? legos(state.droppedLegos) : legos
    })),

  addDroppedLego: (lego: DroppedLego) =>
    set((state: LegoStore) => ({
      droppedLegos: [...state.droppedLegos, lego]
    })),

  addDroppedLegos: (legos: DroppedLego[]) =>
    set((state: LegoStore) => ({
      droppedLegos: [...state.droppedLegos, ...legos]
    })),

  removeDroppedLego: (instanceId: string) =>
    set((state: LegoStore) => ({
      droppedLegos: state.droppedLegos.filter(
        (lego: DroppedLego) => lego.instanceId !== instanceId
      )
    })),

  removeDroppedLegos: (instanceIds: string[]) =>
    set((state: LegoStore) => ({
      droppedLegos: state.droppedLegos.filter(
        (lego: DroppedLego) => !instanceIds.includes(lego.instanceId)
      )
    })),

  updateDroppedLego: (instanceId: string, updates: Partial<DroppedLego>) =>
    set((state: LegoStore) => ({
      droppedLegos: state.droppedLegos.map((lego: DroppedLego) =>
        lego.instanceId === instanceId ? { ...lego, ...updates } : lego
      )
    })),

  updateDroppedLegos: (updates: DroppedLego[]) =>
    set({ droppedLegos: updates }),

  clearDroppedLegos: () => set({ droppedLegos: [] })
}));
