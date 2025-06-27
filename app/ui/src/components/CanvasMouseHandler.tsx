import React, { useEffect } from "react";
import { useCanvasStore } from "../stores/canvasStateStore";
import { useTensorNetworkStore } from "../stores/tensorNetworkStore";
import { useLegDragStateStore } from "../stores/legDragState";
import { useDragStateStore } from "../stores/dragState";
import { useGroupDragStateStore } from "../stores/groupDragState";
import { SelectionBoxState, DraggingStage, Connection } from "../lib/types";
import { useCanvasDragStateStore } from "../stores/canvasDragStateStore";
import { TensorNetwork } from "../lib/TensorNetwork";
import { calculateLegPosition } from "./DroppedLegoDisplay";
import {
  findClosestDanglingLeg,
  pointToLineDistance
} from "../lib/canvasCalculations";

interface CanvasMouseHandlerProps {
  canvasRef: React.RefObject<HTMLDivElement | null>;
  selectionManagerRef: React.RefObject<{
    handleMouseDown: (e: MouseEvent) => void;
  } | null>;
  selectionBox: SelectionBoxState;
  zoomLevel: number;
  altKeyPressed: boolean;
  setHoveredConnection: (connection: Connection | null) => void;
}

export const CanvasMouseHandler: React.FC<CanvasMouseHandlerProps> = ({
  canvasRef,
  selectionManagerRef,
  selectionBox,
  zoomLevel,
  altKeyPressed,
  setHoveredConnection
}) => {
  // Zustand store selectors
  const droppedLegos = useCanvasStore((state) => state.droppedLegos);
  const setDroppedLegos = useCanvasStore((state) => state.setDroppedLegos);
  const { tensorNetwork, setTensorNetwork } = useTensorNetworkStore();
  const { legDragState, setLegDragState } = useLegDragStateStore();
  const { dragState, setDragState } = useDragStateStore();
  const { groupDragState, setGroupDragState } = useGroupDragStateStore();
  const { canvasDragState, setCanvasDragState } = useCanvasDragStateStore();
  const { connections } = useCanvasStore();

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Drag update handler
    const performDragUpdate = (e: MouseEvent) => {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;
      if (!dragState) return;

      const deltaX = e.clientX - dragState.startX;
      const deltaY = e.clientY - dragState.startY;
      const newX = dragState.originalX + deltaX;
      const newY = dragState.originalY + deltaY;

      // Create a new array with updated positions
      const updatedLegos = droppedLegos.map((lego, index) => {
        if (
          groupDragState &&
          groupDragState.legoInstanceIds.includes(lego.instanceId)
        ) {
          // Move all selected legos together
          const originalPos = groupDragState.originalPositions[lego.instanceId];
          return {
            ...lego,
            x: originalPos.x + deltaX,
            y: originalPos.y + deltaY
          };
        } else if (index === dragState.draggedLegoIndex) {
          return {
            ...lego,
            x: newX,
            y: newY
          };
        }
        return lego;
      });

      setDroppedLegos(updatedLegos);
      // Don't update tensor network during drag - it will be updated on mouse up
      if (groupDragState) {
        if (tensorNetwork) {
          tensorNetwork.legos = updatedLegos.filter((lego) =>
            groupDragState.legoInstanceIds.includes(lego.instanceId)
          );
        }
      }

      // Handle connection hover detection
      const draggedLego = updatedLegos[dragState.draggedLegoIndex];
      if (draggedLego) {
        const draggedLegoHasConnections = connections.some((conn) =>
          conn.containsLego(draggedLego.instanceId)
        );
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        if (
          draggedLego.parity_check_matrix[0].length / 2 === 2 &&
          !draggedLegoHasConnections
        ) {
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

            const fromPos = calculateLegPosition(fromLego, conn.from.legIndex);
            const toPos = calculateLegPosition(toLego, conn.to.legIndex);

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
            const pos = calculateLegPosition(
              closestLeg.lego,
              closestLeg.legIndex
            );
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
        const movedLegos = droppedLegos.map((lego) => ({
          ...lego,
          x: lego.x + deltaX,
          y: lego.y + deltaY
        }));
        setDroppedLegos(movedLegos);
      }
      // Check if we should start dragging
      if (
        dragState &&
        dragState.draggingStage === DraggingStage.MAYBE_DRAGGING
      ) {
        const deltaX = e.clientX - dragState.startX;
        const deltaY = e.clientY - dragState.startY;
        if (Math.abs(deltaX) > 8 || Math.abs(deltaY) > 8) {
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
        performDragUpdate(e);
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

    const handleMouseUp = () => {
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
      if (legDragState?.isDragging) {
        setLegDragState(null);
        return;
      }
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

    canvas.addEventListener("mousedown", handleMouseDown);
    canvas.addEventListener("mousemove", handleMouseMove);
    canvas.addEventListener("mouseup", handleMouseUp);
    canvas.addEventListener("mouseleave", handleMouseLeave);

    return () => {
      canvas.removeEventListener("mousedown", handleMouseDown);
      canvas.removeEventListener("mousemove", handleMouseMove);
      canvas.removeEventListener("mouseup", handleMouseUp);
      canvas.removeEventListener("mouseleave", handleMouseLeave);
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
    zoomLevel,
    altKeyPressed,
    setCanvasDragState,
    setDroppedLegos,
    setLegDragState,
    setTensorNetwork,
    dragState,
    setDragState,
    setGroupDragState
  ]);

  return null;
};
