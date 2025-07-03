// Central coordinate transformation system for smart zoom
// All components should use these utilities for consistent behavior

import { Viewport } from "../stores/canvasUISlice";
import { LogicalPoint } from "../types/coordinates";

/**
 * Calculate smart lego size based on zoom level
 */
export const getSmartLegoSize = (
  originalSize: number,
  zoomLevel: number
): number => {
  // Apply zoom but clamp to reasonable limits
  const scaledSize = originalSize * Math.min(1, zoomLevel);
  return Math.max(15, Math.min(200, scaledSize));
};

/**
 * Determine level of detail based on effective size
 */
export const getLevelOfDetail = (
  effectiveSize: number,
  zoomLevel: number
  //   originalSize?: number
) => {
  return {
    showText: zoomLevel >= 0.3,
    showShortName: zoomLevel >= 1 || effectiveSize >= 65,
    showLegs: zoomLevel > 0.3,
    showLegLabels: effectiveSize >= 55
  };
};

/**
 * Scale stroke width appropriately for zoom level
 */
export const getZoomAwareStrokeWidth = (
  baseWidth: number,
  zoomLevel: number
): number => {
  return Math.max(1, baseWidth * Math.min(1.5, Math.max(0.5, zoomLevel)));
};

/**
 * Check if a point is within viewport bounds
 */
export const isCanvasPointInViewport = (
  point: LogicalPoint,
  viewport: Viewport,
  padding: number = 0
): boolean => {
  return (
    point.x >= viewport.logicalPanOffset.x - padding &&
    point.x <= viewport.logicalPanOffset.x + viewport.logicalWidth + padding &&
    point.y >= viewport.logicalPanOffset.y - padding &&
    point.y <= viewport.logicalPanOffset.y + viewport.logicalHeight + padding
  );
};

/**
 * Calculate bounding box for a set of points
 */
export const calculateBoundingBox = (
  points: LogicalPoint[],
  padding: number = 0
): {
  topLeft: LogicalPoint;
  bottomRight: LogicalPoint;
} | null => {
  if (points.length === 0) return null;

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  points.forEach((point) => {
    minX = Math.min(minX, point.x);
    minY = Math.min(minY, point.y);
    maxX = Math.max(maxX, point.x);
    maxY = Math.max(maxY, point.y);
  });

  return {
    topLeft: new LogicalPoint(minX - padding, minY - padding),
    bottomRight: new LogicalPoint(maxX + padding, maxY + padding)
  };
};
