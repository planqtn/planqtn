import React, { memo, useMemo } from "react";
import { Connection, DroppedLego, LegDragState } from "../lib/types";
import { calculateLegPosition } from "./DroppedLegoDisplay";

interface ConnectionsLayerProps {
  connections: Connection[];
  droppedLegos: DroppedLego[];
  hideConnectedLegs: boolean;
  legDragState: LegDragState | null;
  hoveredConnection: Connection | null;
  onConnectionDoubleClick: (
    e: React.MouseEvent,
    connection: Connection
  ) => void;
}

export const ConnectionsLayer: React.FC<ConnectionsLayerProps> = memo(
  ({
    connections,
    droppedLegos,
    hideConnectedLegs,
    legDragState,
    hoveredConnection,
    onConnectionDoubleClick
  }) => {
    // Memoize lego lookup map for performance
    const legoMap = useMemo(() => {
      const map = new Map<string, DroppedLego>();
      droppedLegos.forEach((lego) => map.set(lego.instanceId, lego));
      return map;
    }, [droppedLegos]);

    // Memoize rendered connections to avoid recalculating on every render
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
          const fromPos = calculateLegPosition(fromLego, conn.from.legIndex);
          const toPos = calculateLegPosition(toLego, conn.to.legIndex);

          // Check if legs are connected and should be hidden
          const fromLegConnected = connections.some(
            (c) =>
              (c.from.legoId === fromLego.instanceId &&
                c.from.legIndex === conn.from.legIndex) ||
              (c.to.legoId === fromLego.instanceId &&
                c.to.legIndex === conn.from.legIndex)
          );
          const toLegConnected = connections.some(
            (c) =>
              (c.from.legoId === toLego.instanceId &&
                c.from.legIndex === conn.to.legIndex) ||
              (c.to.legoId === toLego.instanceId &&
                c.to.legIndex === conn.to.legIndex)
          );

          // Check if legs are highlighted
          const fromLegStyle = fromLego.style.getLegStyle(
            conn.from.legIndex,
            fromLego
          );
          const toLegStyle = toLego.style.getLegStyle(conn.to.legIndex, toLego);
          const fromLegHighlighted = fromLegStyle.is_highlighted;
          const toLegHighlighted = toLegStyle.is_highlighted;

          // Determine if legs should be hidden
          const hideFromLeg =
            hideConnectedLegs &&
            fromLegConnected &&
            !fromLego.alwaysShowLegs &&
            (!fromLegHighlighted
              ? !toLegHighlighted
              : toLegHighlighted && fromLegStyle.color === toLegStyle.color);

          const hideToLeg =
            hideConnectedLegs &&
            toLegConnected &&
            !toLego.alwaysShowLegs &&
            (!toLegHighlighted
              ? !fromLegHighlighted
              : fromLegHighlighted && fromLegStyle.color === toLegStyle.color);

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

          // Get the colors of the connected legs
          const fromLegColor = fromLego.style.getLegColor(
            conn.from.legIndex,
            fromLego
          );
          const toLegColor = toLego.style.getLegColor(conn.to.legIndex, toLego);
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

          const strokeColor = colorsMatch
            ? fromLegColor !== "#A0AEC0"
              ? fromLegColor
              : "black"
            : "red";

          const isHovered = hoveredConnection?.equals(conn);

          return (
            <g key={connKey}>
              <path
                d={pathString}
                stroke={strokeColor}
                strokeWidth={isHovered ? 4 : 2}
                fill="none"
                style={{
                  pointerEvents: "all",
                  cursor: "pointer"
                }}
                onDoubleClick={(e) => onConnectionDoubleClick(e, conn)}
              />
            </g>
          );
        })
        .filter(Boolean);
    }, [
      connections,
      legoMap,
      hideConnectedLegs,
      hoveredConnection,
      onConnectionDoubleClick
    ]);

    // Memoize temporary drag line
    const tempDragLine = useMemo(() => {
      if (!legDragState?.isDragging) return null;

      const fromLego = legoMap.get(legDragState.legoId);
      if (!fromLego) return null;

      // Calculate position using shared function
      const fromPos = calculateLegPosition(fromLego, legDragState.legIndex);
      const fromPoint = {
        x: fromLego.x + fromPos.endX,
        y: fromLego.y + fromPos.endY
      };

      const legStyle = fromLego.style.getLegStyle(
        legDragState.legIndex,
        fromLego
      );
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
        <path
          key="temp-drag-line"
          d={pathString}
          stroke="blue"
          strokeWidth={2}
          fill="none"
          strokeDasharray="5,5"
          style={{ pointerEvents: "none" }}
        />
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
  }
);

ConnectionsLayer.displayName = "ConnectionsLayer";
