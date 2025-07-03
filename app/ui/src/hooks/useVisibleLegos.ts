import { useCanvasStore } from "../stores/canvasStateStore";
import { LogicalPoint } from "../types/coordinates";
import { useMemo } from "react";
import { useShallow } from "zustand/react/shallow";

export const useVisibleLegoIds = () => {
  const { droppedLegos, connections, viewport } = useCanvasStore(
    useShallow((state) => ({
      droppedLegos: state.droppedLegos,
      connections: state.connections,
      viewport: state.viewport
    }))
  );

  return useMemo(() => {
    // Safety checks for viewport validity
    if (
      !isFinite(viewport.logicalPanOffset.x) ||
      !isFinite(viewport.logicalPanOffset.y) ||
      !isFinite(viewport.logicalWidth) ||
      !isFinite(viewport.logicalHeight)
    ) {
      console.warn("Invalid viewport in calculateVisibleLegos:", viewport);

      return droppedLegos.map((lego) => lego.instanceId);
    }

    // Calculate viewport bounds with some padding for connections
    const padding = 100; // Padding for connected legos outside viewport

    // At extreme zoom levels (very large viewport), just show all legos for performance
    const maxReasonableViewportSize = 50000; // Reasonable limit to prevent performance issues
    if (
      viewport.logicalWidth > maxReasonableViewportSize ||
      viewport.logicalHeight > maxReasonableViewportSize
    ) {
      console.warn("Invalid viewport in calculateVisibleLegos:", viewport);

      return droppedLegos.map((lego) => {
        return lego.instanceId;
      });
    }

    // Get visible legos (within viewport bounds)
    const directlyVisible = droppedLegos.filter((lego) => {
      return (
        isFinite(lego.logicalPosition.x) &&
        isFinite(lego.logicalPosition.y) &&
        viewport.isPointInViewport(
          new LogicalPoint(lego.logicalPosition.x, lego.logicalPosition.y),
          padding
        )
      );
    });

    // Get connected legos (connected to visible ones, even if outside viewport)
    const visibleIds = new Set(directlyVisible.map((l) => l.instanceId));
    const connectedIds = new Set<string>();

    connections.forEach((conn) => {
      if (visibleIds.has(conn.from.legoId)) {
        connectedIds.add(conn.to.legoId);
      }
      if (visibleIds.has(conn.to.legoId)) {
        connectedIds.add(conn.from.legoId);
      }
    });

    // Combine visible and connected legos
    const connectedLegos = droppedLegos.filter(
      (lego) =>
        connectedIds.has(lego.instanceId) && !visibleIds.has(lego.instanceId)
    );

    const visibleLegoIds = [...directlyVisible, ...connectedLegos].map(
      (lego) => lego.instanceId
    );

    return visibleLegoIds;
  }, [droppedLegos, connections, viewport]);
};
