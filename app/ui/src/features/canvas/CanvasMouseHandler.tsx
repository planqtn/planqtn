import React, { useEffect } from "react";
import { useCanvasStore } from "../../stores/canvasStateStore";
import { Connection } from "../../lib/types";
import { useCanvasDragStateStore } from "../../stores/canvasDragStateStore";
import { TensorNetwork } from "../../lib/TensorNetwork";
import {
  findClosestDanglingLeg,
  findClosestConnection
} from "./canvasCalculations";
import { useDraggedLegoStore } from "../../stores/draggedLegoProtoStore";
import { useBuildingBlockDragStateStore } from "../../stores/buildingBlockDragStateStore";
import { DroppedLego, LegoPiece } from "../../stores/droppedLegoStore";
import { AddStopper } from "../../transformations/AddStopper";
import { useModalStore } from "../../stores/modalStore";
import { InjectTwoLegged } from "../../transformations/InjectTwoLegged";
import { useToast } from "@chakra-ui/react";
import { DraggingStage } from "../../stores/legoDragState";
import { useCanvasCoordinates } from "../../hooks/useCanvasCoordinates";
import {
  CanvasPoint,
  LogicalPoint,
  mouseEventToCanvasPoint,
  mouseEventToLogicalPoint
} from "../../types/coordinates";
import { useVisibleLegos } from "../../hooks/useVisibleLegos";

interface CanvasMouseHandlerProps {
  canvasRef: React.RefObject<HTMLDivElement | null>;
  selectionManagerRef: React.RefObject<{
    handleMouseDown: (e: MouseEvent) => void;
  } | null>;
  zoomLevel: number;
  altKeyPressed: boolean;
  handleDynamicLegoDrop: (
    draggedLego: LegoPiece,
    dropPosition: { x: number; y: number }
  ) => void;
}

export const CanvasMouseHandler: React.FC<CanvasMouseHandlerProps> = ({
  canvasRef,
  selectionManagerRef,
  zoomLevel,
  altKeyPressed,
  handleDynamicLegoDrop
}) => {
  // Zustand store selectors
  const {
    droppedLegos,
    moveDroppedLegos,
    setDroppedLegos,
    setLegosAndConnections,
    newInstanceId,
    addDroppedLego,
    connectedLegos,
    dragState,
    setDragState,
    connections,
    addConnections,
    addOperation,
    tensorNetwork,
    setTensorNetwork,
    groupDragState,
    setGroupDragState,
    legDragState,
    setLegDragState,
    selectionBox,
    hoveredConnection,
    setHoveredConnection,
    setError
  } = useCanvasStore();
  const { canvasDragState, setCanvasDragState } = useCanvasDragStateStore();
  const { draggedLegoProto: draggedLego, setDraggedLegoProto: setDraggedLego } =
    useDraggedLegoStore();
  const {
    buildingBlockDragState,
    setBuildingBlockDragState,
    clearBuildingBlockDragState
  } = useBuildingBlockDragStateStore();
  const toast = useToast();

  const { openCustomLegoDialog } = useModalStore();

  // Use the new coordinate system
  const { viewport } = useCanvasCoordinates(canvasRef);
  const visibleLegos = useVisibleLegos();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Drag update handler
    const performDragUpdate = (e: MouseEvent) => {
      if (!dragState) return;
      if (dragState.draggedLegoIndex === -1) return;

      // Use coordinate system utilities for consistent transformation

      const mouseLogicalPoint = mouseEventToLogicalPoint(
        e,
        canvasRef,
        viewport.zoomLevel,
        viewport.logicalPanOffset
      );
      if (!mouseLogicalPoint) return;

      const logicalDelta = mouseLogicalPoint.minus(dragState.originalPoint);
      const newLogicalPoint = dragState.originalPoint.plus(logicalDelta);

      // Get the dragged lego BEFORE updating the array to avoid stale references
      const draggedLego = visibleLegos[dragState.draggedLegoIndex];

      const legosToUpdate = droppedLegos.filter(
        (lego, index) =>
          index === dragState.draggedLegoIndex ||
          groupDragState?.legoInstanceIds.includes(lego.instanceId)
      );

      const updatedLegos = legosToUpdate.map((lego) => {
        if (
          groupDragState &&
          groupDragState.legoInstanceIds.includes(lego.instanceId)
        ) {
          // Move all selected legos together using canvas deltas
          const originalPos = groupDragState.originalPositions[lego.instanceId];
          return {
            oldLego: lego,
            updatedLego: lego.with({
              logicalPosition: new LogicalPoint(
                originalPos.x + logicalDelta.x,
                originalPos.y + logicalDelta.y
              )
            })
          };
        }

        return {
          oldLego: lego,
          updatedLego: lego.with({ logicalPosition: newLogicalPoint })
        };
      });

      moveDroppedLegos(updatedLegos.map((lego) => lego.updatedLego));
      addOperation({
        type: "move",
        data: {
          legosToUpdate: updatedLegos.map((update) => ({
            oldLego: update.oldLego,
            newLego: update.updatedLego
          }))
        }
      });

      if (groupDragState) {
        if (tensorNetwork) {
          const updatedNetworkLegos = updatedLegos
            .filter((update) =>
              groupDragState.legoInstanceIds.includes(
                update.updatedLego.instanceId
              )
            )
            .map((update) => update.updatedLego);

          // Create a new tensor network instead of mutating the existing one
          setTensorNetwork(
            new TensorNetwork({
              legos: updatedNetworkLegos,
              connections: tensorNetwork.connections
            })
          );
        }
      }

      // Handle connection hover detection using proper coordinate transformation
      if (draggedLego) {
        const draggedLegoHasConnections = connectedLegos.some(
          (lego) => lego.instanceId === draggedLego.instanceId
        );

        // Convert mouse position to canvas coordinates for comparison
        const mouseLogicalPoint = mouseEventToLogicalPoint(
          e,
          canvasRef,
          viewport.zoomLevel,
          viewport.logicalPanOffset
        );
        if (!mouseLogicalPoint) return;
        const canvasCoords = viewport.convertToCanvasPoint(mouseLogicalPoint);

        if (draggedLego.numberOfLegs === 2 && !draggedLegoHasConnections) {
          const closestConnection = findClosestConnection(
            canvasCoords,
            droppedLegos,
            connections
          );

          setHoveredConnection(closestConnection);
        } else if (
          draggedLego.id.includes("stopper") &&
          !draggedLegoHasConnections
        ) {
          // Find the closest dangling leg for stoppers using canvas coordinates
          const closestLeg = findClosestDanglingLeg(
            canvasCoords,
            droppedLegos,
            connections
          );
          if (closestLeg) {
            const pos =
              closestLeg.lego.style!.legStyles[closestLeg.legIndex].position;
            const legX = closestLeg.lego.logicalPosition.x + pos.endX;
            const legY = closestLeg.lego.logicalPosition.y + pos.endY;
            const distance = Math.sqrt(
              Math.pow(canvasCoords.x - legX, 2) +
                Math.pow(canvasCoords.y - legY, 2)
            );

            // Scale threshold with zoom level for consistent interaction
            const threshold = 20 / zoomLevel;
            if (distance < threshold) {
              setHoveredConnection(
                new Connection(
                  {
                    legoId: closestLeg.lego.instanceId,
                    legIndex: closestLeg.legIndex
                  },
                  { legoId: draggedLego.instanceId, legIndex: 0 }
                )
              );
            } else {
              setHoveredConnection(null);
            }
          } else {
            setHoveredConnection(null);
          }
        }
      }
    };

    // Mouse event handlers
    const handleMouseDown = (e: MouseEvent) => {
      if (e.target === canvas) {
        if (!e.altKey) {
          if (selectionManagerRef.current?.handleMouseDown) {
            selectionManagerRef.current.handleMouseDown(e);
          }
        } else {
          // Use coordinate system for canvas HTML coordinates
          const canvasHtmlPoint = mouseEventToCanvasPoint(e, canvasRef);
          if (!canvasHtmlPoint) return;
          setCanvasDragState({
            isDragging: true,
            startX: canvasHtmlPoint.x,
            startY: canvasHtmlPoint.y,
            currentX: canvasHtmlPoint.x,
            currentY: canvasHtmlPoint.y
          });
        }
      }
    };

    const handleCanvasClick = (e: MouseEvent) => {
      // Clear selection when clicking on empty canvas
      if (e.target === e.currentTarget && tensorNetwork) {
        if (dragState?.draggingStage === DraggingStage.JUST_FINISHED) {
          setDragState({
            draggingStage: DraggingStage.NOT_DRAGGING,
            draggedLegoIndex: -1,
            originalPoint: new LogicalPoint(0, 0),
            startX: 0,
            startY: 0
          });
        } else {
          setTensorNetwork(null);
        }
      }
    };

    const handleMouseMove = (e: MouseEvent) => {
      // Selection box dragging is now handled by SelectionManager
      if (selectionBox.isSelecting) return;
      if (canvasDragState?.isDragging) {
        // Use coordinate system for consistent canvas HTML coordinates
        const currentCanvasHtmlPoint = mouseEventToCanvasPoint(e, canvasRef);
        if (!currentCanvasHtmlPoint) return;

        const deltaScreenX = currentCanvasHtmlPoint.x - canvasDragState.startX;
        const deltaScreenY = currentCanvasHtmlPoint.y - canvasDragState.startY;

        // Transform screen delta to canvas delta for zoom-aware movement
        const deltaCanvasX = deltaScreenX / zoomLevel;
        const deltaCanvasY = deltaScreenY / zoomLevel;

        setCanvasDragState({
          ...canvasDragState,
          startX: currentCanvasHtmlPoint.x,
          startY: currentCanvasHtmlPoint.y,
          currentX: currentCanvasHtmlPoint.x,
          currentY: currentCanvasHtmlPoint.y
        });

        // Update pan offset and move all legos using canvas deltas
        const { updatePanOffset } = useCanvasStore.getState();
        updatePanOffset(deltaCanvasX, deltaCanvasY);
      }
      // Check if we should start dragging
      if (
        dragState &&
        dragState.draggingStage === DraggingStage.MAYBE_DRAGGING
      ) {
        const deltaX = e.clientX - dragState.startX;
        const deltaY = e.clientY - dragState.startY;
        if (Math.abs(deltaX) > 1 || Math.abs(deltaY) > 1) {
          const draggedLego = droppedLegos[dragState.draggedLegoIndex];
          const isPartOfSelection = tensorNetwork?.legos.some(
            (l) => l.instanceId === draggedLego.instanceId
          );
          if (!isPartOfSelection) {
            setTensorNetwork(
              new TensorNetwork({ legos: [draggedLego], connections: [] })
            );
          }
          setDragState({ ...dragState, draggingStage: DraggingStage.DRAGGING });
        }
        return;
      }
      if (dragState && dragState.draggingStage === DraggingStage.DRAGGING) {
        // drag proxy handles the mouse move, we call performDragUpdate on mouseup
        return;
      }
      if (legDragState?.isDragging) {
        const canvasHtmlPoint = mouseEventToCanvasPoint(e, canvasRef);
        if (!canvasHtmlPoint) return;
        const mouseCanvasCoords =
          viewport.convertToCanvasPoint(canvasHtmlPoint);
        setLegDragState((prev) => ({
          ...prev!,
          currentX: mouseCanvasCoords.x,
          currentY: mouseCanvasCoords.y
        }));
      }
    };

    const handleMouseUp = async (e: MouseEvent) => {
      // If a leg is being dragged, we need to decide if we're dropping on a valid target or the canvas.
      if (legDragState?.isDragging) {
        const targetElement = e.target as HTMLElement;
        // Check if the mouse was released over an element with the 'leg-endpoint' class.
        // We use .closest() to handle cases where the event target might be a child element.
        if (!targetElement.closest(".leg-endpoint")) {
          // If not dropped on a leg-endpoint, it's a drop on the canvas, so cancel the drag.
          setLegDragState(null);
        }
        // In either case, the leg drag action is finished, so we stop further processing of this mouseup event.
        return;
      }

      if (canvasDragState?.isDragging) {
        setCanvasDragState({
          isDragging: false,
          startX: 0,
          startY: 0,
          currentX: 0,
          currentY: 0
        });
        return;
      }

      if (dragState && dragState.draggingStage === DraggingStage.DRAGGING) {
        e.stopPropagation();
        e.preventDefault();

        // Check if the dragged lego is a stopper and handle stopper logic
        const draggedLego = droppedLegos[dragState.draggedLegoIndex];

        if (draggedLego && draggedLego.id.includes("stopper")) {
          const canvasHtmlPoint = mouseEventToCanvasPoint(e, canvasRef);
          if (!canvasHtmlPoint) return;
          const dropCanvasCoords =
            viewport.convertToCanvasPoint(canvasHtmlPoint);

          // Try to attach stopper to a nearby leg, passing the existing lego to be removed
          const success = handleDropStopperOnLeg(
            dropCanvasCoords,
            draggedLego,
            draggedLego
          );
          if (!success) {
            // If stopper attachment fails, just do regular drag update
            performDragUpdate(e);
          }
        } else if (draggedLego && draggedLego.numberOfLegs === 2) {
          // Handle two-legged lego insertion into connection
          const canvasHtmlPoint = mouseEventToCanvasPoint(e, canvasRef);
          if (!canvasHtmlPoint) return;
          const dropCanvasCoords =
            viewport.convertToCanvasPoint(canvasHtmlPoint);

          const closestConnection = findClosestConnection(
            dropCanvasCoords,
            droppedLegos,
            connections
          );

          // Check if this lego already has connections - if so, just do regular move
          const hasExistingConnections = connectedLegos.some(
            (lego) => lego.instanceId === draggedLego.instanceId
          );

          if (hasExistingConnections || !closestConnection) {
            // Lego already has connections, just do regular move
            performDragUpdate(e);
          } else {
            // Use shared two-legged insertion logic for unconnected legos
            const success = await handleTwoLeggedInsertion(
              draggedLego,
              dropCanvasCoords,
              closestConnection,
              draggedLego
            );
            if (!success) {
              // If injection fails, fall back to regular drag update
              performDragUpdate(e);
            }
          }
        } else {
          // Not a stopper or two-legged with connection, do regular drag update
          performDragUpdate(e);
        }

        setDragState({
          draggingStage: DraggingStage.JUST_FINISHED,
          draggedLegoIndex: -1,
          startX: 0,
          startY: 0,
          originalPoint: new LogicalPoint(0, 0)
        });
        setGroupDragState(null);
      } else if (dragState && dragState.draggedLegoIndex !== -1) {
        setDragState({
          draggingStage: DraggingStage.NOT_DRAGGING,
          draggedLegoIndex: -1,
          startX: 0,
          startY: 0,
          originalPoint: new LogicalPoint(0, 0)
        });
        setGroupDragState(null);
      }
    };

    const handleMouseLeave = () => {
      if (dragState && dragState.draggingStage === DraggingStage.DRAGGING) {
        setDragState({
          draggingStage: DraggingStage.NOT_DRAGGING,
          draggedLegoIndex: -1,
          startX: 0,
          startY: 0,
          originalPoint: new LogicalPoint(0, 0)
        });
        setGroupDragState(null);
      }
      if (legDragState?.isDragging) {
        setLegDragState(null);
      }
      if (canvasDragState?.isDragging) {
        setCanvasDragState({
          isDragging: false,
          startX: 0,
          startY: 0,
          currentX: 0,
          currentY: 0
        });
      }
    };

    // Add handlers for stable drag enter/leave
    const handleCanvasDragEnter = (e: DragEvent) => {
      e.preventDefault();
      // setBuildingBlockDragState((prev) => ({
      //   ...prev,
      //   dragEnterCounter: prev.dragEnterCounter + 1
      // }));
    };

    const handleCanvasDragLeave = (e: DragEvent) => {
      e.preventDefault();
      // setBuildingBlockDragState((prev) => ({
      //   ...prev,
      //   dragEnterCounter: prev.dragEnterCounter - 1
      // }));
      // if (buildingBlockDragState.dragEnterCounter <= 0) {
      //   setBuildingBlockDragState((prev) => ({
      //     ...prev,
      //     dragEnterCounter: 0
      //   }));
      // }
    };

    const handleGlobalDragEnd = () => {
      if (buildingBlockDragState.isDragging) {
        clearBuildingBlockDragState();
      }
    };

    const handleDragOver = (e: DragEvent) => {
      e.preventDefault();

      const canvasRect = canvas.getBoundingClientRect();

      if (!canvasRect) return;

      // Update building block drag state with current mouse position
      if (buildingBlockDragState.isDragging) {
        setBuildingBlockDragState((prev) => ({
          ...prev,
          mouseX: e.clientX,
          mouseY: e.clientY
        }));
      }

      // Use the draggedLego state instead of trying to get data from dataTransfer
      if (!draggedLego) return;
    };

    const handleTwoLeggedInsertion = async (
      lego: DroppedLego,
      dropPosition: CanvasPoint,
      connection: Connection,
      existingLegoToRemove?: DroppedLego
    ): Promise<boolean> => {
      try {
        console.log("handleTwoLeggedInsertion", lego, dropPosition, connection);
        const logicalDropPosition =
          viewport.convertToLogicalPoint(dropPosition);
        // Create the lego at the drop position
        const repositionedLego = new DroppedLego(
          lego,
          logicalDropPosition,
          existingLegoToRemove?.instanceId || newInstanceId()
        );

        // Remove the original lego if we're moving an existing one
        const legosForCalculation = existingLegoToRemove
          ? droppedLegos.filter(
              (l) => l.instanceId !== existingLegoToRemove.instanceId
            )
          : droppedLegos;

        const trafo = new InjectTwoLegged(connections, legosForCalculation);
        const result = await trafo.apply(repositionedLego, connection);

        addOperation(result.operation);
        setLegosAndConnections(result.droppedLegos, result.connections);
        return true;
      } catch (error) {
        setError(`${error}`);
        console.error(error);
        return false;
      }
    };

    const handleDropStopperOnLeg = (
      dropPosition: CanvasPoint,
      draggedLego: LegoPiece,
      existingLegoToRemove?: DroppedLego
    ): boolean => {
      if (draggedLego.id.includes("stopper")) {
        const logicalDropPosition =
          viewport.convertToLogicalPoint(dropPosition);
        const closestLeg = findClosestDanglingLeg(
          logicalDropPosition,
          droppedLegos,
          connections
        );
        if (!closestLeg) {
          return false;
        }

        try {
          // If we're moving an existing stopper, remove it first
          const legosForCalculation = existingLegoToRemove
            ? droppedLegos.filter(
                (lego) => lego.instanceId !== existingLegoToRemove.instanceId
              )
            : droppedLegos;

          // Create the stopper lego (new or repositioned)
          const stopperLego: DroppedLego = new DroppedLego(
            draggedLego,
            logicalDropPosition,
            existingLegoToRemove?.instanceId || newInstanceId()
          );

          const addStopper = new AddStopper(connections, legosForCalculation);
          const result = addStopper.apply(
            closestLeg.lego,
            closestLeg.legIndex,
            stopperLego
          );
          setLegosAndConnections(result.droppedLegos, result.connections);
          addOperation(result.operation);
          return true;
        } catch (error) {
          console.error("Failed to add stopper:", error);
          toast({
            title: "Error",
            description:
              error instanceof Error ? error.message : "Failed to add stopper",
            status: "error",
            duration: 3000,
            isClosable: true
          });
          return false;
        }
      }
      return false;
    };

    // Add a handler for when drag ends
    const handleDragEnd = () => {
      setDraggedLego(null);
      setHoveredConnection(null);
      setBuildingBlockDragState({
        isDragging: false,
        draggedLego: null,
        mouseX: 0,
        mouseY: 0,
        dragEnterCounter: 0
      });
    };

    const handleDrop = async (e: DragEvent) => {
      if (!draggedLego) return;

      // Get the actual drop position from the event using canvas coordinates
      const canvasDropPos = mouseEventToCanvasPoint(
        e as unknown as MouseEvent,
        canvasRef
      );
      if (!canvasDropPos) return;
      const logicalDropPos = viewport.convertToLogicalPoint(canvasDropPos);

      if (draggedLego.id === "custom") {
        openCustomLegoDialog(logicalDropPos);
        return;
      }

      // Find the closest dangling leg if we're dropping a stopper
      const success = handleDropStopperOnLeg(logicalDropPos, draggedLego);
      if (success) return;

      const numLegs = draggedLego.parity_check_matrix[0].length / 2;

      if (draggedLego.is_dynamic) {
        handleDynamicLegoDrop(draggedLego, logicalDropPos);
        setDraggedLego(null);

        return;
      }

      // Use the drop position directly from the event
      const newLego = new DroppedLego(
        draggedLego,
        logicalDropPos,
        newInstanceId()
      );

      // Handle two-legged lego insertion
      if (numLegs === 2 && hoveredConnection) {
        await handleTwoLeggedInsertion(
          newLego,
          logicalDropPos,
          hoveredConnection
        );
      } else {
        // If it's a custom lego, show the dialog after dropping
        if (draggedLego.id === "custom") {
          openCustomLegoDialog(logicalDropPos);
        } else {
          addDroppedLego(newLego);
          addOperation({
            type: "add",
            data: { legosToAdd: [newLego] }
          });
        }
      }

      setHoveredConnection(null);
      setDraggedLego(null);
    };

    canvas.addEventListener("dragover", handleDragOver);
    canvas.addEventListener("dragenter", handleCanvasDragEnter);
    canvas.addEventListener("dragleave", handleCanvasDragLeave);
    canvas.addEventListener("dragend", handleDragEnd);
    canvas.addEventListener("mousedown", handleMouseDown);
    canvas.addEventListener("mousemove", handleMouseMove);
    canvas.addEventListener("mouseup", handleMouseUp);
    canvas.addEventListener("mouseleave", handleMouseLeave);
    canvas.addEventListener("click", handleCanvasClick);
    document.addEventListener("dragend", handleGlobalDragEnd);
    canvas.addEventListener("drop", handleDrop);

    return () => {
      canvas.removeEventListener("dragover", handleDragOver);
      canvas.addEventListener("dragenter", handleCanvasDragEnter);
      canvas.addEventListener("dragleave", handleCanvasDragLeave);
      canvas.removeEventListener("dragend", handleDragEnd);
      canvas.removeEventListener("mousedown", handleMouseDown);
      canvas.removeEventListener("mousemove", handleMouseMove);
      canvas.removeEventListener("mouseup", handleMouseUp);
      canvas.removeEventListener("mouseleave", handleMouseLeave);
      canvas.removeEventListener("click", handleCanvasClick);
      document.removeEventListener("dragend", handleGlobalDragEnd);
      canvas.removeEventListener("drop", handleDrop);
    };
  }, [
    canvasRef,
    selectionManagerRef,
    droppedLegos,
    tensorNetwork,
    legDragState,
    groupDragState,
    selectionBox,
    canvasDragState,
    buildingBlockDragState,
    zoomLevel,
    altKeyPressed,
    connections,
    setCanvasDragState,
    setDroppedLegos,
    setLegDragState,
    setTensorNetwork,
    dragState,
    setDragState,
    setGroupDragState,
    addOperation,
    addConnections,
    setHoveredConnection
  ]);

  return null;
};
