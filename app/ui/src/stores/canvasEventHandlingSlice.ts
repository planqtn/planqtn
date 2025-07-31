import { StateCreator } from "zustand";
import { CanvasStore } from "./canvasStateStore";
import { DroppedLego, LegoPiece } from "./droppedLegoStore";
import { Legos } from "../features/lego/Legos";
import { LogicalPoint } from "../types/coordinates";

export interface CanvasEventHandlingSlice {
  pythonCode: string;
  showPythonCodeModal: boolean;
  setShowPythonCodeModal: (show: boolean) => void;
  setPythonCode: (code: string) => void;
  selectedDynamicLego: LegoPiece | null;
  pendingDropPosition: { x: number; y: number } | null;
  isDynamicLegoDialogOpen: boolean;
  setSelectedDynamicLego: (lego: LegoPiece | null) => void;
  setPendingDropPosition: (position: { x: number; y: number } | null) => void;
  setIsDynamicLegoDialogOpen: (open: boolean) => void;
  handleDynamicLegoSubmit: (
    parameters: Record<string, unknown>
  ) => Promise<void>;
  handleClearAll: () => void;
  fuseLegos: (legosToFuse: DroppedLego[]) => Promise<void>;

  handleDynamicLegoDrop: (
    draggedLego: LegoPiece,
    dropPosition: { x: number; y: number }
  ) => void;
  handleExportPythonCode: () => void;
}

export const createCanvasEventHandlingSlice: StateCreator<
  CanvasStore,
  [["zustand/immer", never]],
  [],
  CanvasEventHandlingSlice
> = (set, get) => ({
  pythonCode: "",
  showPythonCodeModal: false,
  setShowPythonCodeModal: (show) =>
    set((state) => {
      state.showPythonCodeModal = show;
    }),
  setPythonCode: (code) =>
    set((state) => {
      state.pythonCode = code;
    }),
  selectedDynamicLego: null,
  pendingDropPosition: null,
  isDynamicLegoDialogOpen: false,
  setSelectedDynamicLego: (lego) =>
    set((state) => {
      state.selectedDynamicLego = lego;
    }),
  setPendingDropPosition: (position) =>
    set((state) => {
      state.pendingDropPosition = position;
    }),
  setIsDynamicLegoDialogOpen: (open) =>
    set((state) => {
      state.isDynamicLegoDialogOpen = open;
    }),
  handleDynamicLegoSubmit: async (parameters) => {
    const {
      selectedDynamicLego,
      pendingDropPosition,
      newInstanceId,
      addDroppedLego,
      addOperation,
      setError
    } = get() as CanvasStore;
    if (!selectedDynamicLego || !pendingDropPosition) return;
    try {
      const newLego = Legos.createDynamicLego(
        selectedDynamicLego.type_id,
        parameters.d as number,
        newInstanceId(),
        new LogicalPoint(pendingDropPosition.x, pendingDropPosition.y)
      );

      addDroppedLego(newLego);
      addOperation({
        type: "add",
        data: { legosToAdd: [newLego] }
      });
    } catch (error) {
      if (setError) {
        setError(
          error instanceof Error
            ? error.message
            : "Failed to create dynamic lego"
        );
      }
    } finally {
      get().setIsDynamicLegoDialogOpen(false);
      get().setSelectedDynamicLego(null);
      get().setPendingDropPosition(null);
    }
  },

  handleClearAll: () => {
    const { droppedLegos, connections, addOperation, setLegosAndConnections } =
      get();
    if (droppedLegos.length === 0 && connections.length === 0) return;
    addOperation({
      type: "remove",
      data: {
        legosToRemove: droppedLegos,
        connectionsToRemove: connections
      }
    });
    setLegosAndConnections([], []);
  },

  fuseLegos: async (legosToFuse) => {
    const {
      connections,
      droppedLegos,
      addOperation,
      setLegosAndConnections,
      setError
    } = get();
    const trafo = new (await import("../transformations/FuseLegos")).FuseLegos(
      connections,
      droppedLegos
    );
    try {
      const {
        connections: newConnections,
        droppedLegos: newDroppedLegos,
        operation
      } = await trafo.apply(legosToFuse);
      addOperation(operation);
      setLegosAndConnections(newDroppedLegos, newConnections);
    } catch (error) {
      if (setError)
        setError(`${error instanceof Error ? error.message : String(error)}`);
      return;
    }
  },

  handleDynamicLegoDrop: (draggedLego, dropPosition) => {
    set((state) => {
      state.selectedDynamicLego = draggedLego;
      state.pendingDropPosition = { x: dropPosition.x, y: dropPosition.y };
      state.isDynamicLegoDialogOpen = true;
    });
  },

  handleExportPythonCode: () => {
    const { tensorNetwork } = get();
    if (!tensorNetwork) return;
    const code = tensorNetwork.generateConstructionCode();
    set((state) => {
      state.pythonCode = code;
      state.showPythonCodeModal = true;
    });
  }
});
