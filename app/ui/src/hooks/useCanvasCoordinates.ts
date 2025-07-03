import { useCallback } from "react";
import { useCanvasStore } from "../stores/canvasStateStore";
import { handleWheelEventWithZoomToMouse } from "../utils/coordinateTransforms";
import { useVisibleLegos } from "./useVisibleLegos";

/**
 * Custom hook that provides easy access to the new coordinate system functionality
 * Use this in components that need to work with canvas and screen coordinates
 */
export const useCanvasCoordinates = (
  canvasRef: React.RefObject<HTMLDivElement | null>
) => {
  const {
    viewport,
    setZoomToMouse,
    droppedLegoBoundingBox,
    tensorNetworkBoundingBox
  } = useCanvasStore();

  // Handle mouse wheel with zoom-to-mouse
  const handleWheelZoom = useCallback(
    (e: WheelEvent) => {
      handleWheelEventWithZoomToMouse(
        e,
        canvasRef,
        viewport.zoomLevel,
        setZoomToMouse
      );
    },
    [canvasRef, viewport.zoomLevel, setZoomToMouse]
  );

  // Check if a lego is visible (either directly in viewport or connected to visible legos)
  const isLegoVisible = useCallback(
    (instanceId: string): boolean => {
      const visibleLegos = useVisibleLegos();
      return visibleLegos.some((lego) => lego.instanceId === instanceId);
    },
    [useVisibleLegos]
  );

  return {
    // Viewport state
    viewport,
    droppedLegoBoundingBox,
    tensorNetworkBoundingBox,

    // Coordinate conversion

    // Lego screen coordinates
    isLegoVisible,

    // Zoom functionality
    setZoomToMouse,
    handleWheelZoom
  };
};
