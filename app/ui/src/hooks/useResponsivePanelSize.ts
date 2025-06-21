import { useState, useEffect, RefObject } from "react";

export const useResponsivePanelSize = (
  containerRef: RefObject<HTMLDivElement>,
  pixelWidths: { extended: number; icons: number }
) => {
  const [panelSizes, setPanelSizes] = useState({
    extended: 15, // Default percentage
    icons: 8 // Default percentage
  });

  useEffect(() => {
    const calculatePanelSizes = (containerWidth: number) => {
      if (containerWidth > 0) {
        const extendedSize = (pixelWidths.extended / containerWidth) * 100;
        const iconsSize = (pixelWidths.icons / containerWidth) * 100;

        setPanelSizes({
          extended: Math.min(100, Math.max(0, extendedSize)),
          icons: Math.min(100, Math.max(0, iconsSize))
        });
      }
    };

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        calculatePanelSizes(entry.contentRect.width);
      }
    });

    const currentContainerRef = containerRef.current;
    if (currentContainerRef) {
      observer.observe(currentContainerRef);
      calculatePanelSizes(currentContainerRef.offsetWidth);
    }

    return () => {
      if (currentContainerRef) {
        observer.unobserve(currentContainerRef);
      }
    };
  }, [containerRef, pixelWidths]);

  return panelSizes;
};
