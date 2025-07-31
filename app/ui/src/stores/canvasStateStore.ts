import { create, StateCreator } from "zustand";
import { immer } from "zustand/middleware/immer";
import { createLegoSlice, DroppedLegosSlice } from "./droppedLegoStore";
import { ConnectionSlice, createConnectionsSlice } from "./connectionStore";
import { CanvasStateSerializer } from "../features/canvas/CanvasStateSerializer";
import {
  createEncodedCanvasStateSlice,
  EncodedCanvasStateSlice
} from "./encodedCanvasStateSlice";
import { Connection } from "./connectionStore";
import { DroppedLego } from "./droppedLegoStore";
import {
  createOperationHistorySlice,
  OperationHistorySlice
} from "./operationHistoryStateSlice";
import { createLegoDragStateSlice, LegoDragStateSlice } from "./legoDragState";
import {
  TensorNetworkSlice,
  useTensorNetworkSlice as useTensorNetworkSlice
} from "./tensorNetworkStore";
import {
  DroppedLegoClickHandlerSlice,
  useDroppedLegoClickHandlerSlice
} from "./droppedLegoEventsSlice";
import { GroupDragStateSlice, useGroupDragStateSlice } from "./groupDragState";
import { CloningSlice, useCloningSlice } from "./cloningSlice";
import { CopyPasteSlice, useCopyPasteSlice } from "./copyPasteSlice";
import {
  DroppedLegoLegEventsSlice,
  useLegoLegEventsSlice
} from "./droppedLegoLegEventsSlice";
import { LegDragStateSlice, useLegDragStateStore } from "./legDragState";
import {
  LegoLegPropertiesSlice,
  createLegoLegPropertiesSlice
} from "./legoLegPropertiesSlice";
import {
  CanvasEventHandlingSlice,
  createCanvasEventHandlingSlice
} from "./canvasEventHandlingSlice";
import { createCanvasUISlice, CanvasUISlice } from "./canvasUISlice";
import {
  OperatorHighlightSlice,
  createOperatorHighlightSlice
} from "./operatorHighlightSlice";
import { persist } from "zustand/middleware";
import {
  createZXTransformationsSlice,
  ZXTransformationsSlice
} from "./zxTransformationsSlice";
import { createModalsSlice, ModalSlice } from "./modalStore";

// Helper function to get canvasId from URL
export const getCanvasIdFromUrl = (): string => {
  const params = new URLSearchParams(window.location.search);
  const canvasId = params.get("canvasId");
  if (!canvasId) {
    // Generate a new canvasId if none exists (fallback)
    const newCanvasId = crypto.randomUUID();
    const newParams = new URLSearchParams(params);
    newParams.set("canvasId", newCanvasId);
    // Update URL with the new canvasId
    window.history.replaceState(
      null,
      "",
      `${window.location.pathname}?${newParams.toString()}${window.location.hash}`
    );
    return newCanvasId;
  }
  return canvasId;
};

export interface CanvasStore
  extends DroppedLegosSlice,
    ConnectionSlice,
    EncodedCanvasStateSlice,
    GlobalTensorNetworkSlice,
    LegoDragStateSlice,
    OperationHistorySlice,
    TensorNetworkSlice,
    DroppedLegoClickHandlerSlice,
    GroupDragStateSlice,
    CloningSlice,
    CopyPasteSlice,
    DroppedLegoLegEventsSlice,
    LegDragStateSlice,
    LegoLegPropertiesSlice,
    CanvasEventHandlingSlice,
    CanvasUISlice,
    OperatorHighlightSlice,
    ZXTransformationsSlice,
    ModalSlice {}

export interface GlobalTensorNetworkSlice {
  setLegosAndConnections: (
    droppedLegos: DroppedLego[],
    connections: Connection[]
  ) => void;
  getLegosAndConnections: () => {
    droppedLegos: DroppedLego[];
    connections: Connection[];
  };
}

export const createGlobalTensorNetworkStore: StateCreator<
  CanvasStore,
  [["zustand/immer", never], never],
  [],
  GlobalTensorNetworkSlice
> = (set, get) => ({
  setLegosAndConnections: (
    droppedLegos: DroppedLego[],
    connections: Connection[]
  ) => {
    const oldConnections = get().connections;
    const oldDroppedLegos = get().droppedLegos;
    set((state) => {
      state.droppedLegos = droppedLegos;
      state.connections = connections;
      state.connectedLegos = droppedLegos.filter((lego) =>
        connections.some(
          (connection) =>
            connection.from.legoId === lego.instance_id ||
            connection.to.legoId === lego.instance_id
        )
      );
    });

    // Update all leg hide states based on the new connections
    get().updateAllLegConnectionStates();
    get().updateAllLegHideStates();

    get().setHoveredConnection(null);
    get().setTensorNetwork(null);
    get().updateIsActiveForCachedTensorNetworks(
      [
        ...oldDroppedLegos.map((lego) => lego.instance_id),
        ...droppedLegos.map((lego) => lego.instance_id)
      ],
      [...oldConnections, ...connections]
    );
  },
  getLegosAndConnections: () => {
    return { droppedLegos: get().droppedLegos, connections: get().connections };
  }
});

export const useCanvasStore = create<CanvasStore>()(
  persist(
    immer((...a) => ({
      ...createConnectionsSlice(...a),
      ...createLegoSlice(...a),
      ...createEncodedCanvasStateSlice(...a),
      ...createGlobalTensorNetworkStore(...a),
      ...createOperationHistorySlice(...a),
      ...createLegoDragStateSlice(...a),
      ...useTensorNetworkSlice(...a),
      ...useDroppedLegoClickHandlerSlice(...a),
      ...useGroupDragStateSlice(...a),
      ...useCloningSlice(...a),
      ...useCopyPasteSlice(...a),
      ...useLegoLegEventsSlice(...a),
      ...useLegDragStateStore(...a),
      ...createLegoLegPropertiesSlice(...a),
      ...createCanvasEventHandlingSlice(...a),
      ...createCanvasUISlice(...a),
      ...createOperatorHighlightSlice(...a),
      ...createZXTransformationsSlice(...a),
      ...createModalsSlice(...a)
    })),
    {
      name: `canvas-state-${getCanvasIdFromUrl()}`,
      partialize: (state: CanvasStore) => {
        // Use the existing CanvasStateSerializer to handle serialization properly
        const serializableCanvasState =
          state.canvasStateSerializer.toSerializableCanvasState(state);

        return {
          jsonState: JSON.stringify(serializableCanvasState),
          _timestamp: Date.now()
        };
      },
      onRehydrateStorage: () => (state: CanvasStore | undefined) => {
        if (!state) return;

        // Use the CanvasStateSerializer to properly decode the state
        const canvasId = getCanvasIdFromUrl();

        // Create a new serializer with the canvasId from URL
        const serializer = new CanvasStateSerializer(canvasId);

        console.log(
          "canvasId from url",
          canvasId,
          "from serializer",
          serializer.canvasId,

          "state.getCanvasId()",
          state.getCanvasId()
        );
        try {
          // The state here is the serialized canvas state from partialize
          const jsonStateString =
            (state as unknown as { jsonState: string }).jsonState || "";
          console.log("jsonStateString", jsonStateString);
          state.rehydrateCanvasState(jsonStateString);
        } catch (error) {
          console.error("Error during state rehydration:", error);
          // Fall back to empty state if encoding fails
          state.droppedLegos = [];
          state.connectedLegos = [];
          state.connections = [];
        }

        // Reset transient UI states to their initial values
        state.clearLegoDragState();
        state.clearLegDragState();
        state.clearGroupDragState();
        state.clearSelectionBox();
        state.hoveredConnection = null;
        state.error = null;
        state.canvasRef = null;
        state.tensorNetwork = null;

        // Recreate class instances that lose methods during serialization
        state.canvasStateSerializer = serializer;
      }
    }
  )
);
