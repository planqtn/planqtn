import React from "react";
import { SvgLegoStyle } from "./SvgLegoStyle";
import { useCanvasStore } from "../../stores/canvasStateStore";
import { DraggingStage } from "../../stores/legoDragState";
import { useShallow } from "zustand/react/shallow";
import {
  getSmartLegoSize,
  getLevelOfDetail
} from "../../utils/coordinateTransforms";
import { Connection } from "../../stores/connectionStore";

interface SvgLegoDisplayProps {
  legoInstanceId: string;
  demoMode: boolean;
}

export const SvgLegoDisplay: React.FC<SvgLegoDisplayProps> = React.memo(
  ({ legoInstanceId, demoMode = false }) => {
    const lego = useCanvasStore(
      (state) =>
        state.droppedLegos.find((l) => l.instance_id === legoInstanceId)!
    );

    const svgStyle: SvgLegoStyle = lego.style as SvgLegoStyle;
    const svgBodyElement = svgStyle.getSvgBodyElement();

    const viewport = useCanvasStore((state) => state.viewport);
    const zoomLevel = viewport.zoomLevel;

    const canvasPosition = viewport.fromLogicalToCanvas(lego.logicalPosition);

    const basePosition = React.useMemo(() => {
      if (demoMode) {
        return { x: lego.logicalPosition.x, y: lego.logicalPosition.y };
      }
      return canvasPosition;
    }, [lego.logicalPosition, demoMode, canvasPosition]);

    const legConnectionStates = useCanvasStore(
      useShallow((state) =>
        lego ? state.legConnectionStates[lego.instance_id] || [] : []
      )
    );

    const legoConnections = useCanvasStore(
      useShallow((state) =>
        lego ? state.legoConnectionMap[lego.instance_id] || [] : []
      )
    );

    const hideConnectedLegs = useCanvasStore(
      (state) => state.hideConnectedLegs
    );

    const isThisLegoBeingDragged = useCanvasStore((state) => {
      if (state.legoDragState.draggedLegoInstanceId === "") return false;
      const draggedLego = state.droppedLegos.find(
        (l) => l.instance_id === state.legoDragState.draggedLegoInstanceId
      );
      return (
        draggedLego?.instance_id === lego.instance_id &&
        state.legoDragState.draggingStage === DraggingStage.DRAGGING
      );
    });

    const isSelected = useCanvasStore((state) => {
      return (
        (lego &&
          state.tensorNetwork?.legos.some(
            (l) => l.instance_id === lego.instance_id
          )) ||
        false
      );
    });

    const legHiddenStates = useCanvasStore(
      useShallow((state) =>
        lego ? state.legHideStates[lego.instance_id] || [] : []
      )
    );

    const storeHandleLegoClick = useCanvasStore(
      (state) => state.handleLegoClick
    );
    const storeHandleLegoMouseDown = useCanvasStore(
      (state) => state.handleLegoMouseDown
    );

    const hideIds = useCanvasStore((state) => state.hideIds);
    const hideTypeIds = useCanvasStore((state) => state.hideTypeIds);
    const hideDanglingLegs = useCanvasStore((state) => state.hideDanglingLegs);
    const hideLegLabels = useCanvasStore((state) => state.hideLegLabels);

    if (!lego || !svgStyle) return null;

    const originalSize = svgStyle.size;
    const smartSize = demoMode
      ? originalSize
      : getSmartLegoSize(originalSize, zoomLevel);
    const size = smartSize;

    const lod = getLevelOfDetail(smartSize, zoomLevel);

    const isThisLegoDragged = isThisLegoBeingDragged;

    const getConnectionKey = (conn: Connection) => {
      const [firstId, firstLeg, secondId, secondLeg] =
        conn.from.legoId < conn.to.legoId
          ? [
              conn.from.legoId,
              conn.from.leg_index,
              conn.to.legoId,
              conn.to.leg_index
            ]
          : [
              conn.to.legoId,
              conn.to.leg_index,
              conn.from.legoId,
              conn.from.leg_index
            ];
      return `${firstId}-${firstLeg}-${secondId}-${secondLeg}`;
    };

    const handleLegoClick = (e: React.MouseEvent<SVGSVGElement>) => {
      storeHandleLegoClick(lego, e.ctrlKey, e.metaKey);
    };

    const handleLegoMouseDown = (e: React.MouseEvent<SVGSVGElement>) => {
      e.preventDefault();
      e.stopPropagation();
      storeHandleLegoMouseDown(
        lego.instance_id,
        e.clientX,
        e.clientY,
        e.shiftKey
      );
    };

    const textData = svgStyle.getTextData();

    return (
      <>
        <g
          width={size}
          height={size}
          id={`lego-${lego.instance_id}`}
          style={{
            overflow: "visible",
            pointerEvents: "all",
            width: `${size}px`,
            height: `${size}px`,
            cursor: isThisLegoDragged ? "grabbing" : "grab",
            userSelect: "none",
            zIndex: 0,
            opacity: isThisLegoDragged ? 0.5 : 1,
            filter: isSelected
              ? "drop-shadow(0px 0px 10px rgba(37, 0, 245, 0.5))"
              : "none"
          }}
          className="lego-svg"
          transform={
            demoMode ? "" : `translate(${basePosition.x}, ${basePosition.y})`
          }
          onClick={handleLegoClick}
          onMouseDown={handleLegoMouseDown}
        >
          {/* Layer 4: Custom SVG body */}
          <g
            transform={`scale(${size / originalSize})`}
            dangerouslySetInnerHTML={{ __html: svgBodyElement }}
          />

          {/* Layer 5: Text content */}
          {!demoMode && lod.showText && (
            <g>
              {textData.shortName && !hideTypeIds && (
                <text
                  x={textData.shortName.x}
                  y={textData.shortName.y}
                  fontSize="12"
                  fontWeight="bold"
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fill={isSelected ? "white" : "#000000"}
                >
                  {textData.shortName.content}
                </text>
              )}
              {textData.instanceId && !hideIds && (
                <text
                  x={textData.instanceId.x}
                  y={textData.instanceId.y}
                  fontSize="12"
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fill={isSelected ? "white" : "#000000"}
                >
                  {textData.instanceId.content}
                </text>
              )}
              {textData.combined && !hideTypeIds && (
                <text
                  x={textData.combined.x}
                  y={textData.combined.y}
                  fontSize="10"
                  fontWeight="bold"
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fill={isSelected ? "white" : "#000000"}
                  style={{ pointerEvents: "none" }}
                >
                  {textData.combined.content}
                </text>
              )}
            </g>
          )}

          {/* Layer 6: Leg Labels */}
          {!demoMode &&
            lod.showLegLabels &&
            svgStyle.legStyles.map((legStyle, leg_index) => {
              if (legHiddenStates[leg_index]) return null;

              const isLegConnectedToSomething =
                legConnectionStates[leg_index] || false;

              if (
                (hideDanglingLegs && !isLegConnectedToSomething) ||
                hideLegLabels
              )
                return null;

              if (!isLegConnectedToSomething) {
                return (
                  <text
                    key={`${lego.instance_id}-label-${leg_index}`}
                    x={legStyle.position.labelX}
                    y={legStyle.position.labelY}
                    fontSize="12"
                    fill="#666666"
                    textAnchor="middle"
                    dominantBaseline="middle"
                    style={{ pointerEvents: "none" }}
                  >
                    {leg_index}
                  </text>
                );
              }

              const connection = legoConnections.find(
                (c) =>
                  (c.from.legoId === lego.instance_id &&
                    c.from.leg_index === leg_index) ||
                  (c.to.legoId === lego.instance_id &&
                    c.to.leg_index === leg_index)
              );

              if (!connection) return null;

              const connectionKey = getConnectionKey(connection);
              const colorsMatch = useCanvasStore
                .getState()
                .getConnectionHighlightState(connectionKey);

              const shouldHideLabel =
                hideConnectedLegs && !lego.alwaysShowLegs && colorsMatch;

              if (shouldHideLabel) return null;

              return (
                <text
                  key={`${lego.instance_id}-label-${leg_index}`}
                  x={legStyle.position.labelX}
                  y={legStyle.position.labelY}
                  fontSize="12"
                  fill="#666666"
                  textAnchor="middle"
                  dominantBaseline="middle"
                  style={{ pointerEvents: "none" }}
                >
                  {leg_index}
                </text>
              );
            })}
        </g>
      </>
    );
  }
);

SvgLegoDisplay.displayName = "SvgLegoDisplay";
