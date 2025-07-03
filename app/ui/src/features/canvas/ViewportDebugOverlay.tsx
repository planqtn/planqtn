import React from "react";
import { Box } from "@chakra-ui/react";
import { useCanvasStore } from "../../stores/canvasStateStore";
import { CanvasPoint } from "../../types/coordinates";

interface ViewportDebugOverlayProps {
  canvasRef: React.RefObject<HTMLDivElement | null>;
}

export const ViewportDebugOverlay: React.FC<ViewportDebugOverlayProps> = ({
  canvasRef
}) => {
  const viewport = useCanvasStore((state) => state.viewport);

  const zoomLevel = viewport.zoomLevel;

  // Get canvas dimensions from the actual element
  const canvasRect = canvasRef.current?.getBoundingClientRect();

  if (!canvasRect) return null;

  const debugTopLeft = viewport.convertToCanvasPoint(viewport.logicalPanOffset);
  const debugBottomRight = viewport.convertToCanvasPoint(
    new CanvasPoint(viewport.logicalWidth, viewport.logicalHeight).plus(
      viewport.logicalPanOffset
    )
  );

  const debugBoxStyle = {
    position: "absolute" as const,
    top: debugTopLeft.y,
    left: debugTopLeft.x,
    width: `${debugBottomRight.x - debugTopLeft.x}px`,
    height: `${debugBottomRight.y - debugTopLeft.y}px`,
    border: "3px solid red",
    background: "rgba(255, 0, 0, 0.1)",
    pointerEvents: "none" as const,
    zIndex: 1000,
    borderRadius: "8px"
  };

  return (
    <>
      {/* Main viewport debug box - should always align with canvas borders */}
      <Box style={debugBoxStyle} />

      {/* Debug info overlay */}
      <Box
        position="absolute"
        top={4}
        left={4}
        bg="rgba(255, 255, 255, 0.9)"
        p={2}
        borderRadius="md"
        fontSize="xs"
        fontFamily="mono"
        zIndex={1001}
        pointerEvents="none"
        border="1px solid red"
      >
        <div>Viewport Debug Info:</div>
        <div>
          Canvas: {canvasRect.width.toFixed(0)}x{canvasRect.height.toFixed(0)}
        </div>
        <div>Zoom: {(zoomLevel * 100).toFixed(1)}%</div>
        <div>
          Pan: ({viewport.logicalPanOffset.x.toFixed(1)},{" "}
          {viewport.logicalPanOffset.y.toFixed(1)})
        </div>
        <div>
          Viewport Canvas: ({viewport.logicalPanOffset.x.toFixed(1)},{" "}
          {viewport.logicalPanOffset.y.toFixed(1)})
        </div>
        <div>
          Viewport Size: {viewport.logicalWidth.toFixed(1)}x
          {viewport.logicalHeight.toFixed(1)}
        </div>
        <div>
          Screen Size: {viewport.screenWidth}x{viewport.screenHeight}
        </div>
        <div style={{ color: "red", fontWeight: "bold", marginTop: "4px" }}>
          Red box should align with canvas borders!
        </div>
      </Box>
    </>
  );
};
