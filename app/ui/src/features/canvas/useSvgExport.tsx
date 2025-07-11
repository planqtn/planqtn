import { useCallback } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { useCanvasStore } from "../../stores/canvasStateStore";
import { useVisibleLegoIds } from "../../hooks/useVisibleLegos";
import { ConnectionsLayer } from "../lego/ConnectionsLayer";
import { LegosLayer } from "../lego/LegosLayer";

interface UseSvgExportOptions {
  onSuccess?: (message: string) => void;
  onError?: (message: string) => void;
}

export const useSvgExport = (options: UseSvgExportOptions = {}) => {
  const { onSuccess, onError } = options;

  // Get data from stores
  const connections = useCanvasStore((state) => state.connections);
  const calculateDroppedLegoBoundingBox = useCanvasStore(
    (state) => state.calculateDroppedLegoBoundingBox
  );
  const droppedLegoBoundingBox = calculateDroppedLegoBoundingBox();
  const droppedLegos = useCanvasStore((state) => state.droppedLegos);
  const viewport = useCanvasStore((state) => state.viewport);
  const hideConnectedLegs = useCanvasStore((state) => state.hideConnectedLegs);
  const legHideStates = useCanvasStore((state) => state.legHideStates);
  const visibleLegoIds = useVisibleLegoIds();

  const exportSvg = useCallback(async () => {
    try {
      // Create complete SVG with React elements
      const svgElement = (
        <svg
          width={droppedLegoBoundingBox?.width}
          height={droppedLegoBoundingBox?.height}
          viewBox={`${droppedLegoBoundingBox?.minX} ${droppedLegoBoundingBox?.minY} ${droppedLegoBoundingBox?.maxX} ${droppedLegoBoundingBox?.maxY}`}
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* <ConnectionsLayer /> */}

          <LegosLayer svgOnly={true} />
        </svg>
      );

      // Convert React element to SVG string using renderToStaticMarkup
      const svgString = renderToStaticMarkup(svgElement);
      console.log(svgString);

      // // Create blob and download
      // const blob = new Blob([svgString], { type: "image/svg+xml" });
      // const url = URL.createObjectURL(blob);
      // const a = document.createElement("a");
      // a.href = url;
      // a.download = "quantum_lego_network.svg";
      // document.body.appendChild(a);
      // a.click();
      // document.body.removeChild(a);
      // URL.revokeObjectURL(url);

      // onSuccess?.("SVG file has been downloaded");
    } catch (error) {
      console.error("SVG export error:", error);
      onError?.("Failed to generate SVG");
    }
  }, [
    connections,
    droppedLegos,
    viewport,
    visibleLegoIds,
    hideConnectedLegs,
    legHideStates,
    onSuccess,
    onError
  ]);

  return { exportSvg };
};
