import { StateCreator } from "zustand";
import { DroppedLego } from "./droppedLegoStore";
import { CanvasStore } from "./canvasStateStore";
import { DraggingStage } from "./legoDragState";
import { findConnectedComponent, TensorNetwork } from "../lib/TensorNetwork";
import { LogicalPoint, WindowPoint } from "../types/coordinates";

export interface DroppedLegoClickHandlerSlice {
  handleLegoClick: (
    lego: DroppedLego,
    ctrlKey: boolean,
    metaKey: boolean
  ) => void;
  handleLegoMouseDown: (
    instance_id: string,
    x: number,
    y: number,
    shiftKey: boolean
  ) => void;
}

export const useDroppedLegoClickHandlerSlice: StateCreator<
  CanvasStore,
  [["zustand/immer", never]],
  [],
  DroppedLegoClickHandlerSlice
> = (_, get) => ({
  handleLegoClick: (lego, ctrlKey, metaKey) => {
    console.log("handleLegoClick", lego, ctrlKey, metaKey);
    // Get the current global drag state
    const currentDragState = get().legoDragState;

    if (currentDragState.draggingStage === DraggingStage.JUST_FINISHED) {
      get().resetLegoDragState();
      return;
    }

    if (currentDragState.draggingStage !== DraggingStage.DRAGGING) {
      // Only handle click if not dragging

      // Clear the drag state since this is a click, not a drag
      get().resetLegoDragState();

      if (ctrlKey || metaKey) {
        // Handle Ctrl+click for toggling selection
        // Find the current version of the lego from droppedLegos to avoid stale state
        const currentLego = get().droppedLegos.find(
          (l) => l.instance_id === lego.instance_id
        );
        if (!currentLego) return;

        const tensorNetwork = get().tensorNetwork;
        if (tensorNetwork) {
          const isSelected = tensorNetwork.legos.some(
            (l) => l.instance_id === currentLego.instance_id
          );
          if (isSelected) {
            // Remove lego from tensor network
            const newLegos = tensorNetwork.legos.filter(
              (l) => l.instance_id !== currentLego.instance_id
            );

            if (newLegos.length === 0) {
              get().setTensorNetwork(null);
            } else {
              const newConnections = tensorNetwork.connections.filter(
                (conn) =>
                  conn.from.legoId !== currentLego.instance_id &&
                  conn.to.legoId !== currentLego.instance_id
              );
              get().setTensorNetwork(
                new TensorNetwork({
                  legos: newLegos,
                  connections: newConnections
                })
              );
            }
          } else {
            // Add lego to tensor network
            const newLegos = [...tensorNetwork.legos, currentLego];
            const newConnections = get().connections.filter(
              (conn) =>
                newLegos.some((l) => l.instance_id === conn.from.legoId) &&
                newLegos.some((l) => l.instance_id === conn.to.legoId)
            );

            get().setTensorNetwork(
              new TensorNetwork({
                legos: newLegos,
                connections: newConnections
              })
            );
          }
        } else {
          // If no tensor network exists, create one with just this lego
          get().setTensorNetwork(
            new TensorNetwork({ legos: [currentLego], connections: [] })
          );
        }
      } else {
        // Regular click behavior
        const isCurrentlySelected = get().tensorNetwork?.legos.some(
          (l) => l.instance_id === lego.instance_id
        );

        if (isCurrentlySelected && get().tensorNetwork?.legos.length === 1) {
          // Second click on same already selected lego - expand to connected component
          // Find the current version of the lego from droppedLegos to avoid stale state
          const currentLego = get().droppedLegos.find(
            (l) => l.instance_id === lego.instance_id
          );
          if (!currentLego) return;

          const network = findConnectedComponent(
            currentLego,
            get().droppedLegos,
            get().connections
          );
          // only set tensor network if there are more than 1 legos in the network
          if (network.legos.length > 1) {
            get().setTensorNetwork(network);
          }
        } else {
          // First click on unselected lego or clicking different lego - select just this lego
          // Find the current version of the lego from droppedLegos to avoid stale state
          const currentLego = get().droppedLegos.find(
            (l) => l.instance_id === lego.instance_id
          );
          if (!currentLego) return;

          get().setTensorNetwork(
            new TensorNetwork({ legos: [currentLego], connections: [] })
          );
        }
      }
    }
  },

  handleLegoMouseDown: (
    instance_id: string,
    x: number,
    y: number,
    shiftKey: boolean
  ) => {
    // Get lego from store instead of passed prop
    const lego = get().droppedLegos.find((l) => l.instance_id === instance_id);
    if (!lego) return;

    if (shiftKey) {
      get().handleClone(lego, x, y);
    } else {
      const isPartOfSelection = get().tensorNetwork?.legos.some(
        (l) => l.instance_id === lego.instance_id
      );

      if (isPartOfSelection && (get().tensorNetwork?.legos.length || 0) > 1) {
        // Dragging a selected lego - move the whole group
        const selectedLegos = get().tensorNetwork?.legos || [];
        const currentPositions: {
          [instance_id: string]: LogicalPoint;
        } = {};
        selectedLegos.forEach((l) => {
          currentPositions[l.instance_id] = l.logicalPosition;
        });

        get().setGroupDragState({
          legoInstanceIds: selectedLegos.map((l) => l.instance_id),
          originalPositions: currentPositions
        });
      } else {
        // For non-selected legos, don't set tensor network yet
        // It will be set when we actually start dragging (in mouse move)
        // Clear any existing group drag state
        get().setGroupDragState(null);
      }

      // not dragging yet but the index is set, so we can start dragging when the mouse moves
      get().setLegoDragState({
        draggingStage: DraggingStage.MAYBE_DRAGGING,
        draggedLegoInstanceId: lego.instance_id,
        startMouseWindowPoint: new WindowPoint(x, y),
        startLegoLogicalPoint: lego.logicalPosition
      });
    }
  }
});
