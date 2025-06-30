import React, { useEffect } from "react";
import { useCanvasStore } from "../stores/canvasStateStore";
import { useTensorNetworkStore } from "../stores/tensorNetworkStore";
import { useLegDragStateStore } from "../stores/legDragState";
import { useDragStateStore } from "../stores/dragState";
import { useGroupDragStateStore } from "../stores/groupDragState";
import { SelectionBoxState, DraggingStage, Connection } from "../lib/types";
import { useCanvasDragStateStore } from "../stores/canvasDragStateStore";
import { TensorNetwork } from "../lib/TensorNetwork";
import {
  findClosestDanglingLeg,
  pointToLineDistance
} from "../lib/canvasCalculations";
import { useDraggedLegoStore } from "../stores/draggedLegoStore";
import { useBuildingBlockDragStateStore } from "../stores/buildingBlockDragStateStore";

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
  const { droppedLegos, updateDroppedLegos, setDroppedLegos } =
    useCanvasStore();
  const { tensorNetwork, setTensorNetwork } = useTensorNetworkStore();
  const { legDragState, setLegDragState } = useLegDragStateStore();
  const { dragState, setDragState } = useDragStateStore();
  const { groupDragState, setGroupDragState } = useGroupDragStateStore();
  const { canvasDragState, setCanvasDragState } = useCanvasDragStateStore();
  const { connections, addConnections, addOperation } = useCanvasStore();
  const { draggedLego, setDraggedLego } = useDraggedLegoStore();
  const {
    buildingBlockDragState,
    setBuildingBlockDragState,
    clearBuildingBlockDragState
  } = useBuildingBlockDragStateStore();

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
            updatedLego: {
              ...lego,
              x: originalPos.x + deltaX,
              y: originalPos.y + deltaY
            }
          };
        }

        return {
          oldLego: lego,
          updatedLego: {
            ...lego,
            x: newX,
            y: newY
          }
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

    const handleMouseUp = (e: MouseEvent) => {
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
        // Only call performDragUpdate when we were actually dragging
        performDragUpdate(e);
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
      // Handle leg connection
      if (legDragState?.isDragging) {
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        droppedLegos.find((lego) => {
          const legCount = lego.parity_check_matrix[0].length / 2;
          for (let i = 0; i < legCount; i++) {
            const pos = lego.style!.legStyles[i].position;
            const targetPoint = {
              x: lego.x + pos.endX,
              y: lego.y + pos.endY
            };

            const distance = Math.sqrt(
              Math.pow(mouseX - targetPoint.x, 2) +
                Math.pow(mouseY - targetPoint.y, 2)
            );

            if (distance < 10) {
              // Check if either leg is already participating in a connection
              const isSourceLegConnected = connections.some(
                (conn) =>
                  (conn.from.legoId === legDragState.legoId &&
                    conn.from.legIndex === legDragState.legIndex) ||
                  (conn.to.legoId === legDragState.legoId &&
                    conn.to.legIndex === legDragState.legIndex)
              );
              const isTargetLegConnected = connections.some(
                (conn) =>
                  (conn.from.legoId === lego.instanceId &&
                    conn.from.legIndex === i) ||
                  (conn.to.legoId === lego.instanceId && conn.to.legIndex === i)
              );

              if (
                lego.instanceId === legDragState.legoId &&
                i === legDragState.legIndex
              ) {
                return true;
              }

              if (isSourceLegConnected || isTargetLegConnected) {
                //TODO: set error message
                // setError("Cannot connect to a leg that is already connected");
                console.error(
                  "Cannot connect to a leg that is already connected"
                );
                return true;
              }

              const connectionExists = connections.some(
                (conn) =>
                  (conn.from.legoId === legDragState.legoId &&
                    conn.from.legIndex === legDragState.legIndex &&
                    conn.to.legoId === lego.instanceId &&
                    conn.to.legIndex === i) ||
                  (conn.from.legoId === lego.instanceId &&
                    conn.from.legIndex === i &&
                    conn.to.legoId === legDragState.legoId &&
                    conn.to.legIndex === legDragState.legIndex)
              );

              if (!connectionExists) {
                const newConnection = new Connection(
                  {
                    legoId: legDragState.legoId,
                    legIndex: legDragState.legIndex
                  },
                  {
                    legoId: lego.instanceId,
                    legIndex: i
                  }
                );

                addConnections([newConnection]);

                addOperation({
                  type: "connect",
                  data: { connectionsToAdd: [newConnection] }
                });
                return true;
              }
            }
          }
          return false;
        });
      }
      if (legDragState?.isDragging) {
        setLegDragState(null);
        return;
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

      const target = e.currentTarget as HTMLElement;
      const canvasRect = target.getBoundingClientRect();

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
