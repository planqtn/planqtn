import { Connection, PauliOperator } from "../../lib/types.ts";
import { DroppedLego } from "../../stores/droppedLegoStore.ts";
import { TensorNetwork } from "../../lib/TensorNetwork.ts";
import { LegPosition, LegStyle } from "./LegoStyles.ts";
import { useMemo, memo, useEffect } from "react";
import { simpleAutoFlow } from "../../transformations/AutoPauliFlow.ts";
import { useLegDragStateStore } from "../../stores/legDragState.ts";
import { useCanvasStore } from "../../stores/canvasStateStore.ts";
import { DraggingStage } from "../../stores/legoDragState.ts";

const LEG_ENDPOINT_RADIUS = 5;

// Add shared function for leg position calculations

export function getLegoBoundingBox(
  lego: DroppedLego,
  demoMode: boolean
): {
  top: number;
  left: number;
  width: number;
  height: number;
} {
  const endpointFn = (pos: LegPosition) => {
    return demoMode
      ? { x: pos.endX, y: pos.endY }
      : { x: pos.labelX, y: pos.labelY };
  };

  // Calculate SVG dimensions to accommodate all legs
  const maxEndpointX = Math.max(
    ...lego.style!.legStyles.map((legStyle) => endpointFn(legStyle.position).x),
    lego.style!.size / 2
  );
  const minEndpointX = Math.min(
    ...lego.style!.legStyles.map((legStyle) => endpointFn(legStyle.position).x),
    0
  );

  const maxEndpointY = Math.max(
    ...lego.style!.legStyles.map((legStyle) => endpointFn(legStyle.position).y),
    +lego.style!.size / 2
  );
  const minEndpointY = Math.min(
    ...lego.style!.legStyles.map((legStyle) => endpointFn(legStyle.position).y),
    -lego.style!.size / 2
  );

  return {
    top: minEndpointY,
    left: minEndpointX,
    width: maxEndpointX - minEndpointX,
    height: maxEndpointY - minEndpointY
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
  legStyles: LegStyle[];
  shouldHideLeg: (legIndex: number) => boolean;
}>(({ legStyles, shouldHideLeg }) => {
  return (
    <>
      {/* Static leg lines - rendered first, conditionally hidden */}
      {legStyles.map((legStyle, legIndex) =>
        shouldHideLeg(legIndex) ? null : (
          <line
            key={`static-leg-${legIndex}`}
            x1={legStyle.position.startX}
            y1={legStyle.position.startY}
            x2={legStyle.position.endX}
            y2={legStyle.position.endY}
            stroke="#A0AEC0" // Default gray color for static rendering
            strokeWidth="2"
            strokeDasharray={
              legStyle.lineStyle === "dashed" ? "5,5" : undefined
            }
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
              typeof lego.style!.borderRadius === "string" &&
              lego.style!.borderRadius === "full"
                ? size / 2
                : typeof lego.style!.borderRadius === "number"
                  ? lego.style!.borderRadius
                  : 0
            }
            ry={
              typeof lego.style!.borderRadius === "string" &&
              lego.style!.borderRadius === "full"
                ? size / 2
                : typeof lego.style!.borderRadius === "number"
                  ? lego.style!.borderRadius
                  : 0
            }
            fill={
              isSelected
                ? lego.style!.getSelectedBackgroundColorForSvg()
                : lego.style!.getBackgroundColorForSvg()
            }
            stroke={
              isSelected
                ? lego.style!.getSelectedBorderColorForSvg()
                : lego.style!.getBorderColorForSvg()
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
                  ? lego.style!.getSelectedBackgroundColorForSvg()
                  : lego.style!.getBackgroundColorForSvg()
              }
              stroke={
                isSelected
                  ? lego.style!.getSelectedBorderColorForSvg()
                  : lego.style!.getBorderColorForSvg()
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
                  ? lego.style!.getSelectedBackgroundColorForSvg()
                  : lego.style!.getBackgroundColorForSvg()
              }
              stroke={
                isSelected
                  ? lego.style!.getSelectedBorderColorForSvg()
                  : lego.style!.getBorderColorForSvg()
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
    const size = lego.style!.size;
    const numAllLegs = lego.numberOfLegs;
    const numLogicalLegs = lego.logical_legs.length;
    const numGaugeLegs = lego.gauge_legs.length;
    const numRegularLegs = numAllLegs - numLogicalLegs - numGaugeLegs;

    // Optimize store subscriptions to prevent unnecessary rerenders
    const connections = useCanvasStore((state) => state.connections);
    const hideConnectedLegs = useCanvasStore(
      (state) => state.hideConnectedLegs
    );

    const setDroppedLegos = useCanvasStore((state) => state.setDroppedLegos);

    const addConnections = useCanvasStore((state) => state.addConnections);
    const addOperation = useCanvasStore((state) => state.addOperation);
    const temporarilyConnectLego = useCanvasStore(
      (state) => state.temporarilyConnectLego
    );
    const updateLegoConnectivity = useCanvasStore(
      (state) => state.updateLegoConnectivity
    );

    // Only subscribe to the specific drag state properties that matter for this lego
    const isThisLegoBeingDragged = useCanvasStore((state) => {
      return (
        state.dragState.draggedLegoIndex === index &&
        state.dragState.draggingStage === DraggingStage.DRAGGING
      );
    });

    useEffect(() => {
      console.log(
        "lego",
        lego.instanceId,
        "render due to connections change",
        connections
      );
    }, [connections]);

    useEffect(() => {
      console.log(
        "lego",
        lego.instanceId,
        "isThisLegoBeingDragged changed to:",
        isThisLegoBeingDragged
      );
    }, [isThisLegoBeingDragged, lego.instanceId]);

    console.log("lego", lego.instanceId, "render due to rerender");

    const setTensorNetwork = useCanvasStore((state) => state.setTensorNetwork);
    const setLegDragState = useLegDragStateStore(
      (state) => state.setLegDragState
    );
    const { legDragState } = useLegDragStateStore();

    // Optimize tensor network subscription to only trigger when this lego's selection changes
    // But still maintain access to the full tensor network for operations
    const isSelected = useCanvasStore((state) => {
      return (
        state.tensorNetwork?.legos.some(
          (l) => l.instanceId === lego.instanceId
        ) || false
      );
    });

    // Add effect to log when selection changes for this specific lego
    useEffect(() => {
      console.log(
        "lego",
        lego.instanceId,
        "selection state changed to:",
        isSelected
      );
    }, [isSelected, lego.instanceId]);

    // Use base position (without drag offset) for all calculations
    const basePosition = useMemo(
      () => ({
        x: demoMode ? lego.x : lego.x,
        y: demoMode ? lego.y : lego.y
      }),
      [lego.x, lego.y, demoMode]
    );

    // Check if this specific lego is being dragged
    const isThisLegoDragged = isThisLegoBeingDragged;

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

      const thisLegStyle = lego.style!.legStyles[legIndex];
      const isThisHighlighted = thisLegStyle.is_highlighted;

      // If this leg is not highlighted, hide it only if connected to a non-highlighted leg
      if (!isThisHighlighted) {
        // Check if connected to a highlighted leg
        return !connections.some((conn) => {
          if (
            conn.from.legoId === lego.instanceId &&
            conn.from.legIndex === legIndex
          ) {
            // Get connected lego from store instead of passed prop
            const connectedLego = useCanvasStore
              .getState()
              .droppedLegos?.find((l) => l.instanceId === conn.to.legoId);
            return (
              connectedLego?.style!.legStyles[conn.to.legIndex]
                .is_highlighted || false
            );
          }
          if (
            conn.to.legoId === lego.instanceId &&
            conn.to.legIndex === legIndex
          ) {
            // Get connected lego from store instead of passed prop
            const connectedLego = useCanvasStore
              .getState()
              .droppedLegos?.find((l) => l.instanceId === conn.from.legoId);
            return (
              connectedLego?.style!.legStyles[conn.from.legIndex]
                .is_highlighted || false
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
          // Get connected lego from store instead of passed prop
          const connectedLego = useCanvasStore
            .getState()
            .droppedLegos?.find((l) => l.instanceId === conn.to.legoId);
          const connectedStyle =
            connectedLego?.style!.legStyles[conn.to.legIndex];
          return (
            connectedStyle?.is_highlighted &&
            connectedStyle.color === thisLegStyle.color
          );
        }
        if (
          conn.to.legoId === lego.instanceId &&
          conn.to.legIndex === legIndex
        ) {
          // Get connected lego from store instead of passed prop
          const connectedLego = useCanvasStore
            .getState()
            .droppedLegos?.find((l) => l.instanceId === conn.from.legoId);
          const connectedStyle =
            connectedLego?.style!.legStyles[conn.from.legIndex];
          return (
            connectedStyle?.is_highlighted &&
            connectedStyle.color === thisLegStyle.color
          );
        }
        return false;
      });
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

      temporarilyConnectLego(legoId);

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
      const clickedLego = useCanvasStore
        .getState()
        .droppedLegos.find((lego) => lego.instanceId === legoId);
      if (!clickedLego) return;
      const numQubits = clickedLego.numberOfLegs;
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
      const updatedLego = clickedLego.with({
        selectedMatrixRows: selectedRows
      });

      // Update the selected tensornetwork state
      setTensorNetwork(
        new TensorNetwork({ legos: [updatedLego], connections: [] })
      );

      // Update droppedLegos by replacing the old lego with the new one
      const newDroppedLegos = useCanvasStore
        .getState()
        .droppedLegos.map((lego) =>
          lego.instanceId === legoId ? updatedLego : lego
        );
      setDroppedLegos(newDroppedLegos);

      simpleAutoFlow(
        updatedLego,
        newDroppedLegos,
        connections,
        setDroppedLegos
      );
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

    const handleLegMouseUp = (e: React.MouseEvent, i: number) => {
      e.stopPropagation();
      if (!legDragState) return;

      const isSourceLegConnected = connections.some(
        (conn) =>
          (conn.from.legoId === legDragState.legoId &&
            conn.from.legIndex === legDragState.legIndex) ||
          (conn.to.legoId === legDragState.legoId &&
            conn.to.legIndex === legDragState.legIndex)
      );
      const isTargetLegConnected = connections.some(
        (conn) =>
          (conn.from.legoId === lego.instanceId && conn.from.legIndex === i) ||
          (conn.to.legoId === lego.instanceId && conn.to.legIndex === i)
      );

      if (
        lego.instanceId === legDragState.legoId &&
        i === legDragState.legIndex
      ) {
        setLegDragState(null);
        updateLegoConnectivity(legDragState.legoId);

        return;
      }

      if (isSourceLegConnected || isTargetLegConnected) {
        //TODO: set error message
        // setError("Cannot connect to a leg that is already connected");
        console.error("Cannot connect to a leg that is already connected");
        setLegDragState(null);
        updateLegoConnectivity(legDragState.legoId);

        return;
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
        setLegDragState(null);
        updateLegoConnectivity(legDragState.legoId);

        return;
      }

      setLegDragState(null);
      updateLegoConnectivity(legDragState.legoId);
    };

    const isScalarLego = (lego: DroppedLego) => {
      return (
        lego.parity_check_matrix.length === 1 &&
        lego.parity_check_matrix[0].length === 1
      );
    };

    const storeHandleLegoClick = useCanvasStore(
      (state) => state.handleLegoClick
    );
    const storeHandleLegoMouseDown = useCanvasStore(
      (state) => state.handleLegoMouseDown
    );

    const handleLegoClick = (e: React.MouseEvent<HTMLDivElement>) => {
      storeHandleLegoClick(lego, e.ctrlKey, e.metaKey);
    };

    const handleLegoMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      storeHandleLegoMouseDown(index, e.clientX, e.clientY, e.shiftKey);
    };

    return (
      <>
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
              : "translate(-50%, -50%)"
          }}
          onClick={handleLegoClick}
          onMouseDown={handleLegoMouseDown}
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
              legStyles={lego.style!.legStyles}
              shouldHideLeg={shouldHideLeg}
            />

            {/* Layer 2: Dynamic leg highlights (colored lines behind lego body) */}
            {lego.style!.legStyles.map((legStyle, legIndex) => {
              const legColor = legStyle.color;
              const shouldHide = shouldHideLeg(legIndex);

              if (legColor === "#A0AEC0" || shouldHide) {
                return null;
              }

              return (
                <g key={`highlight-leg-${legIndex}`}>
                  <line
                    x1={legStyle.position.startX}
                    y1={legStyle.position.startY}
                    x2={legStyle.position.endX}
                    y2={legStyle.position.endY}
                    stroke={legColor}
                    strokeWidth={4}
                    strokeDasharray={
                      legStyle.lineStyle === "dashed" ? "5,5" : undefined
                    }
                    style={{ pointerEvents: "none" }}
                  />
                </g>
              );
            })}

            {/* Layer 3: Interactive leg endpoints and logical leg interactions */}
            {lego.style!.legStyles.map((legStyle, legIndex) => {
              const isLogical = lego.logical_legs.includes(legIndex);
              const legColor = legStyle.color;
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
                      x1={legStyle.position.startX}
                      y1={legStyle.position.startY}
                      x2={legStyle.position.endX}
                      y2={legStyle.position.endY}
                      stroke="transparent"
                      strokeWidth={5}
                      onMouseOver={(e) => {
                        e.stopPropagation();
                        const line = e.target as SVGLineElement;
                        line.style.stroke = legColor;
                      }}
                      onMouseOut={(e) => {
                        e.stopPropagation();
                        const line = e.target as SVGLineElement;
                        line.style.stroke = "transparent";
                      }}
                      style={{
                        cursor: "pointer",
                        pointerEvents: "visibleStroke"
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleLegClick(lego.instanceId, legIndex);
                      }}
                    />
                  )}

                  {/* Draggable Endpoint */}
                  <circle
                    cx={legStyle.position.endX}
                    cy={legStyle.position.endY}
                    r={LEG_ENDPOINT_RADIUS}
                    className="leg-endpoint"
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
                    onMouseUp={(e) => {
                      e.stopPropagation();
                      handleLegMouseUp(e, legIndex);
                    }}
                  />
                </g>
              );
            })}

            {/* Layer 4: Lego body */}
            <LegoBodyLayer
              lego={lego}
              size={size}
              numRegularLegs={numRegularLegs}
              isSelected={isSelected || false}
            />

            {/* Text content - selection-aware */}
            {!demoMode && (
              <g>
                {numRegularLegs <= 2 ? (
                  <g transform={`translate(-${size / 2}, -${size / 2})`}>
                    {lego.style!.displayShortName ? (
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
                    {lego.style!.displayShortName ? (
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
              lego.style!.legStyles.map((legStyle, legIndex) => {
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
                      x={legStyle.position.labelX}
                      y={legStyle.position.labelY}
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

                const thisLegStyle = lego.style!.legStyles[legIndex];
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

                const connectedLego = useCanvasStore
                  .getState()
                  .droppedLegos.find(
                    (l) => l.instanceId === connectedLegInfo.legoId
                  );
                if (!connectedLego) return null;

                const connectedStyle =
                  connectedLego.style!.legStyles[connectedLegInfo.legIndex];

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
                    x={legStyle.position.labelX}
                    y={legStyle.position.labelY}
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
      </>
    );
  }
);

DroppedLegoDisplay.displayName = "DroppedLegoDisplay";
