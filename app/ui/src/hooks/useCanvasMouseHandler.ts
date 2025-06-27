import { useCallback } from "react";
import { RefObject } from "react";
import {
  DragState,
  GroupDragState,
  DroppedLego,
  Connection,
  LegDragState,
  CanvasDragState,
  SelectionBoxState,
  DraggingStage
} from "../lib/types";
import { TensorNetwork } from "../lib/TensorNetwork";
import { calculateLegPosition } from "../components/DroppedLegoDisplay";
import {
  findClosestDanglingLeg,
  pointToLineDistance
} from "../lib/canvasCalculations";

interface UseCanvasMouseHandlerOptions {
  canvasRef: RefObject<HTMLDivElement>;
  droppedLegos: DroppedLego[];
  connections: Connection[];
  tensorNetwork: TensorNetwork | null;
  selectionBox: SelectionBoxState;
  dragState: DragState;
  groupDragState: GroupDragState | null;
  legDragState: LegDragState | null;
  canvasDragState: CanvasDragState;
  selectionManagerRef: RefObject<{
    handleMouseDown: (e: React.MouseEvent) => void;
  } | null>;
  setDragState: (state: DragState | ((prev: DragState) => DragState)) => void;
  setGroupDragState: (state: GroupDragState | null) => void;
  setLegDragState: (
    state:
      | LegDragState
      | null
      | ((prev: LegDragState | null) => LegDragState | null)
  ) => void;
  setCanvasDragState: (
    state: CanvasDragState | ((prev: CanvasDragState) => CanvasDragState)
  ) => void;
  setDroppedLegos: (legos: DroppedLego[]) => void;
  setConnections: (connections: Connection[]) => void;
  setHoveredConnection: (connection: Connection | null) => void;
  setTensorNetwork: (network: TensorNetwork | null) => void;
  hideConnectedLegs: boolean;
  zoomLevel: number;
  setZoomLevel: (level: number) => void;
  altKeyPressed: boolean;
}

interface UseCanvasMouseHandlerReturn {
  handlers: {
    onMouseDown: (e: React.MouseEvent) => void;
    onMouseMove: (e: React.MouseEvent) => void;
    onMouseUp: (e: React.MouseEvent) => void;
    onMouseLeave: () => void;
    onMouseWheel: (e: React.WheelEvent) => void;
  };
}

const initialDragState: DragState = {
  draggingStage: DraggingStage.NOT_DRAGGING,
  draggedLegoIndex: -1,
  startX: 0,
  startY: 0,
  originalX: 0,
  originalY: 0
};

const initialCanvasDragState: CanvasDragState = {
  isDragging: false,
  startX: 0,
  startY: 0,
  currentX: 0,
  currentY: 0
};

export const useCanvasMouseHandler = (
  options: UseCanvasMouseHandlerOptions
): UseCanvasMouseHandlerReturn => {
  const {
    canvasRef,
    droppedLegos,
    connections,
    tensorNetwork,
    selectionBox,
    dragState,
    groupDragState,
    legDragState,
    canvasDragState,
    selectionManagerRef,
    setDragState,
    setGroupDragState,
    setLegDragState,
    setCanvasDragState,
    setDroppedLegos,
    setConnections,
    setHoveredConnection,
    setTensorNetwork,
    hideConnectedLegs,
    zoomLevel,
    setZoomLevel,
    altKeyPressed
  } = options;

  const handleCanvasMouseDown = useCallback(
    (e: React.MouseEvent) => {
      // Only start selection box if clicking directly on canvas (not on a Lego)
      if (e.target === e.currentTarget) {
        const rect = canvasRef.current?.getBoundingClientRect();
        if (!rect) return;
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        if (!e.altKey) {
          // Use SelectionManager for selection logic
          selectionManagerRef.current?.handleMouseDown(e);
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
    },
    [canvasRef, setCanvasDragState, selectionManagerRef]
  );

  // Drag update handler
  const performDragUpdate = useCallback(
    (e: React.MouseEvent) => {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;

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
    },
    [dragState, groupDragState, droppedLegos, connections, tensorNetwork]
  );

  const handleCanvasMouseMove = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      const rect = canvasRef.current?.getBoundingClientRect();

      if (!rect) return;

      // Selection box dragging is now handled by SelectionManager
      if (selectionBox.isSelecting) {
        return;
      }

      if (canvasDragState.isDragging) {
        const newX = e.clientX - rect.left;
        const newY = e.clientY - rect.top;
        const deltaX = newX - canvasDragState.startX;
        const deltaY = newY - canvasDragState.startY;

        setCanvasDragState((prev) => ({
          ...prev,
          startX: newX,
          startY: newY,
          currentX: newX,
          currentY: newY
        }));

        const movedLegos = droppedLegos.map((lego) => ({
          ...lego,
          x: lego.x + deltaX,
          y: lego.y + deltaY
        }));
        setDroppedLegos(movedLegos);
      }

      // Check if we should start dragging
      if (dragState.draggingStage === DraggingStage.MAYBE_DRAGGING) {
        const deltaX = e.clientX - dragState.startX;
        const deltaY = e.clientY - dragState.startY;

        // Only start dragging if the mouse has moved more than 8 pixels (increased from 3)
        // This prevents accidental drag starts during normal clicks
        if (Math.abs(deltaX) > 8 || Math.abs(deltaY) > 8) {
          // Set tensor network for non-selected legos when we start dragging
          const draggedLego = droppedLegos[dragState.draggedLegoIndex];
          const isPartOfSelection = tensorNetwork?.legos.some(
            (l) => l.instanceId === draggedLego.instanceId
          );

          if (!isPartOfSelection) {
            // Select this lego when we start dragging

            setTensorNetwork(
              new TensorNetwork({ legos: [draggedLego], connections: [] })
            );
          }

          setDragState((prev) => ({
            ...prev,
            draggingStage: DraggingStage.DRAGGING
          }));
        }
        return;
      }

      // Handle Lego dragging
      if (dragState.draggingStage === DraggingStage.DRAGGING) {
        performDragUpdate(e);
        return;
      }

      // Handle leg dragging
      if (legDragState?.isDragging) {
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        setLegDragState((prev) => ({
          ...prev!,
          currentX: mouseX,
          currentY: mouseY
        }));
      }
    },
    [
      canvasRef,
      selectionBox.isSelecting,
      canvasDragState,
      setCanvasDragState,
      droppedLegos,
      setDroppedLegos,
      connections,
      hideConnectedLegs,
      dragState,
      tensorNetwork,
      setTensorNetwork,
      setDragState,
      legDragState,
      setLegDragState
    ]
  );

  const handleCanvasMouseWheel = useCallback(
    (e: React.WheelEvent) => {
      if (altKeyPressed) {
        const newZoomLevel =
          zoomLevel *
          Math.pow(1 + Math.sign(e.deltaY) / 10, Math.abs(e.deltaY) / 100);
        const scale = newZoomLevel / zoomLevel;
        setZoomLevel(newZoomLevel);
        const centerX = e.currentTarget.getBoundingClientRect().width / 2;
        const centerY = e.currentTarget.getBoundingClientRect().height / 2;
        const rescaledLegos = droppedLegos.map((lego) => ({
          ...lego,
          x: (lego.x - centerX) * scale + centerX,
          y: (lego.y - centerY) * scale + centerY
        }));
        setDroppedLegos(rescaledLegos);
      }
    },
    [
      altKeyPressed,
      zoomLevel,
      setZoomLevel,
      droppedLegos,
      setDroppedLegos,
      connections,
      hideConnectedLegs
    ]
  );

  const handleCanvasMouseUp = useCallback(
    (e: React.MouseEvent) => {
      const rect = canvasRef.current?.getBoundingClientRect();

      if (!rect) {
        setLegDragState(null);
        return;
      }

      if (canvasDragState.isDragging) {
        const newCanvasDragState = {
          isDragging: false,
          startX: 0,
          startY: 0,
          currentX: 0,
          currentY: 0
        };
        setCanvasDragState(newCanvasDragState);
        return;
      }

      // Handle leg dragging
      if (legDragState?.isDragging) {
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        // Find the closest leg endpoint
        let closestLeg: { lego: DroppedLego; legIndex: number } | null = null;
        let minDistance = Infinity;

        droppedLegos.forEach((lego) => {
          const numLegs = lego.parity_check_matrix[0].length / 2;

          for (let legIndex = 0; legIndex < numLegs; legIndex++) {
            // Skip if this is the same leg we're dragging from
            if (
              lego.instanceId === legDragState.legoId &&
              legIndex === legDragState.legIndex
            ) {
              continue;
            }

            // Check if this leg is already connected
            const isConnected = connections.some(
              (conn) =>
                (conn.from.legoId === lego.instanceId &&
                  conn.from.legIndex === legIndex) ||
                (conn.to.legoId === lego.instanceId &&
                  conn.to.legIndex === legIndex)
            );

            if (isConnected) continue;

            // Calculate leg position
            const legPos = calculateLegPosition(lego, legIndex);
            const legX = lego.x + legPos.endX;
            const legY = lego.y + legPos.endY;

            const distance = Math.sqrt(
              Math.pow(mouseX - legX, 2) + Math.pow(mouseY - legY, 2)
            );

            if (distance < minDistance && distance < 20) {
              // 20 pixel threshold
              minDistance = distance;
              closestLeg = { lego, legIndex };
            }
          }
        });

        // Create connection if we found a valid target
        if (closestLeg !== null) {
          const targetLeg = closestLeg as {
            lego: DroppedLego;
            legIndex: number;
          };
          const newConnection = new Connection(
            { legoId: legDragState.legoId, legIndex: legDragState.legIndex },
            { legoId: targetLeg.lego.instanceId, legIndex: targetLeg.legIndex }
          );

          const newConnections = [...connections, newConnection];
          setConnections(newConnections);
        }

        // Clear leg drag state
        setLegDragState(null);
        return;
      }

      if (dragState.draggingStage === DraggingStage.DRAGGING) {
        const deltaX = e.clientX - dragState.startX;
        const deltaY = e.clientY - dragState.startY;
        const newX = dragState.originalX + deltaX;
        const newY = dragState.originalY + deltaY;

        // Apply final positions
        const finalLegos = droppedLegos.map((lego, index) => {
          if (
            groupDragState &&
            groupDragState.legoInstanceIds.includes(lego.instanceId)
          ) {
            // Move all selected legos together
            const originalPos =
              groupDragState.originalPositions[lego.instanceId];
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

        // Update state with final positions
        setDroppedLegos(finalLegos);

        // Update tensor network if group drag
        if (groupDragState && tensorNetwork) {
          const updatedNetworkLegos = finalLegos.filter((lego) =>
            groupDragState.legoInstanceIds.includes(lego.instanceId)
          );
          tensorNetwork.legos = updatedNetworkLegos;
        }

        // Reset drag state
        setDragState(initialDragState);
        setGroupDragState(null);
        setHoveredConnection(null);
      } else if (dragState.draggedLegoIndex !== -1) {
        // This was a click (mouse down + mouse up without dragging)
        // Clear the drag state to prevent it from sticking around
        setDragState(initialDragState);
        setGroupDragState(null);
      }
    },
    [
      canvasRef,
      setLegDragState,
      selectionBox.isSelecting,
      canvasDragState,
      setCanvasDragState,
      legDragState,
      droppedLegos,
      connections,
      setConnections,
      hideConnectedLegs,
      dragState,
      groupDragState,
      tensorNetwork,
      setDroppedLegos,
      setDragState,
      setGroupDragState,
      setHoveredConnection
    ]
  );

  const handleCanvasMouseLeave = useCallback(() => {
    // Clear any drag states when leaving canvas
    if (dragState.draggingStage === DraggingStage.DRAGGING) {
      setDragState(initialDragState);
      setGroupDragState(null);
    }
    if (legDragState?.isDragging) {
      setLegDragState(null);
    }
    if (canvasDragState.isDragging) {
      setCanvasDragState(initialCanvasDragState);
    }
  }, [
    dragState.draggingStage,
    legDragState?.isDragging,
    canvasDragState.isDragging,
    setDragState,
    setGroupDragState,
    setLegDragState,
    setCanvasDragState
  ]);

  return {
    handlers: {
      onMouseDown: handleCanvasMouseDown,
      onMouseMove: handleCanvasMouseMove,
      onMouseUp: handleCanvasMouseUp,
      onMouseLeave: handleCanvasMouseLeave,
      onMouseWheel: handleCanvasMouseWheel
    }
  };
};
