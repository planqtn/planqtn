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
    set({ droppedLegos, connections });
    const connectedLegoIds: Set<string> = new Set(
      connections.flatMap((connection) => [
        connection.from.legoId,
        connection.to.legoId
      ])
    );
    const connectedLegos = droppedLegos.filter((lego) =>
      connectedLegoIds.has(lego.instanceId)
    );
    get().connectedLegos = connectedLegos;

    // Initialize leg hide states for all legos
    droppedLegos.forEach((lego) => {
      get().initializeLegHideStates(lego.instanceId, lego.numberOfLegs);
      get().initializeLegConnectionStates(lego.instanceId, lego.numberOfLegs);
    });

    // Update all leg hide states based on the new connections
    get().updateAllLegHideStates();

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
