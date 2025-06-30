import { Connection, DroppedLego } from "./types";

// Add these helper functions near the top of the file
export const pointToLineDistance = (
  x: number,
  y: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number
) => {
  const A = x - x1;
  const B = y - y1;
  const C = x2 - x1;
  const D = y2 - y1;

  const dot = A * C + B * D;
  const len_sq = C * C + D * D;
  let param = -1;
  if (len_sq !== 0) {
    param = dot / len_sq;
  }

  let xx, yy;

  if (param < 0) {
    xx = x1;
    yy = y1;
  } else if (param > 1) {
    xx = x2;
    yy = y2;
  } else {
    xx = x1 + param * C;
    yy = y1 + param * D;
  }

  const dx = x - xx;
  const dy = y - yy;
  return Math.sqrt(dx * dx + dy * dy);
};

// Add this before the App component
export const findClosestDanglingLeg = (
  dropPosition: { x: number; y: number },
  droppedLegos: DroppedLego[],
  connections: Connection[]
): { lego: DroppedLego; legIndex: number } | null => {
  let closestLego: DroppedLego | null = null;
  let closestLegIndex: number = -1;
  let minDistance = Infinity;

  droppedLegos.forEach((lego) => {
    const totalLegs = lego.parity_check_matrix[0].length / 2;
    for (let legIndex = 0; legIndex < totalLegs; legIndex++) {
      // Skip if leg is already connected
      const isConnected = connections.some(
        (conn) =>
          (conn.from.legoId === lego.instanceId &&
            conn.from.legIndex === legIndex) ||
          (conn.to.legoId === lego.instanceId && conn.to.legIndex === legIndex)
      );
      if (isConnected) continue;

      const pos = lego.style!.legStyles[legIndex].position;
      const legX = lego.x + pos.endX;
      const legY = lego.y + pos.endY;
      const distance = Math.sqrt(
        Math.pow(dropPosition.x - legX, 2) + Math.pow(dropPosition.y - legY, 2)
      );

      if (distance < minDistance && distance < 20) {
        // 20 pixels threshold
        minDistance = distance;
        closestLego = lego;
        closestLegIndex = legIndex;
      }
    }
  });

  return closestLego && closestLegIndex !== -1
    ? { lego: closestLego, legIndex: closestLegIndex }
    : null;
};
