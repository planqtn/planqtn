import { DroppedLego } from "../../stores/droppedLegoStore.ts";
import { LegPosition, LegStyle } from "./LegoStyles.ts";
import { useMemo, memo } from "react";
import { useCanvasStore } from "../../stores/canvasStateStore.ts";
import { DraggingStage } from "../../stores/legoDragState.ts";
import { Connection } from "../../stores/connectionStore";
import {
  getSmartLegoSize,
  getLevelOfDetail
} from "../../utils/coordinateTransforms.ts";
import { useShallow } from "zustand/react/shallow";
import { WindowPoint } from "../../types/coordinates.ts";

const LEG_ENDPOINT_RADIUS = 5;

// Add shared function for leg position calculations

export function getLegoBoundingBox(
  lego: DroppedLego,
  demoMode: boolean,
  zoomLevel: number = 1
): {
  top: number;
  left: number;
  width: number;
  height: number;
} {
  // Use smart zoom size calculation
  const originalSize = lego.style!.size;
  const size = demoMode
    ? originalSize
    : getSmartLegoSize(originalSize, zoomLevel);

  const endpointFn = (pos: LegPosition) => {
    return demoMode
      ? { x: pos.endX, y: pos.endY }
      : { x: pos.labelX, y: pos.labelY };
  };

  // Calculate SVG dimensions to accommodate all legs
  const maxEndpointX = Math.max(
    ...lego.style!.legStyles.map((legStyle) => endpointFn(legStyle.position).x),
    size / 2
  );
  const minEndpointX = Math.min(
    ...lego.style!.legStyles.map((legStyle) => endpointFn(legStyle.position).x),
    0
  );

  const maxEndpointY = Math.max(
    ...lego.style!.legStyles.map((legStyle) => endpointFn(legStyle.position).y),
    +size / 2
  );
  const minEndpointY = Math.min(
    ...lego.style!.legStyles.map((legStyle) => endpointFn(legStyle.position).y),
    -size / 2
  );

  return {
    top: minEndpointY,
    left: minEndpointX,
    width: maxEndpointX - minEndpointX,
    height: maxEndpointY - minEndpointY
  };
}

interface DroppedLegoDisplayProps {
  legoInstanceId: string;
  demoMode: boolean;
}

// Memoized component for static leg lines only
const StaticLegsLayer = memo<{
  legStyles: LegStyle[];
  shouldHideLeg: boolean[];
}>(({ legStyles, shouldHideLeg }) => {
  return (
    <>
      {/* Static leg lines - rendered first, conditionally hidden */}
      {legStyles.map((legStyle, legIndex) =>
        shouldHideLeg[legIndex] ? null : (
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
  ({ legoInstanceId, demoMode = false }) => {
    const lego = useCanvasStore(
      (state) =>
        state.droppedLegos.find((l) => l.instanceId === legoInstanceId)!
    );

    const canvasRef = useCanvasStore((state) => state.canvasRef);
    // Get zoom level for smart scaling
    const viewport = useCanvasStore((state) => state.viewport);
    const zoomLevel = viewport.zoomLevel;

    const canvasPosition = viewport.fromLogicalToCanvas(lego.logicalPosition);

    // Use smart zoom position for calculations with central coordinate system
    const basePosition = useMemo(() => {
      if (demoMode) {
        return { x: lego.logicalPosition.x, y: lego.logicalPosition.y };
      }
      return canvasPosition;
    }, [lego.logicalPosition, demoMode, canvasPosition]);

    const storeHandleLegMouseDown = useCanvasStore(
      (state) => state.handleLegMouseDown
    );
    const storeHandleLegClick = useCanvasStore((state) => state.handleLegClick);
    const storeHandleLegMouseUp = useCanvasStore(
      (state) => state.handleLegMouseUp
    );

    const legConnectionStates = useCanvasStore(
      useShallow((state) =>
        lego ? state.legConnectionStates[lego.instanceId] || [] : []
      )
    );

    // Optimize store subscriptions to prevent unnecessary rerenders
    const legoConnections = useCanvasStore(
      useShallow((state) =>
        lego ? state.legoConnectionMap[lego.instanceId] || [] : []
      )
    );

    const hideConnectedLegs = useCanvasStore(
      (state) => state.hideConnectedLegs
    );

    // Only subscribe to the specific drag state properties that matter for this lego
    const isThisLegoBeingDragged = useCanvasStore((state) => {
      if (state.legoDragState.draggedLegoInstanceId === "") return false;
      const draggedLego = state.droppedLegos.find(
        (l) => l.instanceId === state.legoDragState.draggedLegoInstanceId
      );
      return (
        draggedLego?.instanceId === lego.instanceId &&
        state.legoDragState.draggingStage === DraggingStage.DRAGGING
      );
    });

    // Optimize tensor network subscription to only trigger when this lego's selection changes
    const isSelected = useCanvasStore((state) => {
      return (
        (lego &&
          state.tensorNetwork?.legos.some(
            (l) => l.instanceId === lego.instanceId
          )) ||
        false
      );
    });

    const legHiddenStates = useCanvasStore(
      useShallow((state) =>
        lego ? state.legHideStates[lego.instanceId] || [] : []
      )
    );

    const storeHandleLegoClick = useCanvasStore(
      (state) => state.handleLegoClick
    );
    const storeHandleLegoMouseDown = useCanvasStore(
      (state) => state.handleLegoMouseDown
    );

    const staticShouldHideLeg = useMemo(
      () => legHiddenStates,
      [legHiddenStates]
    );

    // Early return AFTER all hooks are called
    if (!lego) return null;

    // Now we can safely use lego without null checks
    const originalSize = lego.style!.size;
    const smartSize = demoMode
      ? originalSize
      : getSmartLegoSize(originalSize, zoomLevel);
    const size = smartSize;

    // Calculate level of detail based on effective size
    const lod = getLevelOfDetail(smartSize, zoomLevel);

    const numAllLegs = lego.numberOfLegs;
    const numLogicalLegs = lego.logical_legs.length;
    const numGaugeLegs = lego.gauge_legs.length;
    const numRegularLegs = numAllLegs - numLogicalLegs - numGaugeLegs;

    // Check if this specific lego is being dragged
    const isThisLegoDragged = isThisLegoBeingDragged;

    // Helper function to generate connection key (same as in ConnectionsLayer)
    const getConnectionKey = (conn: Connection) => {
      const [firstId, firstLeg, secondId, secondLeg] =
        conn.from.legoId < conn.to.legoId
          ? [
              conn.from.legoId,
              conn.from.legIndex,
              conn.to.legoId,
              conn.to.legIndex
            ]
          : [
              conn.to.legoId,
              conn.to.legIndex,
              conn.from.legoId,
              conn.from.legIndex
            ];
      return `${firstId}-${firstLeg}-${secondId}-${secondLeg}`;
    };

    const handleLegMouseDown = (
      e: React.MouseEvent,
      legoId: string,
      legIndex: number
    ) => {
      if (!canvasRef) return;

      e.preventDefault();
      e.stopPropagation();

      storeHandleLegMouseDown(
        legoId,
        legIndex,
        WindowPoint.fromMouseEvent(e as unknown as MouseEvent)
      );
    };

    const handleLegClick = (legoId: string, legIndex: number) => {
      storeHandleLegClick(legoId, legIndex);
    };

    const handleLegMouseUp = (e: React.MouseEvent, i: number) => {
      e.stopPropagation();
      storeHandleLegMouseUp(lego.instanceId, i);
    };

    const isScalarLego = (lego: DroppedLego) => {
      return (
        lego.parity_check_matrix.length === 1 &&
        lego.parity_check_matrix[0].length === 1
      );
    };

    const handleLegoClick = (e: React.MouseEvent<HTMLDivElement>) => {
      storeHandleLegoClick(lego, e.ctrlKey, e.metaKey);
    };

    const handleLegoMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      storeHandleLegoMouseDown(
        lego.instanceId,
        e.clientX,
        e.clientY,
        e.shiftKey
      );
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
            {/* Layer 1: Static leg lines (gray background) - with LOD */}
            {lod.showLegs && (
              <StaticLegsLayer
                legStyles={lego.style!.legStyles}
                shouldHideLeg={staticShouldHideLeg}
              />
            )}

            {/* Layer 2: Dynamic leg highlights (colored lines behind lego body) - with LOD */}
            {lod.showLegs &&
              lego.style!.legStyles.map((legStyle, legIndex) => {
                const legColor = lego.style!.getLegColor(legIndex);
                const shouldHide = legHiddenStates[legIndex];

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

            {/* Layer 3: Interactive leg endpoints and logical leg interactions - with LOD */}
            {lod.showLegs &&
              lego.style!.legStyles.map((legStyle, legIndex) => {
                const isLogical = lego.logical_legs.includes(legIndex);
                const legColor = lego.style!.getLegColor(legIndex);

                const shouldHide = legHiddenStates[legIndex];

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
                      fill={"white"}
                      stroke={legColor}
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
                        const circle = e.target as SVGCircleElement;
                        circle.style.stroke = legColor;
                        circle.style.fill = "rgb(235, 248, 255)";
                      }}
                      onMouseOut={(e) => {
                        const circle = e.target as SVGCircleElement;
                        circle.style.stroke = legColor;
                        circle.style.fill = "white";
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

            {/* Text content - selection-aware with LOD */}
            {!demoMode && lod.showText && (
              <g>
                {numRegularLegs <= 2 ? (
                  <g transform={`translate(-${size / 2}, -${size / 2})`}>
                    {lod.showShortName && lego.style!.displayShortName ? (
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
                    {lod.showShortName && lego.style!.displayShortName ? (
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

            {/* Leg Labels - dynamic visibility with LOD */}
            {!isScalarLego(lego) &&
              !demoMode &&
              lod.showLegLabels &&
              lego.style!.legStyles.map((legStyle, legIndex) => {
                // If the leg is hidden, don't render the label
                if (legHiddenStates[legIndex]) return null;

                // Check if leg is connected using pre-calculated states
                const isLegConnectedToSomething =
                  legConnectionStates[legIndex] || false;

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

                // Find the connected leg's style
                const connection = legoConnections.find(
                  (c) =>
                    (c.from.legoId === lego.instanceId &&
                      c.from.legIndex === legIndex) ||
                    (c.to.legoId === lego.instanceId &&
                      c.to.legIndex === legIndex)
                );

                if (!connection) return null;

                // Use the new connection highlight states from the store
                const connectionKey = getConnectionKey(connection);
                const colorsMatch = useCanvasStore
                  .getState()
                  .getConnectionHighlightState(connectionKey);

                // Hide label if conditions are met
                const shouldHideLabel =
                  hideConnectedLegs && !lego.alwaysShowLegs && colorsMatch;

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
