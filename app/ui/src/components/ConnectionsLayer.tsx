import React, { useMemo, useCallback, useEffect } from "react";
import { Connection } from "../lib/types";
import { DroppedLego } from "../stores/droppedLegoStore";
import { LegStyle } from "../LegoStyles";
import { useCanvasStore } from "../stores/canvasStateStore";
import { useLegDragStateStore } from "../stores/legDragState";

interface ConnectionsLayerProps {
  hideConnectedLegs: boolean;
  hoveredConnection: Connection | null;
}

// Move this outside to avoid recreation
const fromChakraColorToHex = (color: string): string => {
  if (color.startsWith("blue")) {
    return "#0000FF";
  } else if (color.startsWith("red")) {
    return "#FF0000";
  } else if (color.startsWith("purple")) {
    return "#800080";
  } else {
    return "darkgray";
  }
};

export const ConnectionsLayer: React.FC<ConnectionsLayerProps> = ({
  hideConnectedLegs,
  hoveredConnection
}) => {
  const { connections, addOperation, removeConnections, connectedLegos } =
    useCanvasStore();

  // const { tensorNetwork } = useTensorNetworkStore();
  // const { dragState } = useDragStateStore();
  const { legDragState } = useLegDragStateStore();

  // // Determine which legos are being dragged to hide their connections
  // const draggedLegoIds = useMemo(() => {
  //   const draggedIds = new Set<string>();

  //   // Add individually dragged lego
  //   if (dragState?.draggingStage === DraggingStage.DRAGGING) {
  //     const draggedLego = droppedLegos[dragState.draggedLegoIndex];
  //     if (draggedLego) {
  //       draggedIds.add(draggedLego.instanceId);
  //     }
  //   }

  //   // Add group dragged legos (selected legos)
  //   if (
  //     dragState?.draggingStage === DraggingStage.DRAGGING &&
  //     tensorNetwork?.legos
  //   ) {
  //     tensorNetwork.legos.forEach((lego) => {
  //       draggedIds.add(lego.instanceId);
  //     });
  //   }

  //   return draggedIds;
  // }, [dragState, droppedLegos, tensorNetwork]);

  const handleConnectionDoubleClick = (
    e: React.MouseEvent,
    connection: Connection
  ) => {
    e.preventDefault();
    e.stopPropagation();

    // Add to history before removing
    addOperation({
      type: "disconnect",
      data: { connectionsToRemove: [connection] }
    });

    // Remove the connection and update URL state with the new connections
    removeConnections([connection]);
  };

  // Memoize lego lookup map for performance
  const legoMap = useMemo(() => {
    const map = new Map<string, DroppedLego>();
    connectedLegos.forEach((lego) => map.set(lego.instanceId, lego));
    return map;
  }, [connectedLegos]);

  // Pre-compute connected legs map for O(1) lookup instead of O(n) per connection
  const connectedLegsMap = useMemo(() => {
    const map = new Map<string, boolean>();
    connections.forEach((conn) => {
      map.set(`${conn.from.legoId}-${conn.from.legIndex}`, true);
      map.set(`${conn.to.legoId}-${conn.to.legIndex}`, true);
    });
    return map;
  }, [connections]);

  // Pre-compute leg styles to avoid repeated calculations
  const legStylesMap = useMemo(() => {
    const map = new Map<
      string,
      { style: LegStyle; color: string; isHighlighted: boolean }
    >();
    connectedLegos.forEach((lego) => {
      const numLegs = lego.parity_check_matrix[0].length / 2;
      for (let i = 0; i < numLegs; i++) {
        const legStyle = lego.style!.legStyles[i];
        const legColor = lego.style!.getLegColor(i);
        map.set(`${lego.instanceId}-${i}`, {
          style: legStyle,
          color: legColor,
          isHighlighted: legStyle.is_highlighted
        });
      }
    });
    return map;
  }, [connectedLegos]);

  // Memoize connection hover check
  const isConnectionHovered = useCallback(
    (conn: Connection): boolean => {
      return !!(
        hoveredConnection &&
        hoveredConnection.from.legoId === conn.from.legoId &&
        hoveredConnection.from.legIndex === conn.from.legIndex &&
        hoveredConnection.to.legoId === conn.to.legoId &&
        hoveredConnection.to.legIndex === conn.to.legIndex
      );
    },
    [hoveredConnection]
  );

  // Memoize rendered connections with optimized calculations
  const renderedConnections = useMemo(() => {
    return (
      connections
        // .filter((conn) => {
        //   // Hide connections involving dragged legos
        //   return (
        //     !draggedLegoIds.has(conn.from.legoId) &&
        //     !draggedLegoIds.has(conn.to.legoId)
        //   );
        // })
        .map((conn) => {
          const fromLego = legoMap.get(conn.from.legoId);
          const toLego = legoMap.get(conn.to.legoId);
          if (!fromLego || !toLego) return null;

          // Create a stable key based on the connection's properties
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
          const connKey = `${firstId}-${firstLeg}-${secondId}-${secondLeg}`;

          // Calculate positions using shared function
          const fromPos =
            fromLego.style!.legStyles[conn.from.legIndex].position;
          const toPos = toLego.style!.legStyles[conn.to.legIndex].position;

          // Use pre-computed maps for O(1) lookup
          const fromLegConnected = connectedLegsMap.has(
            `${fromLego.instanceId}-${conn.from.legIndex}`
          );
          const toLegConnected = connectedLegsMap.has(
            `${toLego.instanceId}-${conn.to.legIndex}`
          );

          // Get pre-computed leg styles
          const fromLegData = legStylesMap.get(
            `${fromLego.instanceId}-${conn.from.legIndex}`
          );
          const toLegData = legStylesMap.get(
            `${toLego.instanceId}-${conn.to.legIndex}`
          );

          if (!fromLegData || !toLegData) return null;

          const { color: fromLegColor, isHighlighted: fromLegHighlighted } =
            fromLegData;
          const { color: toLegColor, isHighlighted: toLegHighlighted } =
            toLegData;

          // Determine if legs should be hidden
          const hideFromLeg =
            hideConnectedLegs &&
            fromLegConnected &&
            !fromLego.alwaysShowLegs &&
            (!fromLegHighlighted
              ? !toLegHighlighted
              : toLegHighlighted && fromLegColor === toLegColor);

          const hideToLeg =
            hideConnectedLegs &&
            toLegConnected &&
            !toLego.alwaysShowLegs &&
            (!toLegHighlighted
              ? !fromLegHighlighted
              : fromLegHighlighted && fromLegColor === toLegColor);

          // Final points with lego positions
          const fromPoint = hideFromLeg
            ? { x: fromLego.x, y: fromLego.y }
            : {
                x: fromLego.x + fromPos.endX,
                y: fromLego.y + fromPos.endY
              };
          const toPoint = hideToLeg
            ? { x: toLego.x, y: toLego.y }
            : {
                x: toLego.x + toPos.endX,
                y: toLego.y + toPos.endY
              };

          const colorsMatch = fromLegColor === toLegColor;

          // Calculate control points for the curve
          const controlPointDistance = 30;
          const cp1 = {
            x: fromPoint.x + Math.cos(fromPos.angle) * controlPointDistance,
            y: fromPoint.y + Math.sin(fromPos.angle) * controlPointDistance
          };
          const cp2 = {
            x:
              toPoint.x +
              Math.cos(toPos.angle + Math.PI) * controlPointDistance,
            y:
              toPoint.y + Math.sin(toPos.angle + Math.PI) * controlPointDistance
          };

          const pathString = `M ${fromPoint.x} ${fromPoint.y} C ${cp1.x} ${cp1.y}, ${cp2.x} ${cp2.y}, ${toPoint.x} ${toPoint.y}`;

          // Calculate midpoint for warning icon
          const midPoint = {
            x: (fromPoint.x + toPoint.x) / 2,
            y: (fromPoint.y + toPoint.y) / 2
          };

          const sharedColor = colorsMatch
            ? fromChakraColorToHex(fromLegColor)
            : "yellow";
          const connectorColor = colorsMatch ? sharedColor : "yellow";

          // Check if this connection is being hovered
          const isHovered = isConnectionHovered(conn);

          return (
            <g key={connKey}>
              {/* Invisible wider path for easier clicking */}
              <path
                d={pathString}
                stroke="transparent"
                strokeWidth="10"
                fill="none"
                style={{
                  cursor: "pointer"
                }}
                onDoubleClick={(e) => handleConnectionDoubleClick(e, conn)}
                onMouseEnter={(e) => {
                  // Find and update the visible path
                  const visiblePath = e.currentTarget
                    .nextSibling as SVGPathElement;
                  if (visiblePath) {
                    visiblePath.style.stroke = connectorColor;
                    visiblePath.style.strokeWidth = "3";
                    visiblePath.style.filter =
                      "drop-shadow(0 0 2px rgba(66, 153, 225, 0.5))";
                  }
                }}
                onMouseLeave={(e) => {
                  // Reset the visible path
                  const visiblePath = e.currentTarget
                    .nextSibling as SVGPathElement;
                  if (visiblePath) {
                    visiblePath.style.stroke = connectorColor;
                    visiblePath.style.strokeWidth = "2";
                    visiblePath.style.filter = "none";
                  }
                }}
              />
              {/* Visible path */}
              <path
                d={pathString}
                stroke={connectorColor}
                strokeWidth={isHovered ? "4" : "2"}
                fill="none"
                style={{
                  pointerEvents: "none",
                  stroke: connectorColor,
                  filter: isHovered
                    ? "drop-shadow(0 0 2px rgba(66, 153, 225, 0.5))"
                    : "none"
                }}
              />
              {/* Warning sign if operators don't match */}
              {!colorsMatch && (
                <text
                  x={midPoint.x}
                  y={midPoint.y}
                  fontSize="16"
                  fill="#FF0000"
                  textAnchor="middle"
                  dominantBaseline="middle"
                  style={{ pointerEvents: "none" }}
                >
                  ⚠
                </text>
              )}
            </g>
          );
        })
        .filter(Boolean)
    );
  }, [
    connections,
    legoMap,
    connectedLegsMap,
    legStylesMap,
    hideConnectedLegs,
    isConnectionHovered
  ]);

  // Memoize temporary drag line
  const tempDragLine = useMemo(() => {
    if (!legDragState?.isDragging) return null;

    const fromLego = legoMap.get(legDragState.legoId);
    if (!fromLego) return null;

    // Calculate position using shared function
    const fromPos = fromLego.style!.legStyles[legDragState.legIndex].position;
    const fromPoint = {
      x: fromLego.x + fromPos.endX,
      y: fromLego.y + fromPos.endY
    };

    const legStyle = fromLego.style!.legStyles[legDragState.legIndex];
    const controlPointDistance = 30;
    const cp1 = {
      x: fromPoint.x + Math.cos(legStyle.angle) * controlPointDistance,
      y: fromPoint.y + Math.sin(legStyle.angle) * controlPointDistance
    };
    const cp2 = {
      x: legDragState.currentX,
      y: legDragState.currentY
    };

    const pathString = `M ${fromPoint.x} ${fromPoint.y} C ${cp1.x} ${cp1.y}, ${cp2.x} ${cp2.y}, ${legDragState.currentX} ${legDragState.currentY}`;

    return (
      <g key="temp-drag-line">
        <circle cx={fromLego.x} cy={fromLego.y} r={5} fill="red" />
        <path
          d={pathString}
          stroke="#3182CE"
          strokeWidth="2"
          strokeDasharray="4"
          fill="none"
          opacity={0.5}
          style={{ pointerEvents: "none" }}
        />
      </g>
    );
  }, [legDragState, legoMap]);

  return (
    <svg
      id="connections-svg"
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        width: "100%",
        height: "100%",
        pointerEvents: "none",
        userSelect: "none"
      }}
    >
      {/* Existing connections */}
      <g style={{ pointerEvents: "all" }}>{renderedConnections}</g>

      {/* Temporary line while dragging */}
      {tempDragLine}
    </svg>
  );
};

ConnectionsLayer.displayName = "ConnectionsLayer";
