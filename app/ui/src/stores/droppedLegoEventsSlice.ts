import { StateCreator } from "zustand";
import { DroppedLego } from "./droppedLegoStore";
import { CanvasStore } from "./canvasStateStore";
import { DraggingStage } from "./legoDragState";
import { findConnectedComponent, TensorNetwork } from "../lib/TensorNetwork";

export interface DroppedLegoClickHandlerSlice {
  handleLegoClick: (
    lego: DroppedLego,
    ctrlKey: boolean,
    metaKey: boolean
  ) => void;
  handleLegoMouseDown: (
    index: number,
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
    // Get the current global drag state
    const currentDragState = get().dragState;

    if (currentDragState.draggingStage === DraggingStage.JUST_FINISHED) {
      get().setDragState({
        draggingStage: DraggingStage.NOT_DRAGGING,
        draggedLegoIndex: -1,
        startX: 0,
        startY: 0,
        originalX: 0,
        originalY: 0
      });
      return;
    }

    if (currentDragState.draggingStage !== DraggingStage.DRAGGING) {
      // Only handle click if not dragging

      // Clear the drag state since this is a click, not a drag
      get().setDragState({
        draggingStage: DraggingStage.NOT_DRAGGING,
        draggedLegoIndex: -1,
        startX: 0,
        startY: 0,
        originalX: 0,
        originalY: 0
      });

      if (ctrlKey || metaKey) {
        // Handle Ctrl+click for toggling selection
        // Find the current version of the lego from droppedLegos to avoid stale state
        const currentLego = get().droppedLegos.find(
          (l) => l.instanceId === lego.instanceId
        );
        if (!currentLego) return;

        const tensorNetwork = get().tensorNetwork;
        if (tensorNetwork) {
          const isSelected = tensorNetwork.legos.some(
            (l) => l.instanceId === currentLego.instanceId
          );
          if (isSelected) {
            // Remove lego from tensor network
            const newLegos = tensorNetwork.legos.filter(
              (l) => l.instanceId !== currentLego.instanceId
            );

            if (newLegos.length === 0) {
              get().setTensorNetwork(null);
            } else {
              const newConnections = tensorNetwork.connections.filter(
                (conn) =>
                  conn.from.legoId !== currentLego.instanceId &&
                  conn.to.legoId !== currentLego.instanceId
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
                newLegos.some((l) => l.instanceId === conn.from.legoId) &&
                newLegos.some((l) => l.instanceId === conn.to.legoId)
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
          (l) => l.instanceId === lego.instanceId
        );

        if (isCurrentlySelected && get().tensorNetwork?.legos.length === 1) {
          // Second click on same already selected lego - expand to connected component
          // Find the current version of the lego from droppedLegos to avoid stale state
          const currentLego = get().droppedLegos.find(
            (l) => l.instanceId === lego.instanceId
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
            (l) => l.instanceId === lego.instanceId
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
    index: number,
    x: number,
    y: number,
    shiftKey: boolean
  ) => {
    // Get lego from store instead of passed prop
    const lego = get().droppedLegos[index];

    if (shiftKey) {
      get().handleClone(lego, x, y);
    } else {
      const isPartOfSelection = get().tensorNetwork?.legos.some(
        (l) => l.instanceId === lego.instanceId
      );

      if (isPartOfSelection && (get().tensorNetwork?.legos.length || 0) > 1) {
        // Dragging a selected lego - move the whole group
        const selectedLegos = get().tensorNetwork?.legos || [];
        const currentPositions: {
          [instanceId: string]: { x: number; y: number };
        } = {};
        selectedLegos.forEach((l) => {
          currentPositions[l.instanceId] = { x: l.x, y: l.y };
        });

        get().setGroupDragState({
          legoInstanceIds: selectedLegos.map((l) => l.instanceId),
          originalPositions: currentPositions
        });
      } else {
        // For non-selected legos, don't set tensor network yet
        // It will be set when we actually start dragging (in mouse move)
        // Clear any existing group drag state
        get().setGroupDragState(null);
      }

      // not dragging yet but the index is set, so we can start dragging when the mouse moves
      get().setDragState({
        draggingStage: DraggingStage.MAYBE_DRAGGING,
        draggedLegoIndex: index,
        startX: x,
        startY: y,
        originalX: lego.x,
        originalY: lego.y
      });
    }
  }
});
