import React from "react";
import { Box } from "@chakra-ui/react";
import { useCanvasStore } from "../../stores/canvasStateStore";

export const FocusBoundingBox: React.FC = () => {
  const { focusBoundingBox, viewport } = useCanvasStore();

  if (!focusBoundingBox.isVisible || !focusBoundingBox.boundingBox) {
    return null;
  }

  // Convert logical coordinates to canvas coordinates
  const canvasBoundingBox = viewport.fromLogicalToCanvasBB(
    focusBoundingBox.boundingBox
  );

  return (
    <Box
      position="absolute"
      left={`${canvasBoundingBox.minX}px`}
      top={`${canvasBoundingBox.minY}px`}
      width={`${canvasBoundingBox.width}px`}
      height={`${canvasBoundingBox.height}px`}
      border="3px solid"
      borderColor="red.500"
      bg="red.500"
      opacity={focusBoundingBox.opacity}
      pointerEvents="none"
      zIndex={1000}
      borderRadius="4px"
      transition="opacity 0.001s"
    />
  );
};
