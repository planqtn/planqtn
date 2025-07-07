import React, { useMemo, useCallback } from "react";
import { Connection } from "../../stores/connectionStore";
import { DroppedLego } from "../../stores/droppedLegoStore";
import { LegStyle } from "./LegoStyles";
import { useCanvasStore } from "../../stores/canvasStateStore";
import {
  getZoomAwareStrokeWidth,
  getSmartLegoSize,
  getLevelOfDetail
} from "../../utils/coordinateTransforms";
import { CanvasPoint, LogicalPoint } from "../../types/coordinates";

export const ConnectionsLayer: React.FC = () => {
  const connections = useCanvasStore((state) => state.connections);
  const hideConnectedLegs = useCanvasStore((state) => state.hideConnectedLegs);
  const addOperation = useCanvasStore((state) => state.addOperation);
  const removeConnections = useCanvasStore((state) => state.removeConnections);
  const connectedLegos = useCanvasStore((state) => state.connectedLegos);
  const legDragState = useCanvasStore((state) => state.legDragState);
  const hoveredConnection = useCanvasStore((state) => state.hoveredConnection);

  // Get zoom level for smart scaling
  const viewport = useCanvasStore((state) => state.viewport);
  const zoomLevel = viewport.zoomLevel;

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
      const numLegs = lego.numberOfLegs;
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
    return connections

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
        const fromPos = fromLego.style!.legStyles[conn.from.legIndex].position;
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
        const { isHighlighted: toLegHighlighted } = toLegData;

        const fromOriginalSize = fromLego.style!.size;
        const fromSmartSize = getSmartLegoSize(fromOriginalSize, zoomLevel);
        const fromLod = getLevelOfDetail(fromSmartSize, zoomLevel);
        const toOriginalSize = toLego.style!.size;
        const toSmartSize = getSmartLegoSize(toOriginalSize, zoomLevel);
        const toLod = getLevelOfDetail(toSmartSize, zoomLevel);

        const fromShowLegs = fromLod.showLegs;
        const toShowLegs = toLod.showLegs;

        // Use the new connection highlight states from the store
        const colorsMatch = useCanvasStore
          .getState()
          .getConnectionHighlightState(connKey);

        // Determine if legs should be hidden
        const hideFromLeg =
          !fromShowLegs ||
          (hideConnectedLegs &&
            fromLegConnected &&
            !fromLego.alwaysShowLegs &&
            (!fromLegHighlighted ? !toLegHighlighted : colorsMatch));

        const hideToLeg =
          !toShowLegs ||
          (hideConnectedLegs &&
            toLegConnected &&
            !toLego.alwaysShowLegs &&
            (!toLegHighlighted ? !fromLegHighlighted : colorsMatch));

        // Apply zoom transformations to connection points using new coordinate system
        const fromPoint = viewport
          .fromLogicalToCanvas(
            new LogicalPoint(
              fromLego.logicalPosition.x,
              fromLego.logicalPosition.y
            )
          )
          .plus(
            new CanvasPoint(fromPos.endX, fromPos.endY).factor(
              hideFromLeg ? 0 : 1
            )
          );
        const toPoint = viewport
          .fromLogicalToCanvas(
            new LogicalPoint(toLego.logicalPosition.x, toLego.logicalPosition.y)
          )
          .plus(
            new CanvasPoint(toPos.endX, toPos.endY).factor(hideToLeg ? 0 : 1)
          );

        // Calculate control points for the curve - scale with zoom for better topology
        const baseControlPointDistance = 30;
        const controlPointDistance =
          baseControlPointDistance * Math.min(1, zoomLevel * 0.8 + 0.2); // Scale control points
        const cp1 = {
          x: fromPoint.x + Math.cos(fromPos.angle) * controlPointDistance,
          y: fromPoint.y + Math.sin(fromPos.angle) * controlPointDistance
        };
        const cp2 = {
          x: toPoint.x + Math.cos(toPos.angle + Math.PI) * controlPointDistance,
          y: toPoint.y + Math.sin(toPos.angle + Math.PI) * controlPointDistance
        };

        const pathString = `M ${fromPoint.x} ${fromPoint.y} C ${cp1.x} ${cp1.y}, ${cp2.x} ${cp2.y}, ${toPoint.x} ${toPoint.y}`;

        // Calculate midpoint for warning icon
        const midPoint = {
          x: (fromPoint.x + toPoint.x) / 2,
          y: (fromPoint.y + toPoint.y) / 2
        };

        const sharedColor = colorsMatch ? fromLegColor : "yellow";
        const connectorColor = colorsMatch ? sharedColor : "yellow";

        // Check if this connection is being hovered
        const isHovered = isConnectionHovered(conn);

        // Scale stroke width slightly with zoom for better visibility using central system
        const strokeWidth = getZoomAwareStrokeWidth(2, zoomLevel);

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
              strokeWidth={isHovered ? strokeWidth * 1.5 : strokeWidth}
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
            {!colorsMatch && fromLod.showText && toLod.showText && (
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
      .filter(Boolean);
  }, [
    connections,
    legoMap,
    connectedLegsMap,
    legStylesMap,
    hideConnectedLegs,
    isConnectionHovered,
    zoomLevel,
    viewport
  ]);

  // Memoize temporary drag line
  const tempDragLine = useMemo(() => {
    if (!legDragState?.isDragging) return null;

    const fromLego = legoMap.get(legDragState.legoId);
    if (!fromLego) return null;

    // Calculate position using shared function with smart scaling
    const fromPos = fromLego.style!.legStyles[legDragState.legIndex].position;
    // Calculate scale factor for smart sizing
    const fromBasePoint = new LogicalPoint(
      fromLego.logicalPosition.x,
      fromLego.logicalPosition.y
    );

    // Apply zoom transformations to drag line using new coordinate system
    const fromPoint = viewport
      .fromLogicalToCanvas(fromBasePoint)
      .plus(new CanvasPoint(fromPos.endX, fromPos.endY));
    const legoCenter = viewport.fromLogicalToCanvas(fromBasePoint);

    const dragEndPoint = viewport.fromWindowToCanvas(
      legDragState.currentMouseWindowPoint
    );

    const legStyle = fromLego.style!.legStyles[legDragState.legIndex];
    const baseControlPointDistance = 30;
    const controlPointDistance =
      baseControlPointDistance * Math.min(1, zoomLevel * 0.8 + 0.2);
    const cp1 = {
      x: fromPoint.x + Math.cos(legStyle.angle) * controlPointDistance,
      y: fromPoint.y + Math.sin(legStyle.angle) * controlPointDistance
    };
    const cp2 = {
      x: dragEndPoint.x,
      y: dragEndPoint.y
    };

    const pathString = `M ${fromPoint.x} ${fromPoint.y} C ${cp1.x} ${cp1.y}, ${cp2.x} ${cp2.y}, ${dragEndPoint.x} ${dragEndPoint.y}`;

    // Scale stroke width for drag line too using central system
    const dragStrokeWidth = getZoomAwareStrokeWidth(2, zoomLevel);

    return (
      <g key="temp-drag-line">
        <circle
          cx={legoCenter.x}
          cy={legoCenter.y}
          r={5 * Math.min(1.2, Math.max(0.8, zoomLevel))}
          fill="red"
        />
        <path
          d={pathString}
          stroke="#3182CE"
          strokeWidth={dragStrokeWidth}
          strokeDasharray="4"
          fill="none"
          opacity={0.5}
          style={{ pointerEvents: "none" }}
        />
      </g>
    );
  }, [legDragState, legoMap, zoomLevel, viewport]);

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
