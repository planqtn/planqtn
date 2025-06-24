import { Box } from "@chakra-ui/react";
import { DroppedLego, LegDragState, DragState, Connection } from "../lib/types";
import { TensorNetwork } from "../lib/TensorNetwork";
import { LegStyle } from "../LegoStyles";

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

export const DroppedLegoDisplay: React.FC<DroppedLegoDisplayProps> = ({
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
  const numAllLegs = lego.parity_check_matrix[0].length / 2; // Total number of legs (symplectic matrix, each column is X and Z)
  const isScalar =
    lego.parity_check_matrix.length === 1 &&
    lego.parity_check_matrix[0].length === 1;
  const numLogicalLegs = lego.logical_legs.length; // Number of logical legs
  const numGaugeLegs = lego.gauge_legs.length; // Number of gauge legs
  const numRegularLegs = numAllLegs - numLogicalLegs - numGaugeLegs; // Regular legs are the remaining legs

  // Initialize selectedMatrixRows if not present
  if (!lego.selectedMatrixRows) {
    lego.selectedMatrixRows = [];
  }

  // Calculate polygon vertices - only for regular legs
  const vertices = Array.from({ length: numRegularLegs }, (_, i) => {
    // Start from the top (- Math.PI / 2) and go clockwise
    const angle = -Math.PI / 2 + (2 * Math.PI * i) / numRegularLegs;
    return {
      x: (size / 2) * Math.cos(angle),
      y: (size / 2) * Math.sin(angle)
    };
  });

  const isSelected =
    tensorNetwork &&
    tensorNetwork.legos.some((l) => l.instanceId === lego.instanceId);

  // Calculate leg positions once for both rendering and labels
  const legPositions = isScalar
    ? []
    : Array(numAllLegs)
        .fill(0)
        .map((_, legIndex) =>
          calculateLegPosition(lego, legIndex, LEG_LABEL_DISTANCE, true)
        );

  // Function to check if a leg is connected
  const isLegConnected = (legIndex: number) => {
    return connections.some(
      (conn) =>
        (conn.from.legoId === lego.instanceId &&
          conn.from.legIndex === legIndex) ||
        (conn.to.legoId === lego.instanceId && conn.to.legIndex === legIndex)
    );
  };

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
            connectedLego?.style.getLegStyle(conn.from.legIndex, connectedLego)
              ?.is_highlighted || false
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
      if (conn.to.legoId === lego.instanceId && conn.to.legIndex === legIndex) {
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
      return { visibility: "hidden" as const, pointerEvents: "none" as const };
    }
    return { visibility: "visible" as const, pointerEvents: "all" as const };
  };

  const isScalarLego = (lego: DroppedLego) => {
    return (
      lego.parity_check_matrix.length === 1 &&
      lego.parity_check_matrix[0].length === 1
    );
  };

  // const maxExtent = Math.max(
  //   maxLegLength,
  //   maxEndpointX - minEndpointX,
  //   maxEndpointY - minEndpointY
  // );

  // for debugging
  // const centerX = (maxEndpointX + minEndpointX) / 2;
  // numAllLegs > 2
  //   ?
  //   : numAllLegs == 2 || numAllLegs == 0
  //     ? 0
  //     : endpointFn(legPositions[0]).x / 2;
  // const centerY = (maxEndpointY + minEndpointY) / 2;
  // numAllLegs > 2
  //   ?
  //   : numAllLegs == 2 || numAllLegs == 0
  //     ? 0
  //     : endpointFn(legPositions[0]).y / 2;

  // const svgSize = maxExtent + svgPadding * 2;

  // const boundingBox = getLegoBoundingBox(lego, demoMode);

  return (
    <Box
      position={"absolute"}
      left={`${demoMode ? lego.x : lego.x}px`}
      top={`${demoMode ? lego.y : lego.y}px`}
      width={`${size}px`}
      height={`${size}px`}
      // for debugging
      // width={`${svgSize}px`}
      // height={`${svgSize}px`}
      pointerEvents="all"
      cursor={dragState?.isDragging ? "grabbing" : "grab"}
      onMouseDown={(e) => handleLegoMouseDown(e, index)}
      onClick={(e) => handleLegoClick(e, lego)}
      style={{
        // for debugging
        // border: "1px solid orange",
        userSelect: "none",
        zIndex: 0,
        opacity: dragState?.isDragging ? 0.5 : 1,
        filter: isSelected
          ? "drop-shadow(0 0 4px rgba(66, 153, 225, 0.5))"
          : "none",
        transform: demoMode
          ? "scale(0.5) translate(-50%, -50%)"
          : "translate(-50%, -50%)"
      }}
    >
      <svg
        width={size}
        height={size}
        style={{
          pointerEvents: "all",
          position: "absolute",
          left: `${0}px`,
          top: `${0}px`,
          // for debugging
          // left: `${-centerX + svgSize / 2 - size / 2 }px`,
          // top: `${-centerY + svgSize / 2 - size / 2 }px`,
          overflow: "visible"
          // for debugging
          // border: "1px solid red"
        }}
        className="lego-svg"
        transform={demoMode ? "" : `translate(${size / 2}, ${size / 2})`}
      >
        {/* for debugging */}
        {/* <circle
          cx={centerX  }
          cy={centerY  }
          r={5}
          fill="red"
        /> */}

        {/* <rect
          x={boundingBox.left}
          y={boundingBox.top}
          width={boundingBox.width}
          height={boundingBox.height}
          fill="transparent"
          stroke="red"
          strokeWidth="1"
        /> */}
        {/* Regular Legs (rendered first with lower z-index) */}
        {legPositions.map((pos, legIndex) => {
          const isLogical = lego.logical_legs.includes(legIndex);
          if (isLogical) return null; // Skip logical legs in this pass

          const legColor = pos.style.color;
          const isBeingDragged =
            legDragState?.isDragging &&
            legDragState.legoId === lego.instanceId &&
            legDragState.legIndex === legIndex;

          const legVisibility = getLegVisibility(legIndex);

          return (
            <g key={`leg-${legIndex}`} style={legVisibility}>
              {/* Line */}
              <line
                x1={pos.startX}
                y1={pos.startY}
                x2={pos.endX}
                y2={pos.endY}
                stroke={legColor}
                strokeWidth={
                  legColor !== "#A0AEC0" ? 4 : parseInt(pos.style.width)
                }
                strokeDasharray={
                  pos.style.style === "dashed" ? "5,5" : undefined
                }
                style={{ pointerEvents: "none" }}
              />
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
                  transition: "stroke 0.2s, fill 0.2s",
                  stroke: isBeingDragged ? "rgb(66, 153, 225)" : legColor,
                  fill: isBeingDragged ? "rgb(235, 248, 255)" : "white"
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
                  : typeof lego.style.borderRadius === "string" &&
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
                  : typeof lego.style.borderRadius === "string" &&
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
            {!demoMode && lego.style.displayShortName && (
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
            )}
            {!demoMode && !lego.style.displayShortName && (
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
                      Math.cos(
                        -Math.PI / 2 + (2 * Math.PI * i) / numRegularLegs
                      );
                    const y =
                      (size / 2) *
                      Math.sin(
                        -Math.PI / 2 + (2 * Math.PI * i) / numRegularLegs
                      );
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
            {!demoMode && (
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
                {lego.style.displayShortName && (
                  <>
                    {lego.shortName}
                    <tspan x="0" dy="12">
                      {lego.instanceId}
                    </tspan>
                  </>
                )}
                {!lego.style.displayShortName && lego.instanceId}
              </text>
            )}
          </g>
        )}

        {/* Logical Legs (rendered last with higher z-index) */}
        {legPositions.map((pos, legIndex) => {
          const isLogical = lego.logical_legs.includes(legIndex);
          if (!isLogical) return null; // Skip regular legs in this pass

          const legColor = pos.style.color;
          const isBeingDragged =
            legDragState?.isDragging &&
            legDragState.legoId === lego.instanceId &&
            legDragState.legIndex === legIndex;

          const legVisibility = getLegVisibility(legIndex);

          return (
            <g key={`logical-leg-${legIndex}`} style={legVisibility}>
              {/* Line */}
              <line
                x1={pos.startX}
                y1={pos.startY}
                x2={pos.endX}
                y2={pos.endY}
                stroke={legColor}
                strokeWidth={
                  legColor !== "#A0AEC0" ? 4 : parseInt(pos.style.width)
                }
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
              {/* Draggable Endpoint */}
              <circle
                cx={pos.endX}
                cy={pos.endY}
                r="5"
                fill={isBeingDragged ? "rgb(235, 248, 255)" : "white"}
                stroke={isBeingDragged ? "rgb(66, 153, 225)" : legColor}
                strokeWidth="2"
                style={{
                  cursor: "pointer",
                  pointerEvents: "all",
                  transition: "stroke 0.2s, fill 0.2s",
                  stroke: isBeingDragged ? "rgb(66, 153, 225)" : legColor,
                  fill: isBeingDragged ? "rgb(235, 248, 255)" : "white"
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

        {/* Leg Labels */}
        {!isScalarLego(lego) &&
          !demoMode &&
          legPositions.map((pos, legIndex) => {
            // Check if leg is connected
            const isLegConnected = connections.some(
              (c) =>
                (c.from.legoId === lego.instanceId &&
                  c.from.legIndex === legIndex) ||
                (c.to.legoId === lego.instanceId && c.to.legIndex === legIndex)
            );

            // If leg is not connected, always show the label
            if (!isLegConnected) {
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
                (c.to.legoId === lego.instanceId && c.to.legIndex === legIndex)
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

            // Hide label if:
            // 1. hideConnectedLegs is true AND
            // 2. lego doesn't have alwaysShowLegs AND
            // 3. Either:
            //    - This leg is not highlighted and connected leg is not highlighted
            //    - Both legs are highlighted with the same color
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
    </Box>
  );
};
