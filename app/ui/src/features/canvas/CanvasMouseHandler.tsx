import React, { useEffect } from "react";
import { useCanvasStore } from "../../stores/canvasStateStore";
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
import { LogicalPoint, WindowPoint } from "../../types/coordinates";
import { useDebugStore } from "../../stores/debugStore";

interface CanvasMouseHandlerProps {
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
    legoDragState,
    setLegoDragState,
    resetLegoDragState,
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
    setError,
    viewport,
    canvasRef
  } = useCanvasStore();

  const { canvasDragState, setCanvasDragState, resetCanvasDragState } =
    useCanvasDragStateStore();
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
    // Drag update handler
    const performDragUpdate = (e: MouseEvent) => {
      if (!legoDragState) return;
      if (legoDragState.draggedLegoInstanceId === "") return;

      // Use coordinate system utilities for consistent transformation

      const mouseLogicalPoint = viewport.fromWindowToLogical(
        WindowPoint.fromMouseEvent(e)
      );
      if (!mouseLogicalPoint) return;

      const logicalDelta = mouseLogicalPoint.minus(
        legoDragState.startLegoLogicalPoint
      );
      const newLogicalPoint =
        legoDragState.startLegoLogicalPoint.plus(logicalDelta);

      // Get the dragged lego BEFORE updating the array to avoid stale references
      const draggedLego = droppedLegos.find(
        (lego) => lego.instanceId === legoDragState.draggedLegoInstanceId
      );
      if (!draggedLego) return;

      const legosToUpdate = droppedLegos.filter(
        (lego) =>
          lego.instanceId === legoDragState.draggedLegoInstanceId ||
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
    };

    // Mouse event handlers
    const handleMouseDown = (e: MouseEvent) => {
      if (e.target === canvasRef?.current) {
        if (!e.altKey) {
          if (selectionManagerRef.current?.handleMouseDown) {
            selectionManagerRef.current.handleMouseDown(e);
          }
        } else {
          // Use coordinate system for canvas HTML coordinates
          setCanvasDragState({
            isDragging: true,
            mouseWindowPoint: WindowPoint.fromMouseEvent(e)
          });
        }
      }
    };

    const handleCanvasClick = (e: MouseEvent) => {
      // Clear selection when clicking on empty canvas
      if (e.target === e.currentTarget && tensorNetwork) {
        if (legoDragState?.draggingStage === DraggingStage.JUST_FINISHED) {
          resetLegoDragState();
        } else {
          setTensorNetwork(null);
        }
      }
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (import.meta.env.DEV) {
        const mouseWindowPoint = WindowPoint.fromMouseEvent(e);

        useDebugStore.getState().setDebugMousePos(mouseWindowPoint);
      }
      // Selection box dragging is now handled by SelectionManager
      if (selectionBox.isSelecting) return;
      if (canvasDragState?.isDragging) {
        // Use coordinate system for consistent canvas HTML coordinates
        const mouseWindowPoint = WindowPoint.fromMouseEvent(e);
        const mouseWindowLogicalPoint =
          viewport.fromWindowToLogical(mouseWindowPoint);

        setCanvasDragState({
          ...canvasDragState,
          mouseWindowPoint: mouseWindowPoint
        });

        const deltaMouseLogical = mouseWindowLogicalPoint
          .minus(viewport.fromWindowToLogical(canvasDragState.mouseWindowPoint))
          .factor(-1);

        // Update pan offset and move all legos using canvas deltas
        const { updatePanOffset } = useCanvasStore.getState();
        updatePanOffset(deltaMouseLogical);
      }
      // Check if we should start dragging
      if (
        legoDragState &&
        legoDragState.draggingStage === DraggingStage.MAYBE_DRAGGING
      ) {
        const mouseWindowPoint = WindowPoint.fromMouseEvent(e);
        const mouseDelta = mouseWindowPoint.minus(
          legoDragState.startMouseWindowPoint
        );
        if (Math.abs(mouseDelta.x) > 1 || Math.abs(mouseDelta.y) > 1) {
          const draggedLego = droppedLegos.find(
            (lego) => lego.instanceId === legoDragState.draggedLegoInstanceId
          );
          if (!draggedLego) return;
          const isPartOfSelection = tensorNetwork?.legos.some(
            (l) => l.instanceId === draggedLego.instanceId
          );
          if (!isPartOfSelection) {
            setTensorNetwork(
              new TensorNetwork({ legos: [draggedLego], connections: [] })
            );
          }
          setLegoDragState({
            ...legoDragState,
            draggingStage: DraggingStage.DRAGGING
          });
        }
        return;
      }
      if (
        legoDragState &&
        legoDragState.draggingStage === DraggingStage.DRAGGING
      ) {
        // drag proxy handles the mouse move, we call performDragUpdate on mouseup
        return;
      }
      if (legDragState?.isDragging) {
        const mouseWindowPoint = WindowPoint.fromMouseEvent(e);
        setLegDragState({
          ...legDragState,
          currentMouseWindowPoint: mouseWindowPoint
        });
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
        resetCanvasDragState();
        return;
      }

      if (
        legoDragState &&
        legoDragState.draggingStage === DraggingStage.DRAGGING
      ) {
        e.stopPropagation();
        e.preventDefault();

        // Check if the dragged lego is a stopper and handle stopper logic
        const draggedLego = droppedLegos.find(
          (lego) => lego.instanceId === legoDragState.draggedLegoInstanceId
        );
        if (!draggedLego) return;

        if (draggedLego && draggedLego.typeId.includes("stopper")) {
          // Try to attach stopper to a nearby leg, passing the existing lego to be removed
          const success = handleDropStopperOnLeg(
            viewport.fromWindowToLogical(WindowPoint.fromMouseEvent(e)),
            draggedLego,
            draggedLego
          );
          if (!success) {
            performDragUpdate(e);
          }
        } else if (draggedLego && draggedLego.numberOfLegs === 2) {
          const success = await handleTwoLeggedInsertion(
            draggedLego,
            viewport.fromWindowToLogical(WindowPoint.fromMouseEvent(e)),
            draggedLego
          );
          if (!success) {
            performDragUpdate(e);
          }
        } else {
          performDragUpdate(e);
        }

        resetLegoDragState(true);
        setGroupDragState(null);
      } else if (legoDragState && legoDragState.draggedLegoInstanceId !== "") {
        resetLegoDragState();
        setGroupDragState(null);
      }
    };

    const handleMouseLeave = () => {
      if (
        legoDragState &&
        legoDragState.draggingStage === DraggingStage.DRAGGING
      ) {
        resetLegoDragState();
        setGroupDragState(null);
      }
      if (legDragState?.isDragging) {
        setLegDragState(null);
      }
      if (canvasDragState?.isDragging) {
        resetCanvasDragState();
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

      const canvasRect = canvasRef?.current?.getBoundingClientRect();

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
      dropPosition: LogicalPoint,
      existingLegoToRemove?: DroppedLego
    ): Promise<boolean> => {
      try {
        const closestConnection = findClosestConnection(
          dropPosition,
          droppedLegos,
          connections
        );

        // Check if this lego already has connections - if so, just do regular move
        const hasExistingConnections = connectedLegos.some(
          (connectedLego) => connectedLego.instanceId === lego.instanceId
        );

        if (hasExistingConnections || !closestConnection) {
          return false;
        }

        // Create the lego at the drop position
        const repositionedLego = new DroppedLego(
          lego,
          dropPosition,
          existingLegoToRemove?.instanceId || newInstanceId()
        );

        // Remove the original lego if we're moving an existing one
        const legosForCalculation = existingLegoToRemove
          ? droppedLegos.filter(
              (l) => l.instanceId !== existingLegoToRemove.instanceId
            )
          : droppedLegos;

        const trafo = new InjectTwoLegged(connections, legosForCalculation);
        const result = await trafo.apply(repositionedLego, closestConnection);

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
      dropPosition: LogicalPoint,
      draggedLego: LegoPiece,
      existingLegoToRemove?: DroppedLego
    ): boolean => {
      if (draggedLego.typeId.includes("stopper")) {
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
            dropPosition,
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
      setBuildingBlockDragState({
        isDragging: false,
        draggedLego: null,
        mouseX: 0,
        mouseY: 0,
        dragEnterCounter: 0
      });
    };

    // This is when a new lego is dropped on a canvas from the building blocks panel. The handling of a dragged lego from the canvas is handled by mouseUp.
    const handleDrop = async (e: DragEvent) => {
      if (!draggedLego) return;

      const logicalDropPos = viewport.fromWindowToLogical(
        WindowPoint.fromMouseEvent(e)
      );

      if (draggedLego.typeId === "custom") {
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
      if (numLegs === 2) {
        const success = await handleTwoLeggedInsertion(newLego, logicalDropPos);

        if (success) {
          return;
        }
      }
      if (draggedLego.typeId === "custom") {
        openCustomLegoDialog(logicalDropPos);
      } else {
        addDroppedLego(newLego);
        addOperation({
          type: "add",
          data: { legosToAdd: [newLego] }
        });
      }

      setDraggedLego(null);
    };

    const canvas = canvasRef?.current;
    canvas?.addEventListener("dragover", handleDragOver);
    canvas?.addEventListener("dragenter", handleCanvasDragEnter);
    canvas?.addEventListener("dragleave", handleCanvasDragLeave);
    canvas?.addEventListener("dragend", handleDragEnd);
    canvas?.addEventListener("mousedown", handleMouseDown);
    canvas?.addEventListener("mousemove", handleMouseMove);
    canvas?.addEventListener("mouseup", handleMouseUp);
    canvas?.addEventListener("mouseleave", handleMouseLeave);
    canvas?.addEventListener("click", handleCanvasClick);
    document.addEventListener("dragend", handleGlobalDragEnd);
    canvas?.addEventListener("drop", handleDrop);

    return () => {
      canvas?.removeEventListener("dragover", handleDragOver);
      canvas?.addEventListener("dragenter", handleCanvasDragEnter);
      canvas?.addEventListener("dragleave", handleCanvasDragLeave);
      canvas?.removeEventListener("dragend", handleDragEnd);
      canvas?.removeEventListener("mousedown", handleMouseDown);
      canvas?.removeEventListener("mousemove", handleMouseMove);
      canvas?.removeEventListener("mouseup", handleMouseUp);
      canvas?.removeEventListener("mouseleave", handleMouseLeave);
      canvas?.removeEventListener("click", handleCanvasClick);
      document.removeEventListener("dragend", handleGlobalDragEnd);
      canvas?.removeEventListener("drop", handleDrop);
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
    legoDragState,
    setLegoDragState,
    setGroupDragState,
    addOperation,
    addConnections
  ]);

  return null;
};
