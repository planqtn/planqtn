import { StateCreator } from "zustand";
import { CanvasStore } from "./canvasStateStore";
import { DroppedLego } from "./droppedLegoStore";
import { applyConnectGraphNodes } from "@/transformations/graph-states/ConnectGraphNodesWithCenterLego";
import { applyCompleteGraphViaHadamards } from "@/transformations/graph-states/CompleteGraphViaHadamards";

export interface GraphStateTransformationsSlice {
  handleConnectGraphNodes: (legos: DroppedLego[]) => void;
  handleCompleteGraphViaHadamards: (legos: DroppedLego[]) => void;
}

export const createGraphStateTransformationsSlice: StateCreator<
  CanvasStore,
  [["zustand/immer", never]],
  [],
  GraphStateTransformationsSlice
> = (_, get) => ({
  handleConnectGraphNodes: (legos: DroppedLego[]) => {
    const { droppedLegos, connections, setLegosAndConnections, addOperation } =
      get();
    const result = applyConnectGraphNodes(legos, droppedLegos, connections);
    setLegosAndConnections(result.droppedLegos, result.connections);
    addOperation(result.operation);
  },

  handleCompleteGraphViaHadamards: (legos: DroppedLego[]) => {
    const { droppedLegos, connections, setLegosAndConnections, addOperation } =
      get();
    const result = applyCompleteGraphViaHadamards(
      legos,
      droppedLegos,
      connections
    );
    setLegosAndConnections(result.droppedLegos, result.connections);
    addOperation(result.operation);
  }
});
