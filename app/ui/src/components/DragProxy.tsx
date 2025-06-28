import React, { memo, useRef, useEffect, useState } from "react";
import { DraggingStage, DroppedLego, LegoPiece } from "../lib/types";
import { getLegoStyle } from "../LegoStyles";
import { useCanvasStore } from "../stores/canvasStateStore";
import { useDragStateStore } from "../stores/dragState";
import { useGroupDragStateStore } from "../stores/groupDragState";

interface DragProxyProps {
  canvasRef?: React.RefObject<HTMLDivElement | null>;
  buildingBlockDragState?: {
    isDragging: boolean;
    draggedLego: LegoPiece | null;
    mouseX: number;
    mouseY: number;
  };
}

export const DragProxy: React.FC<DragProxyProps> = memo(
  ({ canvasRef, buildingBlockDragState }) => {
    // Track mouse position internally to avoid re-rendering parent components
    // This is only used for canvas lego dragging, not building block dragging
    const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
    const animationFrameRef = useRef<number | null>(null);
    const { droppedLegos } = useCanvasStore();
    const { dragState } = useDragStateStore();
    const { groupDragState } = useGroupDragStateStore();

    // Update mouse position on mouse move - only for canvas lego dragging
    useEffect(() => {
      const handleMouseMove = (e: MouseEvent) => {
        // Only update state when dragging canvas legos to avoid unnecessary re-renders
        if (dragState?.draggingStage === DraggingStage.DRAGGING) {
          if (animationFrameRef.current) {
            cancelAnimationFrame(animationFrameRef.current);
          }
          animationFrameRef.current = requestAnimationFrame(() => {
            setMousePos({ x: e.clientX, y: e.clientY });
          });
        }
      };

      window.addEventListener("mousemove", handleMouseMove);

      return () => {
        window.removeEventListener("mousemove", handleMouseMove);
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
        }
      };
    }, [dragState]);

    // Use buildingBlockDragState coordinates for building block drags, mousePos for canvas drags
    const mouseX = buildingBlockDragState?.isDragging
      ? buildingBlockDragState.mouseX
      : mousePos.x;
    const mouseY = buildingBlockDragState?.isDragging
      ? buildingBlockDragState.mouseY
      : mousePos.y;

    // Handle building blocks drag - only show when mouse is over canvas
    if (
      buildingBlockDragState?.isDragging &&
      buildingBlockDragState.draggedLego &&
      canvasRef?.current
    ) {
      const canvasRect = canvasRef.current.getBoundingClientRect();
      const isMouseOverCanvas =
        mouseX >= canvasRect.left &&
        mouseX <= canvasRect.right &&
        mouseY >= canvasRect.top &&
        mouseY <= canvasRect.bottom;

      if (!isMouseOverCanvas) return null;

      const lego = buildingBlockDragState.draggedLego;
      const numLegs = lego.parity_check_matrix[0].length / 2;
      const style = getLegoStyle(lego.id, numLegs);

      // Convert global mouse coordinates to canvas-relative coordinates
      const canvasX = mouseX - canvasRect.left;
      const canvasY = mouseY - canvasRect.top;

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
          <div
            style={{
              position: "absolute",
              left: `${canvasX - style.size / 2}px`,
              top: `${canvasY - style.size / 2}px`,
              width: `${style.size}px`,
              height: `${style.size}px`,
              opacity: 0.7,
              transform: "scale(1.1)",
              filter: "drop-shadow(2px 2px 4px rgba(0,0,0,0.3))",
              transition: "none"
            }}
          >
            {/* Simplified visual representation */}
            <svg
              width={style.size}
              height={style.size}
              style={{ overflow: "visible" }}
            >
              {/* Simple circle or rectangle based on lego type - no labels for cleaner look */}
              {style.borderRadius === "full" ? (
                <circle
                  cx={style.size / 2}
                  cy={style.size / 2}
                  r={style.size / 2}
                  fill={style.getBackgroundColorForSvg()}
                  stroke={style.getBorderColorForSvg()}
                  strokeWidth="2"
                />
              ) : (
                <rect
                  x="2"
                  y="2"
                  width={style.size - 4}
                  height={style.size - 4}
                  rx={
                    typeof style.borderRadius === "number"
                      ? style.borderRadius
                      : 0
                  }
                  fill={style.getBackgroundColorForSvg()}
                  stroke={style.getBorderColorForSvg()}
                  strokeWidth="2"
                />
              )}
            </svg>
          </div>
        </div>
      );
    }
    if (!dragState) return null;

    if (dragState.draggingStage !== DraggingStage.DRAGGING) return null;

    const deltaX = mouseX - dragState.startX;
    const deltaY = mouseY - dragState?.startY;

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
        {draggedLegos.map((lego: DroppedLego) => {
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
