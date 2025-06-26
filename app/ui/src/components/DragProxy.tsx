import React, { memo } from "react";
import { DroppedLego, DragState, GroupDragState } from "../lib/types";

interface DragProxyProps {
  dragState: DragState;
  groupDragState: GroupDragState | null;
  droppedLegos: DroppedLego[];
  mouseX: number;
  mouseY: number;
}

export const DragProxy: React.FC<DragProxyProps> = memo(
  ({ dragState, groupDragState, droppedLegos, mouseX, mouseY }) => {
    if (!dragState.isDragging) return null;

    const deltaX = mouseX - dragState.startX;
    const deltaY = mouseY - dragState.startY;

    // Get the legos being dragged
    const draggedLegos = groupDragState
      ? droppedLegos.filter((lego) =>
          groupDragState.legoInstanceIds.includes(lego.instanceId)
        )
      : dragState.draggedLegoIndex >= 0
        ? [droppedLegos[dragState.draggedLegoIndex]]
        : [];

    if (draggedLegos.length === 0) return null;

    return (
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          pointerEvents: "none",
          zIndex: 1000
        }}
      >
        {draggedLegos.map((lego) => {
          const originalPos = groupDragState
            ? groupDragState.originalPositions[lego.instanceId]
            : { x: dragState.originalX, y: dragState.originalY };

          const newX = originalPos.x + deltaX;
          const newY = originalPos.y + deltaY;

          return (
            <div
              key={`drag-proxy-${lego.instanceId}`}
              style={{
                position: "absolute",
                left: `${newX - lego.style.size / 2}px`,
                top: `${newY - lego.style.size / 2}px`,
                width: `${lego.style.size}px`,
                height: `${lego.style.size}px`,
                opacity: 0.7,
                transform: "scale(1.1)",
                filter: "drop-shadow(2px 2px 4px rgba(0,0,0,0.3))",
                transition: "none"
              }}
            >
              {/* Simplified visual representation */}
              <svg
                width={lego.style.size}
                height={lego.style.size}
                style={{ overflow: "visible" }}
              >
                {/* Simple circle or rectangle based on lego type - no labels for cleaner look */}
                {lego.style.borderRadius === "full" ? (
                  <circle
                    cx={lego.style.size / 2}
                    cy={lego.style.size / 2}
                    r={lego.style.size / 2}
                    fill={lego.style.getBackgroundColorForSvg()}
                    stroke={lego.style.getBorderColorForSvg()}
                    strokeWidth="2"
                  />
                ) : (
                  <rect
                    x="2"
                    y="2"
                    width={lego.style.size - 4}
                    height={lego.style.size - 4}
                    rx={
                      typeof lego.style.borderRadius === "number"
                        ? lego.style.borderRadius
                        : 0
                    }
                    fill={lego.style.getBackgroundColorForSvg()}
                    stroke={lego.style.getBorderColorForSvg()}
                    strokeWidth="2"
                  />
                )}
              </svg>
            </div>
          );
        })}
      </div>
    );
  }
);

DragProxy.displayName = "DragProxy";
