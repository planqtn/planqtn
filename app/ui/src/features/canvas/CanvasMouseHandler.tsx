import React, { useEffect } from "react";
import { useCanvasStore } from "../../stores/canvasStateStore";
import { Connection } from "../../lib/types";
import { useCanvasDragStateStore } from "../../stores/canvasDragStateStore";
import { TensorNetwork } from "../../lib/TensorNetwork";
import {
  findClosestDanglingLeg,
  pointToLineDistance
} from "./canvasCalculations";
import { useDraggedLegoStore } from "../../stores/draggedLegoProtoStore";
import { useBuildingBlockDragStateStore } from "../../stores/buildingBlockDragStateStore";
import { DroppedLego, LegoPiece } from "../../stores/droppedLegoStore";
import { AddStopper } from "../../transformations/AddStopper";
import { useModalStore } from "../../stores/modalStore";
import { InjectTwoLegged } from "../../transformations/InjectTwoLegged";
import { useToast } from "@chakra-ui/react";
import { DraggingStage } from "../../stores/legoDragState";

interface CanvasMouseHandlerProps {
  canvasRef: React.RefObject<HTMLDivElement | null>;
  selectionManagerRef: React.RefObject<{
    handleMouseDown: (e: MouseEvent) => void;
  } | null>;
  zoomLevel: number;
  altKeyPressed: boolean;
  setHoveredConnection: (connection: Connection | null) => void;
  handleDynamicLegoDrop: (
    draggedLego: LegoPiece,
    dropPosition: { x: number; y: number }
  ) => void;
  setError: (error: string) => void;
  hoveredConnection: Connection | null;
}

export const CanvasMouseHandler: React.FC<CanvasMouseHandlerProps> = ({
  canvasRef,
  selectionManagerRef,
  zoomLevel,
  altKeyPressed,
  setHoveredConnection,
  handleDynamicLegoDrop,
  setError,
  hoveredConnection
}) => {
  // Zustand store selectors
  const {
    droppedLegos,
    updateDroppedLegos,
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
    selectionBox
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

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Drag update handler
    const performDragUpdate = (e: MouseEvent) => {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;
      if (!dragState) return;
      if (dragState.draggedLegoIndex === -1) return;

      const deltaX = e.clientX - dragState.startX;
      const deltaY = e.clientY - dragState.startY;
      const newX = dragState.originalX + deltaX;
      const newY = dragState.originalY + deltaY;

      // Get the dragged lego BEFORE updating the array to avoid stale references
      const draggedLego = droppedLegos[dragState.draggedLegoIndex];

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
          // Move all selected legos together
          const originalPos = groupDragState.originalPositions[lego.instanceId];
          return {
            oldLego: lego,
            updatedLego: lego.with({
              x: originalPos.x + deltaX,
              y: originalPos.y + deltaY
            })
          };
        }

        return {
          oldLego: lego,
          updatedLego: lego.with({ x: newX, y: newY })
        };
      });

      updateDroppedLegos(updatedLegos.map((lego) => lego.updatedLego));
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

      // Handle connection hover detection using the original draggedLego position
      if (draggedLego) {
        const draggedLegoHasConnections = connections.some((conn) =>
          conn.containsLego(draggedLego.instanceId)
        );
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        if (draggedLego.numberOfLegs === 2 && !draggedLegoHasConnections) {
          // Find the closest connection for two-legged legos
          let closestConnection: Connection | null = null;
          let minDistance = Infinity;

          connections.forEach((conn) => {
            const fromLego = droppedLegos.find(
              (l) => l.instanceId === conn.from.legoId
            );
            const toLego = droppedLegos.find(
              (l) => l.instanceId === conn.to.legoId
            );
            if (!fromLego || !toLego) return;

            const fromPos =
              fromLego.style!.legStyles[conn.from.legIndex].position;
            const toPos = toLego.style!.legStyles[conn.to.legIndex].position;

            const fromPoint = {
              x: fromLego.x + fromPos.endX,
              y: fromLego.y + fromPos.endY
            };
            const toPoint = {
              x: toLego.x + toPos.endX,
              y: toLego.y + toPos.endY
            };

            const distance = pointToLineDistance(
              x,
              y,
              fromPoint.x,
              fromPoint.y,
              toPoint.x,
              toPoint.y
            );
            if (distance < minDistance && distance < 20) {
              minDistance = distance;
              closestConnection = conn;
            }
          });

          setHoveredConnection(closestConnection);
        } else if (
          draggedLego.id.includes("stopper") &&
          !draggedLegoHasConnections
        ) {
          // Find the closest dangling leg for stoppers
          const closestLeg = findClosestDanglingLeg(
            { x, y },
            droppedLegos,
            connections
          );
          if (closestLeg) {
            const pos =
              closestLeg.lego.style!.legStyles[closestLeg.legIndex].position;
            const legX = closestLeg.lego.x + pos.endX;
            const legY = closestLeg.lego.y + pos.endY;
            const distance = Math.sqrt(
              Math.pow(x - legX, 2) + Math.pow(y - legY, 2)
            );

            if (distance < 20) {
              // 20 pixels threshold
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
        const rect = canvas.getBoundingClientRect();
        if (!rect) return;
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        if (!e.altKey) {
          if (selectionManagerRef.current?.handleMouseDown) {
            selectionManagerRef.current.handleMouseDown(e);
          }
        } else {
          setCanvasDragState({
            isDragging: true,
            startX: x,
            startY: y,
            currentX: x,
            currentY: y
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
            startX: 0,
            startY: 0,
            originalX: 0,
            originalY: 0
          });
        } else {
          setTensorNetwork(null);
        }
      }
    };

    const handleMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      if (!rect) return;
      // Selection box dragging is now handled by SelectionManager
      if (selectionBox.isSelecting) return;
      if (canvasDragState?.isDragging) {
        const newX = e.clientX - rect.left;
        const newY = e.clientY - rect.top;
        const deltaX = newX - canvasDragState.startX;
        const deltaY = newY - canvasDragState.startY;
        setCanvasDragState({
          ...canvasDragState,
          startX: newX,
          startY: newY,
          currentX: newX,
          currentY: newY
        });
        const movedLegos = droppedLegos.map((lego) =>
          lego.with({ x: lego.x + deltaX, y: lego.y + deltaY })
        );
        setDroppedLegos(movedLegos);
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
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        setLegDragState((prev) => ({
          ...prev!,
          currentX: mouseX,
          currentY: mouseY
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

      const rect = canvas.getBoundingClientRect();
      if (!rect) {
        setLegDragState(null);
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
          const dropPosition = {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
          };

          // Try to attach stopper to a nearby leg, passing the existing lego to be removed
          const success = handleDropStopperOnLeg(
            dropPosition,
            draggedLego,
            draggedLego
          );
          if (!success) {
            // If stopper attachment fails, just do regular drag update
            performDragUpdate(e);
          }
        } else if (
          draggedLego &&
          draggedLego.numberOfLegs === 2 &&
          hoveredConnection
        ) {
          // Handle two-legged lego insertion into connection
          const dropPosition = {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
          };

          // Check if this lego already has connections - if so, just do regular move
          const hasExistingConnections = connectedLegos.some(
            (lego) => lego.instanceId === draggedLego.instanceId
          );

          if (hasExistingConnections) {
            // Lego already has connections, just do regular move
            performDragUpdate(e);
          } else {
            // Use shared two-legged insertion logic for unconnected legos
            const success = await handleTwoLeggedInsertion(
              draggedLego,
              dropPosition,
              hoveredConnection,
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
          originalX: 0,
          originalY: 0
        });
        setGroupDragState(null);
      } else if (dragState && dragState.draggedLegoIndex !== -1) {
        setDragState({
          draggingStage: DraggingStage.NOT_DRAGGING,
          draggedLegoIndex: -1,
          startX: 0,
          startY: 0,
          originalX: 0,
          originalY: 0
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
          originalX: 0,
          originalY: 0
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

      const numLegs = draggedLego.parity_check_matrix[0].length / 2;

      // Only handle two-legged legos
      if (numLegs !== 2) return;

      const x = e.clientX - canvasRect.left;
      const y = e.clientY - canvasRect.top;

      // Find the closest connection
      let closestConnection: Connection | null = null;
      let minDistance = Infinity;

      connections.forEach((conn) => {
        const fromLego = droppedLegos.find(
          (l) => l.instanceId === conn.from.legoId
        );
        const toLego = droppedLegos.find(
          (l) => l.instanceId === conn.to.legoId
        );
        if (!fromLego || !toLego) return;

        const fromPos = fromLego.style!.legStyles[conn.from.legIndex].position;
        const toPos = toLego.style!.legStyles[conn.to.legIndex].position;

        const fromPoint = {
          x: fromLego.x + fromPos.endX,
          y: fromLego.y + fromPos.endY
        };
        const toPoint = {
          x: toLego.x + toPos.endX,
          y: toLego.y + toPos.endY
        };

        // Calculate distance from point to line segment
        const distance = pointToLineDistance(
          x,
          y,
          fromPoint.x,
          fromPoint.y,
          toPoint.x,
          toPoint.y
        );
        if (distance < minDistance && distance < 20) {
          // 20 pixels threshold
          minDistance = distance;
          closestConnection = conn;
        }
      });

      setHoveredConnection(closestConnection);
    };

    const handleTwoLeggedInsertion = async (
      lego: DroppedLego,
      dropPosition: { x: number; y: number },
      connection: Connection,
      existingLegoToRemove?: DroppedLego
    ): Promise<boolean> => {
      try {
        // Create the lego at the drop position
        const repositionedLego = new DroppedLego(
          lego,
          dropPosition.x,
          dropPosition.y,
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
      dropPosition: { x: number; y: number },
      draggedLego: LegoPiece,
      existingLegoToRemove?: DroppedLego
    ): boolean => {
      if (draggedLego.id.includes("stopper")) {
        const closestLeg = findClosestDanglingLeg(
          dropPosition,
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
            dropPosition.x,
            dropPosition.y,
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

      // Get the actual drop position from the event using canvas rect, not target rect
      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const dropPosition = {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      };

      if (draggedLego.id === "custom") {
        openCustomLegoDialog(dropPosition);
        return;
      }

      // Find the closest dangling leg if we're dropping a stopper
      const success = handleDropStopperOnLeg(dropPosition, draggedLego);
      if (success) return;

      const numLegs = draggedLego.parity_check_matrix[0].length / 2;

      if (draggedLego.is_dynamic) {
        handleDynamicLegoDrop(draggedLego, dropPosition);
        setDraggedLego(null);

        return;
      }

      // Use the drop position directly from the event
      const newLego = new DroppedLego(
        draggedLego,
        dropPosition.x,
        dropPosition.y,
        newInstanceId()
      );

      // Handle two-legged lego insertion
      if (numLegs === 2 && hoveredConnection) {
        await handleTwoLeggedInsertion(
          newLego,
          dropPosition,
          hoveredConnection
        );
      } else {
        console.log("Dropped lego", newLego, new Error("debug").stack);
        // If it's a custom lego, show the dialog after dropping
        if (draggedLego.id === "custom") {
          openCustomLegoDialog({ x: dropPosition.x, y: dropPosition.y });
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
    updateDroppedLegos,
    addOperation,
    addConnections,
    setHoveredConnection
  ]);

  return null;
};
