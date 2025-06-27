import React, { memo, useMemo, useEffect, useState } from "react";
import { DraggingStage, DroppedLego } from "../lib/types";
import { DroppedLegoDisplay, getLegoBoundingBox } from "./DroppedLegoDisplay";
import { useTensorNetworkStore } from "../stores/tensorNetworkStore";
import { useCanvasStore } from "../stores/canvasStateStore";
import { useDragStateStore } from "../stores/dragState";

interface LegosLayerProps {
  canvasRef: React.RefObject<HTMLDivElement | null>;
}

// Hook to get viewport bounds
const useViewportBounds = () => {
  const [viewportBounds, setViewportBounds] = useState({
    left: 0,
    top: 0,
    right: 0,
    bottom: 0
  });

  useEffect(() => {
    const updateViewportBounds = () => {
      const canvasPanel = document.querySelector("#main-panel");
      if (canvasPanel) {
        const rect = canvasPanel.getBoundingClientRect();
        // Add some padding to render legos slightly outside viewport
        const padding = 200;
        setViewportBounds({
          left: -padding,
          top: -padding,
          right: rect.width + padding,
          bottom: rect.height + padding
        });
      }
    };

    // Update on mount
    updateViewportBounds();

    // Update on window resize
    window.addEventListener("resize", updateViewportBounds);

    // Use ResizeObserver for the canvas panel specifically
    const canvasPanel = document.querySelector("#main-panel");
    let resizeObserver: ResizeObserver | null = null;

    if (canvasPanel) {
      resizeObserver = new ResizeObserver(updateViewportBounds);
      resizeObserver.observe(canvasPanel);
    }

    return () => {
      window.removeEventListener("resize", updateViewportBounds);
      if (resizeObserver && canvasPanel) {
        resizeObserver.unobserve(canvasPanel);
      }
    };
  }, []);

  return viewportBounds;
};

// Function to check if a lego is visible in the viewport
const isLegoVisible = (
  lego: DroppedLego,
  viewportBounds: { left: number; top: number; right: number; bottom: number }
) => {
  const legoBounds = getLegoBoundingBox(lego, false);

  const legoLeft = lego.x + legoBounds.left;
  const legoTop = lego.y + legoBounds.top;
  const legoRight = lego.x + legoBounds.left + legoBounds.width;
  const legoBottom = lego.y + legoBounds.top + legoBounds.height;

  // Check if lego intersects with viewport
  return !(
    legoRight < viewportBounds.left ||
    legoLeft > viewportBounds.right ||
    legoBottom < viewportBounds.top ||
    legoTop > viewportBounds.bottom
  );
};

export const LegosLayer: React.FC<LegosLayerProps> = memo(({ canvasRef }) => {
  const { tensorNetwork } = useTensorNetworkStore();
  const viewportBounds = useViewportBounds();
  const { droppedLegos } = useCanvasStore();
  const { dragState } = useDragStateStore();

  useEffect(() => {
    console.log("legoslayer tensorNetwork changed");
  }, [tensorNetwork]);
  useEffect(() => {
    console.log("legoslayer dragState changed");
  }, [dragState]);

  // Check which legos are being dragged to hide them (proxy will show instead)
  const isDraggedLego = useMemo(() => {
    const draggedIds = new Set<string>();

    // Add individually dragged lego
    if (dragState?.draggingStage === DraggingStage.DRAGGING) {
      const draggedLego = droppedLegos[dragState.draggedLegoIndex];
      if (draggedLego) {
        draggedIds.add(draggedLego.instanceId);
      }
    }

    // Add group dragged legos (selected legos)
    if (tensorNetwork?.legos) {
      tensorNetwork.legos.forEach((lego) => {
        if (dragState?.draggingStage === DraggingStage.DRAGGING) {
          draggedIds.add(lego.instanceId);
        }
      });
    }

    return (legoId: string) => draggedIds.has(legoId);
  }, [dragState, droppedLegos, tensorNetwork]);

  // Simple virtualization: only render visible legos (and hide dragged ones)
  const renderedLegos = useMemo(() => {
    return droppedLegos
      .filter((lego) => isLegoVisible(lego, viewportBounds))
      .filter((lego) => !isDraggedLego(lego.instanceId)) // Hide dragged legos
      .map((lego) => {
        const originalIndex = droppedLegos.findIndex(
          (l) => l.instanceId === lego.instanceId
        );
        return (
          <DroppedLegoDisplay
            key={lego.instanceId}
            lego={lego}
            index={originalIndex}
            demoMode={false}
            canvasRef={canvasRef}
          />
        );
      });
  }, [viewportBounds, dragState, tensorNetwork, isDraggedLego]);

  return <>{renderedLegos}</>;
});

LegosLayer.displayName = "LegosLayer";
