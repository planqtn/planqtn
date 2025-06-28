import {
  DroppedLego,
  DragState,
  Connection,
  PauliOperator,
  DraggingStage
} from "../lib/types";
import { findConnectedComponent, TensorNetwork } from "../lib/TensorNetwork";
import { LegStyle } from "../LegoStyles";
import { useMemo, memo } from "react";
import { useTensorNetworkStore } from "../stores/tensorNetworkStore";
import { simpleAutoFlow } from "../transformations/AutoPauliFlow";
import { useDragStateStore } from "../stores/dragState";
import { useLegDragStateStore } from "../stores/legDragState";
import { useGroupDragStateStore } from "../stores/groupDragState";
import { useCanvasStore } from "../stores/canvasStateStore";

const LEG_LABEL_DISTANCE = 15;
const LEG_ENDPOINT_RADIUS = 5;
// Add shared function for leg position calculations
export interface LegPosition {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  labelX: number;
  labelY: number;
  angle: number;
  style: LegStyle;
}

export function getLegoBoundingBox(
  lego: DroppedLego,
  demoMode: boolean
): {
  top: number;
  left: number;
  width: number;
  height: number;
} {
  const numAllLegs = lego.parity_check_matrix[0].length / 2; // Total number of legs (symplectic matrix, each column is X and Z)
  const legPositions = Array(numAllLegs)
    .fill(0)
    .map((_, legIndex) =>
      calculateLegPosition(lego, legIndex, LEG_LABEL_DISTANCE, true)
    );

  // if (lego.instanceId == "3") {
  //   console.log(legPositions);
  // }

  const endpointFn = (pos: LegPosition) => {
    return demoMode
      ? { x: pos.endX, y: pos.endY }
      : { x: pos.labelX, y: pos.labelY };
  };

  // Calculate SVG dimensions to accommodate all legs
  const maxEndpointX = Math.max(
    ...legPositions.map((pos) => endpointFn(pos).x),
    lego.style.size / 2
  );
  const minEndpointX = Math.min(
    ...legPositions.map((pos) => endpointFn(pos).x),
    0
  );

  const maxEndpointY = Math.max(
    ...legPositions.map((pos) => endpointFn(pos).y),
    +lego.style.size / 2
  );
  const minEndpointY = Math.min(
    ...legPositions.map((pos) => endpointFn(pos).y),
    -lego.style.size / 2
  );

  return {
    top: minEndpointY,
    left: minEndpointX,
    width: maxEndpointX - minEndpointX,
    height: maxEndpointY - minEndpointY
  };
}

export function calculateLegPosition(
  lego: DroppedLego,
  legIndex: number,
  labelDistance: number = LEG_LABEL_DISTANCE,
  forSvg: boolean = false
): LegPosition {
  const legStyle = lego.style.getLegStyle(legIndex, lego, forSvg);

  // Calculate start position relative to center
  const startX = 0;
  // legStyle.from === "center"
  //   ? 0
  //   : legStyle.from === "bottom"
  //     ? legStyle.startOffset * Math.cos(legStyle.angle)
  //     : 0;
  const startY = 0;
  // legStyle.from === "center"
  //   ? 0
  //   : legStyle.from === "bottom"
  //     ? legStyle.startOffset * Math.sin(legStyle.angle)
  //     : 0;

  // Calculate end position
  const endX = startX + legStyle.length * Math.cos(legStyle.angle);
  const endY = startY + legStyle.length * Math.sin(legStyle.angle);

  // Calculate label position
  const labelX = endX + labelDistance * Math.cos(legStyle.angle);
  const labelY = endY + labelDistance * Math.sin(legStyle.angle);

  return {
    startX,
    startY,
    endX,
    endY,
    labelX,
    labelY,
    angle: legStyle.angle,
    style: legStyle
  };
}

interface DroppedLegoDisplayProps {
  lego: DroppedLego;
  index: number;
  demoMode: boolean;
  canvasRef: React.RefObject<HTMLDivElement | null>;
}

// Memoized component for static leg lines only
const StaticLegsLayer = memo<{
  legPositions: LegPosition[];
  shouldHideLeg: (legIndex: number) => boolean;
}>(({ legPositions, shouldHideLeg }) => {
  return (
    <>
      {/* Static leg lines - rendered first, conditionally hidden */}
      {legPositions.map((pos, legIndex) =>
        shouldHideLeg(legIndex) ? null : (
          <line
            key={`static-leg-${legIndex}`}
            x1={pos.startX}
            y1={pos.startY}
            x2={pos.endX}
            y2={pos.endY}
            stroke="#A0AEC0" // Default gray color for static rendering
            strokeWidth="2"
            strokeDasharray={pos.style.style === "dashed" ? "5,5" : undefined}
            style={{ pointerEvents: "none" }}
          />
        )
      )}
    </>
  );
});

StaticLegsLayer.displayName = "StaticLegsLayer";

// Memoized component for lego body
const LegoBodyLayer = memo<{
  lego: DroppedLego;
  size: number;
  numRegularLegs: number;
  isSelected: boolean;
}>(({ lego, size, numRegularLegs, isSelected }) => {
  // Calculate polygon vertices - only for regular legs
  const vertices = useMemo(() => {
    return Array.from({ length: numRegularLegs }, (_, i) => {
      // Start from the top (- Math.PI / 2) and go clockwise
      const angle = -Math.PI / 2 + (2 * Math.PI * i) / numRegularLegs;
      return {
        x: (size / 2) * Math.cos(angle),
        y: (size / 2) * Math.sin(angle)
      };
    });
  }, [numRegularLegs, size]);

  return (
    <>
      {/* Lego Body */}
      {numRegularLegs <= 2 ? (
        <g transform={`translate(-${size / 2}, -${size / 2})`}>
          <rect
            x="0"
            y="0"
            width={size}
            height={size}
            rx={
              typeof lego.style.borderRadius === "string" &&
              lego.style.borderRadius === "full"
                ? size / 2
                : typeof lego.style.borderRadius === "number"
                  ? lego.style.borderRadius
                  : 0
            }
            ry={
              typeof lego.style.borderRadius === "string" &&
              lego.style.borderRadius === "full"
                ? size / 2
                : typeof lego.style.borderRadius === "number"
                  ? lego.style.borderRadius
                  : 0
            }
            fill={
              isSelected
                ? lego.style.getSelectedBackgroundColorForSvg()
                : lego.style.getBackgroundColorForSvg()
            }
            stroke={
              isSelected
                ? lego.style.getSelectedBorderColorForSvg()
                : lego.style.getBorderColorForSvg()
            }
            strokeWidth="2"
          />
        </g>
      ) : (
        <g>
          {numRegularLegs > 8 ? (
            // Create a circle for many vertices
            <circle
              cx="0"
              cy="0"
              r={size / 2}
              fill={
                isSelected
                  ? lego.style.getSelectedBackgroundColorForSvg()
                  : lego.style.getBackgroundColorForSvg()
              }
              stroke={
                isSelected
                  ? lego.style.getSelectedBorderColorForSvg()
                  : lego.style.getBorderColorForSvg()
              }
              strokeWidth="2"
            />
          ) : (
            // Create a polygon for 3-8 vertices
            <path
              d={
                vertices.reduce((path, _, i) => {
                  const command = i === 0 ? "M" : "L";
                  const x =
                    (size / 2) *
                    Math.cos(-Math.PI / 2 + (2 * Math.PI * i) / numRegularLegs);
                  const y =
                    (size / 2) *
                    Math.sin(-Math.PI / 2 + (2 * Math.PI * i) / numRegularLegs);
                  return `${path} ${command} ${x} ${y}`;
                }, "") + " Z"
              }
              fill={
                isSelected
                  ? lego.style.getSelectedBackgroundColorForSvg()
                  : lego.style.getBackgroundColorForSvg()
              }
              stroke={
                isSelected
                  ? lego.style.getSelectedBorderColorForSvg()
                  : lego.style.getBorderColorForSvg()
              }
              strokeWidth="2"
            />
          )}
        </g>
      )}
    </>
  );
});

LegoBodyLayer.displayName = "LegoBodyLayer";

export const DroppedLegoDisplay: React.FC<DroppedLegoDisplayProps> = memo(
  ({ lego, index, demoMode = false, canvasRef }) => {
    const size = lego.style.size;
    const numAllLegs = lego.parity_check_matrix[0].length / 2;
    const isScalar =
      lego.parity_check_matrix.length === 1 &&
      lego.parity_check_matrix[0].length === 1;
    const numLogicalLegs = lego.logical_legs.length;
    const numGaugeLegs = lego.gauge_legs.length;
    const numRegularLegs = numAllLegs - numLogicalLegs - numGaugeLegs;
    const {
      droppedLegos,
      connections,
      addDroppedLegos,
      setDroppedLegos,
      newInstanceId,
      addConnections,
      hideConnectedLegs,
      addOperation
    } = useCanvasStore();
    const { tensorNetwork, setTensorNetwork } = useTensorNetworkStore();
    const { dragState, setDragState } = useDragStateStore();
    const { setLegDragState } = useLegDragStateStore();
    const { setGroupDragState } = useGroupDragStateStore();
    const { legDragState } = useLegDragStateStore();

    // Initialize selectedMatrixRows if not present
    if (!lego.selectedMatrixRows) {
      lego.selectedMatrixRows = [];
    }

    const isSelected =
      tensorNetwork &&
      tensorNetwork.legos.some((l) => l.instanceId === lego.instanceId);

    // Memoize leg positions calculation
    const legPositions = useMemo(() => {
      return isScalar
        ? []
        : Array(numAllLegs)
            .fill(0)
            .map((_, legIndex) =>
              calculateLegPosition(lego, legIndex, LEG_LABEL_DISTANCE, true)
            );
    }, [numAllLegs]);

    // Calculate drag offset for performance during dragging
    const dragOffset = useMemo(() => {
      if (dragState?.draggingStage !== DraggingStage.DRAGGING)
        return { x: 0, y: 0 };

      // Check if this lego is being dragged individually
      if (dragState.draggedLegoIndex === index) {
        const deltaX = dragState.startX ? lego.x - dragState.originalX : 0;
        const deltaY = dragState.startY ? lego.y - dragState.originalY : 0;
        return { x: deltaX, y: deltaY };
      }

      return { x: 0, y: 0 };
    }, [dragState, index, lego.x, lego.y]);

    // Use base position (without drag offset) for all calculations
    const basePosition = useMemo(
      () => ({
        x: demoMode ? lego.x : lego.x - dragOffset.x,
        y: demoMode ? lego.y : lego.y - dragOffset.y
      }),
      [lego.x, lego.y, dragOffset.x, dragOffset.y, demoMode]
    );

    // Check if this specific lego is being dragged
    const isThisLegoDragged = useMemo(() => {
      if (dragState?.draggingStage !== DraggingStage.DRAGGING) return false;

      // Check if this lego is being dragged individually
      if (dragState.draggedLegoIndex === index) return true;

      // Check if this lego is part of a group being dragged (selected legos)
      if (tensorNetwork?.legos.some((l) => l.instanceId === lego.instanceId)) {
        return true;
      }

      return false;
    }, [dragState, index, tensorNetwork, lego.instanceId]);

    // Helper functions - memoized where possible
    const isLegConnected = useMemo(() => {
      const connectedLegs = new Set<number>();
      connections.forEach((conn) => {
        if (conn.from.legoId === lego.instanceId) {
          connectedLegs.add(conn.from.legIndex);
        }
        if (conn.to.legoId === lego.instanceId) {
          connectedLegs.add(conn.to.legIndex);
        }
      });
      return (legIndex: number) => connectedLegs.has(legIndex);
    }, [connections, lego.instanceId]);

    // Function to determine if a leg should be hidden
    const shouldHideLeg = (legIndex: number) => {
      if (!hideConnectedLegs) return false;
      if (lego.alwaysShowLegs) return false;

      const isConnected = isLegConnected(legIndex);
      if (!isConnected) return false;

      const thisLegStyle = lego.style.getLegStyle(legIndex, lego);
      const isThisHighlighted = thisLegStyle.is_highlighted;

      // If this leg is not highlighted, hide it only if connected to a non-highlighted leg
      if (!isThisHighlighted) {
        // Check if connected to a highlighted leg
        return !connections.some((conn) => {
          if (
            conn.from.legoId === lego.instanceId &&
            conn.from.legIndex === legIndex
          ) {
            const connectedLego = droppedLegos?.find(
              (l) => l.instanceId === conn.to.legoId
            );
            return (
              connectedLego?.style.getLegStyle(conn.to.legIndex, connectedLego)
                ?.is_highlighted || false
            );
          }
          if (
            conn.to.legoId === lego.instanceId &&
            conn.to.legIndex === legIndex
          ) {
            const connectedLego = droppedLegos?.find(
              (l) => l.instanceId === conn.from.legoId
            );
            return (
              connectedLego?.style.getLegStyle(
                conn.from.legIndex,
                connectedLego
              )?.is_highlighted || false
            );
          }
          return false;
        });
      }

      // If this leg is highlighted, hide it only if connected to a leg with the same highlight color
      return connections.some((conn) => {
        if (
          conn.from.legoId === lego.instanceId &&
          conn.from.legIndex === legIndex
        ) {
          const connectedLego = droppedLegos?.find(
            (l) => l.instanceId === conn.to.legoId
          );
          const connectedStyle = connectedLego?.style.getLegStyle(
            conn.to.legIndex,
            connectedLego
          );
          return (
            connectedStyle?.is_highlighted &&
            connectedStyle.color === thisLegStyle.color
          );
        }
        if (
          conn.to.legoId === lego.instanceId &&
          conn.to.legIndex === legIndex
        ) {
          const connectedLego = droppedLegos?.find(
            (l) => l.instanceId === conn.from.legoId
          );
          const connectedStyle = connectedLego?.style.getLegStyle(
            conn.from.legIndex,
            connectedLego
          );
          return (
            connectedStyle?.is_highlighted &&
            connectedStyle.color === thisLegStyle.color
          );
        }
        return false;
      });
    };

    const handleLegoMouseDown = (e: React.MouseEvent, index: number) => {
      e.preventDefault();
      e.stopPropagation();
      const lego = droppedLegos[index];

      if (e.shiftKey) {
        handleClone(lego, e.clientX, e.clientY);
      } else {
        const isPartOfSelection = tensorNetwork?.legos.some(
          (l) => l.instanceId === lego.instanceId
        );

        if (isPartOfSelection) {
          // Dragging a selected lego - move the whole group
          const selectedLegos = tensorNetwork?.legos || [];
          const currentPositions: {
            [instanceId: string]: { x: number; y: number };
          } = {};
          selectedLegos.forEach((l) => {
            currentPositions[l.instanceId] = { x: l.x, y: l.y };
          });

          setGroupDragState({
            legoInstanceIds: selectedLegos.map((l) => l.instanceId),
            originalPositions: currentPositions
          });
        } else {
          // For non-selected legos, don't set tensor network yet
          // It will be set when we actually start dragging (in mouse move)
          // Clear any existing group drag state
          setGroupDragState(null);
        }

        // not dragging yet but the index is set, so we can start dragging when the mouse moves
        setDragState({
          draggingStage: DraggingStage.MAYBE_DRAGGING,
          draggedLegoIndex: index,
          startX: e.clientX,
          startY: e.clientY,
          originalX: lego.x,
          originalY: lego.y
        });
      }
    };

    const handleLegMouseDown = (
      e: React.MouseEvent,
      legoId: string,
      legIndex: number
    ) => {
      if (!canvasRef) return;

      e.preventDefault();
      e.stopPropagation();
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;

      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      setLegDragState({
        isDragging: true,
        legoId,
        legIndex,
        startX: x,
        startY: y,
        currentX: x,
        currentY: y
      });
    };

    const handleLegClick = (legoId: string, legIndex: number) => {
      // Find the lego that was clicked
      const clickedLego = droppedLegos.find(
        (lego) => lego.instanceId === legoId
      );
      if (!clickedLego) return;
      const numQubits = clickedLego.parity_check_matrix[0].length / 2;
      const h = clickedLego.parity_check_matrix;
      const existingPushedLeg = clickedLego.selectedMatrixRows?.find(
        (row) => h[row][legIndex] == 1 || h[row][legIndex + numQubits] == 1
      );
      const currentOperator = existingPushedLeg
        ? h[existingPushedLeg][legIndex] == 1
          ? PauliOperator.X
          : PauliOperator.Z
        : PauliOperator.I;

      // Find available operators in parity check matrix for this leg
      const hasX = clickedLego.parity_check_matrix.some(
        (row) => row[legIndex] === 1 && row[legIndex + numQubits] === 0
      );
      const hasZ = clickedLego.parity_check_matrix.some(
        (row) => row[legIndex] === 0 && row[legIndex + numQubits] === 1
      );

      // Cycle through operators only if they exist in matrix
      let nextOperator: PauliOperator;
      switch (currentOperator) {
        case PauliOperator.I:
          nextOperator = hasX
            ? PauliOperator.X
            : hasZ
              ? PauliOperator.Z
              : PauliOperator.I;
          break;
        case PauliOperator.X:
          nextOperator = hasZ ? PauliOperator.Z : PauliOperator.I;
          break;
        case PauliOperator.Z:
          nextOperator = PauliOperator.I;
          break;
        default:
          nextOperator = PauliOperator.I;
      }

      // Find the first row in parity check matrix that matches currentOperator on legIndex
      const baseRepresentative =
        clickedLego.parity_check_matrix.find((row) => {
          if (nextOperator === PauliOperator.X) {
            return row[legIndex] === 1 && row[legIndex + numQubits] === 0;
          } else if (nextOperator === PauliOperator.Z) {
            return row[legIndex] === 0 && row[legIndex + numQubits] === 1;
          }
          return false;
        }) || new Array(2 * numQubits).fill(0);

      // Find the row index that corresponds to the baseRepresentative
      const rowIndex = clickedLego.parity_check_matrix.findIndex((row) =>
        row.every((val, idx) => val === baseRepresentative[idx])
      );

      // Update the selected rows based on the pushed legs
      const selectedRows = [rowIndex].filter((row) => row !== -1);

      // Create a new lego instance with updated properties
      const updatedLego = {
        ...clickedLego,
        selectedMatrixRows: selectedRows
      };

      // Update the selected tensornetwork state
      setTensorNetwork(
        new TensorNetwork({ legos: [updatedLego], connections: [] })
      );

      // Update droppedLegos by replacing the old lego with the new one
      const newDroppedLegos = droppedLegos.map((lego) =>
        lego.instanceId === legoId ? updatedLego : lego
      );
      setDroppedLegos(newDroppedLegos);

      simpleAutoFlow(
        updatedLego,
        newDroppedLegos,
        connections,
        setDroppedLegos,
        setTensorNetwork
      );
    };

    const handleLegoClick = (e: React.MouseEvent, lego: DroppedLego) => {
      if (
        dragState &&
        dragState.draggingStage === DraggingStage.JUST_FINISHED
      ) {
        setDragState({
          draggingStage: DraggingStage.NOT_DRAGGING,
          draggedLegoIndex: -1,
          startX: 0,
          startY: 0,
          originalX: 0,
          originalY: 0
        });
        return;
      }

      if (dragState?.draggingStage !== DraggingStage.DRAGGING) {
        // Only handle click if not dragging
        e.stopPropagation();

        // Clear the drag state since this is a click, not a drag
        setDragState(
          (prev) =>
            ({
              ...prev,
              draggedLegoIndex: -1,
              startX: 0,
              startY: 0,
              originalX: 0,
              originalY: 0
            }) as DragState
        );

        if (e.ctrlKey || e.metaKey) {
          // Handle Ctrl+click for toggling selection
          if (tensorNetwork) {
            const isSelected = tensorNetwork.legos.some(
              (l) => l.instanceId === lego.instanceId
            );
            if (isSelected) {
              // Remove lego from tensor network
              const newLegos = tensorNetwork.legos.filter(
                (l) => l.instanceId !== lego.instanceId
              );

              if (newLegos.length === 0) {
                setTensorNetwork(null);
              } else {
                const newConnections = tensorNetwork.connections.filter(
                  (conn) =>
                    conn.from.legoId !== lego.instanceId &&
                    conn.to.legoId !== lego.instanceId
                );
                setTensorNetwork(
                  new TensorNetwork({
                    legos: newLegos,
                    connections: newConnections
                  })
                );
              }
            } else {
              // Add lego to tensor network
              const newLegos = [...tensorNetwork.legos, lego];
              const newConnections = connections.filter(
                (conn) =>
                  newLegos.some((l) => l.instanceId === conn.from.legoId) &&
                  newLegos.some((l) => l.instanceId === conn.to.legoId)
              );

              setTensorNetwork(
                new TensorNetwork({
                  legos: newLegos,
                  connections: newConnections
                })
              );
            }
          } else {
            // If no tensor network exists, create one with just this lego
            setTensorNetwork(
              new TensorNetwork({ legos: [lego], connections: [] })
            );
          }
        } else {
          // Regular click behavior
          const isCurrentlySelected = tensorNetwork?.legos.some(
            (l) => l.instanceId === lego.instanceId
          );

          if (isCurrentlySelected && tensorNetwork?.legos.length === 1) {
            // Second click on same already selected lego - expand to connected component
            const network = findConnectedComponent(
              lego,
              droppedLegos,
              connections
            );
            // only set tensor network if there are more than 1 legos in the network
            if (network.legos.length > 1) {
              setTensorNetwork(network);
            } else {
              console.log("same isolated lego clicked");
            }
          } else {
            // First click on unselected lego or clicking different lego - select just this lego
            setTensorNetwork(
              new TensorNetwork({ legos: [lego], connections: [] })
            );
          }
        }
      }
    };

    const handleClone = (
      lego: DroppedLego,
      clientX: number,
      clientY: number
    ) => {
      // Check if we're cloning multiple legos
      const legosToClone = tensorNetwork?.legos || [lego];

      // Get a single starting ID for all new legos
      const startingId = parseInt(newInstanceId());

      // Create a mapping from old instance IDs to new ones
      const instanceIdMap = new Map<string, string>();
      const newLegos = legosToClone.map((l, idx) => {
        const newId = String(startingId + idx);
        instanceIdMap.set(l.instanceId, newId);
        return {
          ...l,
          instanceId: newId,
          x: l.x + 20,
          y: l.y + 20
        };
      });

      // Clone connections between the selected legos
      const newConnections = connections
        .filter(
          (conn) =>
            legosToClone.some((l) => l.instanceId === conn.from.legoId) &&
            legosToClone.some((l) => l.instanceId === conn.to.legoId)
        )
        .map(
          (conn) =>
            new Connection(
              {
                legoId: instanceIdMap.get(conn.from.legoId)!,
                legIndex: conn.from.legIndex
              },
              {
                legoId: instanceIdMap.get(conn.to.legoId)!,
                legIndex: conn.to.legIndex
              }
            )
        );

      // Add new legos and connections
      addDroppedLegos(newLegos);
      addConnections(newConnections);

      // Set up drag state for the group
      const positions: { [instanceId: string]: { x: number; y: number } } = {};
      newLegos.forEach((l) => {
        positions[l.instanceId] = { x: l.x, y: l.y };
      });

      setGroupDragState({
        legoInstanceIds: newLegos.map((l) => l.instanceId),
        originalPositions: positions
      });

      // Set up initial drag state for the first lego
      setDragState({
        draggingStage: DraggingStage.MAYBE_DRAGGING,
        draggedLegoIndex: droppedLegos.length,
        startX: clientX,
        startY: clientY,
        originalX: lego.x + 20,
        originalY: lego.y + 20
      });

      // Add to history
      addOperation({
        type: "add",
        data: {
          legosToAdd: newLegos,
          connectionsToAdd: newConnections
        }
      });
    };

    // // Function to get leg visibility style
    // const getLegVisibility = (legIndex: number) => {
    //   if (shouldHideLeg(legIndex)) {
    //     return {
    //       visibility: "hidden" as const,
    //       pointerEvents: "none" as const
    //     };
    //   }
    //   return { visibility: "visible" as const, pointerEvents: "all" as const };
    // };

    const isScalarLego = (lego: DroppedLego) => {
      return (
        lego.parity_check_matrix.length === 1 &&
        lego.parity_check_matrix[0].length === 1
      );
    };

    return (
      <div
        style={{
          position: "absolute",
          left: `${basePosition.x}px`,
          top: `${basePosition.y}px`,
          width: `${size}px`,
          height: `${size}px`,
          pointerEvents: "all",
          cursor: isThisLegoDragged ? "grabbing" : "grab",
          userSelect: "none",
          zIndex: 0,
          opacity: isThisLegoDragged ? 0.5 : 1,
          filter: isSelected
            ? "drop-shadow(0 0 4px rgba(66, 153, 225, 0.5))"
            : "none",
          transform: demoMode
            ? "scale(0.5) translate(-50%, -50%)"
            : `translate(${dragOffset.x - size / 2}px, ${dragOffset.y - size / 2}px)`
        }}
        onMouseDown={(e) => handleLegoMouseDown(e, index)}
        onClick={(e) => handleLegoClick(e, lego)}
      >
        <svg
          width={size}
          height={size}
          style={{
            pointerEvents: "all",
            position: "absolute",
            left: `${0}px`,
            top: `${0}px`,
            overflow: "visible"
          }}
          className="lego-svg"
          transform={demoMode ? "" : `translate(${size / 2}, ${size / 2})`}
        >
          {/* Layer 1: Static leg lines (gray background) */}
          <StaticLegsLayer
            legPositions={legPositions}
            shouldHideLeg={shouldHideLeg}
          />

          {/* Layer 2: Dynamic leg highlights (colored lines behind lego body) */}
          {legPositions.map((pos, legIndex) => {
            const legColor = pos.style.color;
            const shouldHide = shouldHideLeg(legIndex);

            if (legColor === "#A0AEC0" || shouldHide) {
              return null;
            }

            return (
              <g key={`highlight-leg-${legIndex}`}>
                <line
                  x1={pos.startX}
                  y1={pos.startY}
                  x2={pos.endX}
                  y2={pos.endY}
                  stroke={legColor}
                  strokeWidth={4}
                  strokeDasharray={
                    pos.style.style === "dashed" ? "5,5" : undefined
                  }
                  style={{ pointerEvents: "none" }}
                />
              </g>
            );
          })}

          {/* Layer 3: Lego body */}
          <LegoBodyLayer
            lego={lego}
            size={size}
            numRegularLegs={numRegularLegs}
            isSelected={isSelected || false}
          />

          {/* Layer 4: Interactive leg endpoints and logical leg interactions */}
          {legPositions.map((pos, legIndex) => {
            const isLogical = lego.logical_legs.includes(legIndex);
            const legColor = pos.style.color;
            const isBeingDragged =
              legDragState?.isDragging &&
              legDragState.legoId === lego.instanceId &&
              legDragState.legIndex === legIndex;

            const shouldHide = shouldHideLeg(legIndex);

            if (shouldHide) {
              return null;
            }

            return (
              <g key={`interactive-leg-${legIndex}`}>
                {/* Logical leg interactive line - rendered on top for clicks */}
                {isLogical && (
                  <line
                    x1={pos.startX}
                    y1={pos.startY}
                    x2={pos.endX}
                    y2={pos.endY}
                    stroke="transparent"
                    strokeWidth={8}
                    style={{
                      cursor: "pointer",
                      pointerEvents: "all"
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleLegClick(lego.instanceId, legIndex);
                    }}
                  />
                )}

                {/* Draggable Endpoint */}
                <circle
                  cx={pos.endX}
                  cy={pos.endY}
                  r={LEG_ENDPOINT_RADIUS}
                  fill={isBeingDragged ? "rgb(235, 248, 255)" : "white"}
                  stroke={isBeingDragged ? "rgb(66, 153, 225)" : legColor}
                  strokeWidth="2"
                  style={{
                    cursor: "pointer",
                    pointerEvents: "all",
                    transition: "stroke 0.2s, fill 0.2s"
                  }}
                  onMouseDown={(e) => {
                    e.stopPropagation();
                    handleLegMouseDown(e, lego.instanceId, legIndex);
                  }}
                  onMouseOver={(e) => {
                    if (!isBeingDragged) {
                      const circle = e.target as SVGCircleElement;
                      circle.style.stroke = legColor;
                      circle.style.fill = "rgb(235, 248, 255)";
                    }
                  }}
                  onMouseOut={(e) => {
                    if (!isBeingDragged) {
                      const circle = e.target as SVGCircleElement;
                      circle.style.stroke = legColor;
                      circle.style.fill = "white";
                    }
                  }}
                />
              </g>
            );
          })}

          {/* Text content - selection-aware */}
          {!demoMode && (
            <g>
              {numRegularLegs <= 2 ? (
                <g transform={`translate(-${size / 2}, -${size / 2})`}>
                  {lego.style.displayShortName ? (
                    <g>
                      <text
                        x={size / 2}
                        y={size / 2 - 6}
                        fontSize="12"
                        fontWeight="bold"
                        textAnchor="middle"
                        dominantBaseline="middle"
                        fill={isSelected ? "white" : "#000000"}
                      >
                        {lego.shortName}
                      </text>
                      <text
                        x={size / 2}
                        y={size / 2 + 6}
                        fontSize="12"
                        textAnchor="middle"
                        dominantBaseline="middle"
                        fill={isSelected ? "white" : "#000000"}
                      >
                        {lego.instanceId}
                      </text>
                    </g>
                  ) : (
                    <text
                      x={size / 2}
                      y={size / 2}
                      fontSize="12"
                      fontWeight="bold"
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fill={isSelected ? "white" : "#000000"}
                    >
                      {lego.instanceId}
                    </text>
                  )}
                </g>
              ) : (
                <text
                  x="0"
                  y={lego.logical_legs.length > 0 ? 5 : 0}
                  fontSize="10"
                  fontWeight="bold"
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fill={isSelected ? "white" : "#000000"}
                  style={{ pointerEvents: "none" }}
                >
                  {lego.style.displayShortName ? (
                    <>
                      {lego.shortName}
                      <tspan x="0" dy="12">
                        {lego.instanceId}
                      </tspan>
                    </>
                  ) : (
                    lego.instanceId
                  )}
                </text>
              )}
            </g>
          )}

          {/* Leg Labels - dynamic visibility */}
          {!isScalarLego(lego) &&
            !demoMode &&
            legPositions.map((pos, legIndex) => {
              // Check if leg is connected
              const isLegConnectedToSomething = connections.some(
                (c) =>
                  (c.from.legoId === lego.instanceId &&
                    c.from.legIndex === legIndex) ||
                  (c.to.legoId === lego.instanceId &&
                    c.to.legIndex === legIndex)
              );

              // If leg is not connected, always show the label
              if (!isLegConnectedToSomething) {
                return (
                  <text
                    key={`${lego.instanceId}-label-${legIndex}`}
                    x={pos.labelX}
                    y={pos.labelY}
                    fontSize="12"
                    fill="#666666"
                    textAnchor="middle"
                    dominantBaseline="middle"
                    style={{ pointerEvents: "none" }}
                  >
                    {legIndex}
                  </text>
                );
              }

              const thisLegStyle = lego.style.getLegStyle(legIndex, lego);
              const isThisHighlighted = thisLegStyle.is_highlighted;

              // Find the connected leg's style
              const connection = connections.find(
                (c) =>
                  (c.from.legoId === lego.instanceId &&
                    c.from.legIndex === legIndex) ||
                  (c.to.legoId === lego.instanceId &&
                    c.to.legIndex === legIndex)
              );

              if (!connection) return null;

              const connectedLegInfo =
                connection.from.legoId === lego.instanceId
                  ? connection.to
                  : connection.from;

              const connectedLego = droppedLegos.find(
                (l) => l.instanceId === connectedLegInfo.legoId
              );
              if (!connectedLego) return null;

              const connectedStyle = connectedLego.style.getLegStyle(
                connectedLegInfo.legIndex,
                connectedLego
              );

              // Hide label if conditions are met
              const shouldHideLabel =
                hideConnectedLegs &&
                !lego.alwaysShowLegs &&
                (!isThisHighlighted
                  ? !connectedStyle.is_highlighted
                  : connectedStyle.is_highlighted &&
                    connectedStyle.color === thisLegStyle.color);

              if (shouldHideLabel) return null;

              return (
                <text
                  key={`${lego.instanceId}-label-${legIndex}`}
                  x={pos.labelX}
                  y={pos.labelY}
                  fontSize="12"
                  fill="#666666"
                  textAnchor="middle"
                  dominantBaseline="middle"
                  style={{ pointerEvents: "none" }}
                >
                  {legIndex}
                </text>
              );
            })}
        </svg>
      </div>
    );
  }
);

DroppedLegoDisplay.displayName = "DroppedLegoDisplay";
