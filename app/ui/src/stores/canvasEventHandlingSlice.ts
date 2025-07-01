import { StateCreator } from "zustand";
import { CanvasStore } from "./canvasStateStore";
import { DroppedLego, LegoPiece } from "./droppedLegoStore";
import { Legos } from "../features/lego/Legos";
import { Connection } from "../lib/types";

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
  makeSpace: (
    center: { x: number; y: number },
    radius: number,
    skipLegos: DroppedLego[],
    legosToCheck: DroppedLego[]
  ) => DroppedLego[];
  handleDynamicLegoDrop: (
    draggedLego: LegoPiece,
    dropPosition: { x: number; y: number }
  ) => void;
  handleExportPythonCode: () => void;
  handlePullOutSameColoredLeg: (lego: DroppedLego) => Promise<void>;
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
      const dynamicLego = Legos.getDynamicLego({
        lego_id: selectedDynamicLego.id,
        parameters
      });
      const instanceId = newInstanceId();
      const newLego = new DroppedLego(
        dynamicLego,
        pendingDropPosition.x,
        pendingDropPosition.y,
        instanceId
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
      if (setError) setError(`${error}`);
      return;
    }
  },

  makeSpace: (center, radius, skipLegos, legosToCheck) => {
    const skipIds = new Set(skipLegos.map((l) => l.instanceId));
    return legosToCheck.map((lego) => {
      if (skipIds.has(lego.instanceId)) return lego;
      const dx = lego.x - center.x;
      const dy = lego.y - center.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      if (distance < radius + 80) {
        const angle = Math.atan2(dy, dx);
        const newX = center.x + (radius + 80) * Math.cos(angle);
        const newY = center.y + (radius + 80) * Math.sin(angle);
        return lego.with({ x: newX, y: newY });
      }
      return lego;
    });
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
  },

  handlePullOutSameColoredLeg: async (lego) => {
    const {
      droppedLegos,
      connections,
      setLegosAndConnections,
      addOperation,
      setError
    } = get();

    // Get max instance ID
    const maxInstanceId = Math.max(
      ...droppedLegos.map((l) => parseInt(l.instanceId))
    );
    const numLegs = lego.numberOfLegs;

    // Find any existing connections to the original lego
    const existingConnections = connections.filter(
      (conn) =>
        conn.from.legoId === lego.instanceId ||
        conn.to.legoId === lego.instanceId
    );

    try {
      // Get the new repetition code with one more leg
      const newLegoData = Legos.getDynamicLego({
        lego_id: lego.id,
        parameters: {
          d: numLegs + 1
        }
      });

      // Create the new lego with updated matrix but same position
      const newLego: DroppedLego = new DroppedLego(
        { ...lego, parity_check_matrix: newLegoData.parity_check_matrix },
        lego.x,
        lego.y,
        lego.instanceId
      );

      // Create a stopper based on the lego type
      const stopperLego: DroppedLego = new DroppedLego(
        {
          id: lego.id === "z_rep_code" ? "stopper_x" : "stopper_z",
          name: lego.id === "z_rep_code" ? "X Stopper" : "Z Stopper",
          shortName: lego.id === "z_rep_code" ? "X" : "Z",
          description: lego.id === "z_rep_code" ? "X Stopper" : "Z Stopper",
          parity_check_matrix: lego.id === "z_rep_code" ? [[1, 0]] : [[0, 1]],
          logical_legs: [],
          gauge_legs: []
        },
        lego.x + 100, // Position the stopper to the right of the lego
        lego.y,
        (maxInstanceId + 1).toString()
      );

      // Create new connection to the stopper
      const newConnection: Connection = new Connection(
        {
          legoId: lego.instanceId,
          legIndex: numLegs // The new leg will be at index numLegs
        },
        {
          legoId: stopperLego.instanceId,
          legIndex: 0
        }
      );

      // Update the state
      const newLegos = [
        ...droppedLegos.filter((l) => l.instanceId !== lego.instanceId),
        newLego,
        stopperLego
      ];
      const newConnections = [
        ...connections.filter(
          (c) =>
            c.from.legoId !== lego.instanceId && c.to.legoId !== lego.instanceId
        ),
        ...existingConnections,
        newConnection
      ];

      setLegosAndConnections(newLegos, newConnections);

      // Add to operation history
      addOperation({
        type: "pullOutOppositeLeg",
        data: {
          legosToRemove: [lego],
          connectionsToRemove: [],
          legosToAdd: [newLego, stopperLego],
          connectionsToAdd: [newConnection]
        }
      });
    } catch (error) {
      if (setError) setError(`Error pulling out opposite leg: ${error}`);
    }
  }
});
