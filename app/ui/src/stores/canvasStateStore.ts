import { create, StateCreator } from "zustand";
import { immer } from "zustand/middleware/immer";
import { createLegoSlice, DroppedLegosSlice } from "./droppedLegoStore";
import { ConnectionSlice, createConnectionsSlice } from "./connectionStore";
import {
  createEncodedCanvasStateSlice,
  EncodedCanvasStateSlice
} from "./encodedCanvasStateSlice";
import { Connection } from "../lib/types";
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
import {
  LegoLegEventsSlice,
  useLegoLegEventsSlice
} from "./legoLegEventsSlice";
import { LegDragStateSlice, useLegDragStateStore } from "./legDragState";
import {
  LegoLegPropertiesSlice,
  createLegoLegPropertiesSlice
} from "./legoLegPropertiesSlice";
import {
  CanvasEventHandlingSlice,
  createCanvasEventHandlingSlice
} from "./canvasEventHandlingSlice";
import { CanvasUISlice, createCanvasUISlice } from "./canvasUISlice";

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
    LegoLegEventsSlice,
    LegDragStateSlice,
    LegoLegPropertiesSlice,
    CanvasEventHandlingSlice,
    CanvasUISlice {
  setError?: (error: string) => void;
}

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
  [["zustand/immer", never]],
  [],
  GlobalTensorNetworkSlice
> = (set, get) => ({
  setLegosAndConnections: (
    droppedLegos: DroppedLego[],
    connections: Connection[]
  ) => {
    set((state) => {
      state.droppedLegos = droppedLegos;
      state.connections = connections;
      state.connectedLegos = droppedLegos.filter((lego) =>
        connections.some(
          (connection) =>
            connection.from.legoId === lego.instanceId ||
            connection.to.legoId === lego.instanceId
        )
      );
    });

    // Update all leg hide states based on the new connections
    get().updateAllLegConnectionStates();
    get().updateAllLegHideStates();

    get().setHoveredConnection(null);
    get().setTensorNetwork(null);
    get().updateEncodedCanvasState();
  },
  getLegosAndConnections: () => {
    return { droppedLegos: get().droppedLegos, connections: get().connections };
  }
});

export const useCanvasStore = create<CanvasStore>()(
  immer<CanvasStore>((...a) => ({
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
    ...useLegoLegEventsSlice(...a),
    ...useLegDragStateStore(...a),
    ...createLegoLegPropertiesSlice(...a),
    ...createCanvasEventHandlingSlice(...a),
    ...createCanvasUISlice(...a)
  }))
);
