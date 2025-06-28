import React, { memo, useRef, useEffect, useState } from "react";
import { DraggingStage, DroppedLego, LegoPiece } from "../lib/types";
import { getLegoStyle } from "../LegoStyles";
import { useCanvasStore } from "../stores/canvasStateStore";
import { useDragStateStore } from "../stores/dragState";
import { useGroupDragStateStore } from "../stores/groupDragState";

interface DragProxyProps {
  canvasRef: React.RefObject<HTMLDivElement | null>;
  buildingBlockDragState?: {
    isDragging: boolean;
    draggedLego: LegoPiece | null;
    mouseX: number;
    mouseY: number;
  };
}

// Separate handler for single lego drags
const SingleLegoDragProxy: React.FC<{
  canvasRef: React.RefObject<HTMLDivElement | null>;
  mousePos: { x: number; y: number };
}> = ({ canvasRef, mousePos }) => {
  const { droppedLegos } = useCanvasStore();
  const { dragState } = useDragStateStore();

  if (!dragState || dragState.draggingStage !== DraggingStage.DRAGGING) {
    return null;
  }

  if (dragState.draggedLegoIndex < 0) return null;

  const draggedLego = droppedLegos[dragState.draggedLegoIndex];
  if (!draggedLego || !canvasRef?.current) return null;

  // Calculate delta from drag start position
  const deltaX = mousePos.x - dragState.startX;
  const deltaY = mousePos.y - dragState.startY;

  // Calculate proxy position: original lego position + mouse delta
  const proxyX = dragState.originalX + deltaX;
  const proxyY = dragState.originalY + deltaY;

  return (
    <div
      key={`single-drag-proxy-${draggedLego.instanceId}`}
      style={{
        position: "absolute",
        left: `${proxyX - draggedLego.style.size / 2}px`,
        top: `${proxyY - draggedLego.style.size / 2}px`,
        width: `${draggedLego.style.size}px`,
        height: `${draggedLego.style.size}px`,
        opacity: 0.7,
        transform: "scale(1.1)",
        filter: "drop-shadow(2px 2px 4px rgba(0,0,0,0.3))",
        transition: "none",
        pointerEvents: "none",
        zIndex: 1000
      }}
    >
      <svg
        width={draggedLego.style.size}
        height={draggedLego.style.size}
        style={{ overflow: "visible" }}
      >
        {draggedLego.style.borderRadius === "full" ? (
          <circle
            cx={draggedLego.style.size / 2}
            cy={draggedLego.style.size / 2}
            r={draggedLego.style.size / 2}
            fill={draggedLego.style.getBackgroundColorForSvg()}
            stroke={draggedLego.style.getBorderColorForSvg()}
            strokeWidth="2"
          />
        ) : (
          <rect
            x="2"
            y="2"
            width={draggedLego.style.size - 4}
            height={draggedLego.style.size - 4}
            rx={
              typeof draggedLego.style.borderRadius === "number"
                ? draggedLego.style.borderRadius
                : 0
            }
            fill={draggedLego.style.getBackgroundColorForSvg()}
            stroke={draggedLego.style.getBorderColorForSvg()}
            strokeWidth="2"
          />
        )}
      </svg>
    </div>
  );
};

// Separate handler for group drags
const GroupDragProxy: React.FC<{
  mousePos: { x: number; y: number };
}> = ({ mousePos }) => {
  const { droppedLegos } = useCanvasStore();
  const { dragState } = useDragStateStore();
  const { groupDragState } = useGroupDragStateStore();

  if (
    !groupDragState ||
    !dragState ||
    dragState.draggingStage !== DraggingStage.DRAGGING
  ) {
    return null;
  }

  const draggedLegos = droppedLegos.filter((lego) =>
    groupDragState.legoInstanceIds.includes(lego.instanceId)
  );

  if (draggedLegos.length === 0) return null;

  // Calculate delta from drag start position
  const deltaX = mousePos.x - dragState.startX;
  const deltaY = mousePos.y - dragState.startY;

  return (
    <>
      {draggedLegos.map((lego: DroppedLego) => {
        const originalPos = groupDragState.originalPositions[lego.instanceId];
        const legoProxyX = originalPos.x + deltaX;
        const legoProxyY = originalPos.y + deltaY;

        return (
          <div
            key={`group-drag-proxy-${lego.instanceId}`}
            style={{
              position: "absolute",
              left: `${legoProxyX - lego.style.size / 2}px`,
              top: `${legoProxyY - lego.style.size / 2}px`,
              width: `${lego.style.size}px`,
              height: `${lego.style.size}px`,
              opacity: 0.7,
              transform: "scale(1.1)",
              filter: "drop-shadow(2px 2px 4px rgba(0,0,0,0.3))",
              transition: "none",
              pointerEvents: "none",
              zIndex: 1000
            }}
          >
            <svg
              width={lego.style.size}
              height={lego.style.size}
              style={{ overflow: "visible" }}
            >
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
    </>
  );
};

// Separate handler for building block drags
const BuildingBlockDragProxy: React.FC<{
  canvasRef: React.RefObject<HTMLDivElement | null>;
  buildingBlockDragState: {
    isDragging: boolean;
    draggedLego: LegoPiece | null;
    mouseX: number;
    mouseY: number;
  };
}> = ({ canvasRef, buildingBlockDragState }) => {
  if (
    !buildingBlockDragState.isDragging ||
    !buildingBlockDragState.draggedLego ||
    !canvasRef?.current
  ) {
    return null;
  }

  const canvasRect = canvasRef.current.getBoundingClientRect();
  const isMouseOverCanvas =
    buildingBlockDragState.mouseX >= canvasRect.left &&
    buildingBlockDragState.mouseX <= canvasRect.right &&
    buildingBlockDragState.mouseY >= canvasRect.top &&
    buildingBlockDragState.mouseY <= canvasRect.bottom;

  if (!isMouseOverCanvas) return null;

  const lego = buildingBlockDragState.draggedLego;
  const numLegs = lego.parity_check_matrix[0].length / 2;
  const style = getLegoStyle(lego.id, numLegs);

  // Convert global mouse coordinates to canvas-relative coordinates
  const canvasX = buildingBlockDragState.mouseX - canvasRect.left;
  const canvasY = buildingBlockDragState.mouseY - canvasRect.top;

  return (
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
        transition: "none",
        pointerEvents: "none",
        zIndex: 1000
      }}
    >
      <svg
        width={style.size}
        height={style.size}
        style={{ overflow: "visible" }}
      >
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
            rx={typeof style.borderRadius === "number" ? style.borderRadius : 0}
            fill={style.getBackgroundColorForSvg()}
            stroke={style.getBorderColorForSvg()}
            strokeWidth="2"
          />
        )}
      </svg>
    </div>
  );
};

export const DragProxy: React.FC<DragProxyProps> = memo(
  ({ canvasRef, buildingBlockDragState }) => {
    // Track mouse position internally to avoid re-rendering parent components
    const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
    const animationFrameRef = useRef<number | null>(null);
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
        {/* Building block drag proxy */}
        {buildingBlockDragState && (
          <BuildingBlockDragProxy
            canvasRef={canvasRef}
            buildingBlockDragState={buildingBlockDragState}
          />
        )}

        {/* Group drag proxy */}
        {groupDragState && <GroupDragProxy mousePos={mousePos} />}

        {/* Single lego drag proxy - only show if not group dragging */}
        {!groupDragState && (
          <SingleLegoDragProxy canvasRef={canvasRef} mousePos={mousePos} />
        )}
      </div>
    );
  }
);

DragProxy.displayName = "DragProxy";
