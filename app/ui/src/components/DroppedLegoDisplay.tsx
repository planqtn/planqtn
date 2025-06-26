import { DroppedLego, LegDragState, DragState, Connection } from "../lib/types";
import { TensorNetwork } from "../lib/TensorNetwork";
import { LegStyle } from "../LegoStyles";
import { useMemo, memo } from "react";

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
  legDragState: LegDragState | null;
  handleLegMouseDown: (
    e: React.MouseEvent,
    legoId: string,
    legIndex: number
  ) => void;
  handleLegoMouseDown: (e: React.MouseEvent, index: number) => void;
  handleLegoClick: (e: React.MouseEvent, lego: DroppedLego) => void;
  tensorNetwork: TensorNetwork | null;
  dragState: DragState | null;
  onLegClick?: (legoId: string, legIndex: number) => void;
  hideConnectedLegs: boolean;
  connections: Connection[];
  droppedLegos?: DroppedLego[];
  demoMode: boolean;
}

// Memoized component for static SVG content
const StaticLegoSVG = memo<{
  lego: DroppedLego;
  size: number;
  numRegularLegs: number;
  legPositions: LegPosition[];
  shouldHideLeg: (legIndex: number) => boolean;
}>(({ lego, size, numRegularLegs, legPositions, shouldHideLeg }) => {
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
            fill={lego.style.getBackgroundColorForSvg()}
            stroke={lego.style.getBorderColorForSvg()}
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
              fill={lego.style.getBackgroundColorForSvg()}
              stroke={lego.style.getBorderColorForSvg()}
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
              fill={lego.style.getBackgroundColorForSvg()}
              stroke={lego.style.getBorderColorForSvg()}
              strokeWidth="2"
            />
          )}
        </g>
      )}
    </>
  );
});

StaticLegoSVG.displayName = "StaticLegoSVG";

export const DroppedLegoDisplay: React.FC<DroppedLegoDisplayProps> = memo(
  ({
    lego,
    index,
    legDragState,
    handleLegMouseDown,
    handleLegoMouseDown,
    handleLegoClick,
    tensorNetwork,
    dragState,
    onLegClick,
    hideConnectedLegs,
    connections,
    droppedLegos = [],
    demoMode = false
  }) => {
    const size = lego.style.size;
    const numAllLegs = lego.parity_check_matrix[0].length / 2;
    const isScalar =
      lego.parity_check_matrix.length === 1 &&
      lego.parity_check_matrix[0].length === 1;
    const numLogicalLegs = lego.logical_legs.length;
    const numGaugeLegs = lego.gauge_legs.length;
    const numRegularLegs = numAllLegs - numLogicalLegs - numGaugeLegs;

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
    }, [lego.parity_check_matrix, lego.style, isScalar, numAllLegs]);

    // Calculate drag offset for performance during dragging
    const dragOffset = useMemo(() => {
      if (!dragState?.isDragging) return { x: 0, y: 0 };

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
      if (!dragState?.isDragging) return false;

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

    // Function to get leg visibility style
    const getLegVisibility = (legIndex: number) => {
      if (shouldHideLeg(legIndex)) {
        return {
          visibility: "hidden" as const,
          pointerEvents: "none" as const
        };
      }
      return { visibility: "visible" as const, pointerEvents: "all" as const };
    };

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
          {/* Static content - memoized */}
          <StaticLegoSVG
            lego={lego}
            size={size}
            numRegularLegs={numRegularLegs}
            legPositions={legPositions}
            shouldHideLeg={shouldHideLeg}
          />

          {/* Dynamic content - selection state and highlighting */}
          {isSelected && (
            <g>
              {/* Selection highlight overlay on lego body */}
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
                    fill={lego.style.getSelectedBackgroundColorForSvg()}
                    stroke={lego.style.getSelectedBorderColorForSvg()}
                    strokeWidth="2"
                  />
                </g>
              ) : (
                <g>
                  {numRegularLegs > 8 ? (
                    <circle
                      cx="0"
                      cy="0"
                      r={size / 2}
                      fill={lego.style.getSelectedBackgroundColorForSvg()}
                      stroke={lego.style.getSelectedBorderColorForSvg()}
                      strokeWidth="2"
                    />
                  ) : (
                    <path
                      d={
                        Array.from({ length: numRegularLegs }, (_, i) => {
                          const command = i === 0 ? "M" : "L";
                          const x =
                            (size / 2) *
                            Math.cos(
                              -Math.PI / 2 + (2 * Math.PI * i) / numRegularLegs
                            );
                          const y =
                            (size / 2) *
                            Math.sin(
                              -Math.PI / 2 + (2 * Math.PI * i) / numRegularLegs
                            );
                          return `${command} ${x} ${y}`;
                        }).reduce((pathAcc, vertex) => pathAcc + vertex, "") +
                        " Z"
                      }
                      fill={lego.style.getSelectedBackgroundColorForSvg()}
                      stroke={lego.style.getSelectedBorderColorForSvg()}
                      strokeWidth="2"
                    />
                  )}
                </g>
              )}
            </g>
          )}

          {/* Dynamic leg content - colors, highlights, interactions */}
          {legPositions.map((pos, legIndex) => {
            const isLogical = lego.logical_legs.includes(legIndex);
            const legColor = pos.style.color;
            const isBeingDragged =
              legDragState?.isDragging &&
              legDragState.legoId === lego.instanceId &&
              legDragState.legIndex === legIndex;

            const legVisibility = getLegVisibility(legIndex);

            return (
              <g key={`dynamic-leg-${legIndex}`} style={legVisibility}>
                {/* Dynamic colored leg line - only if different from default */}
                {legColor !== "#A0AEC0" && (
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
                    style={{
                      cursor: isLogical ? "pointer" : "default",
                      pointerEvents: isLogical ? "all" : "none"
                    }}
                    onClick={(e) => {
                      if (isLogical && onLegClick) {
                        e.stopPropagation();
                        onLegClick(lego.instanceId, legIndex);
                      }
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
