/* eslint-disable @typescript-eslint/no-explicit-any */

import { StateCreator } from "zustand";
import { CanvasStore } from "./canvasStateStore";
import { DroppedLego } from "./droppedLegoStore";
import { Connection } from "./connectionStore";
import { LogicalPoint, WindowPoint } from "../types/coordinates";

export interface CopyPasteSlice {
  // Validation function
  validatePastedData: (pastedData: any) => {
    isValid: boolean;
    errors: string[];
  };

  // Clipboard operations
  copyToClipboard: (
    legos: DroppedLego[],
    connections: Connection[]
  ) => Promise<void>;
  pasteFromClipboard: (
    mousePosition: WindowPoint | null,
    onToast: (props: {
      title: string;
      description: string;
      status: string;
      duration: number;
      isClosable: boolean;
    }) => void
  ) => Promise<{
    success: boolean;
    legos?: DroppedLego[];
    connections?: Connection[];
    error?: string;
  }>;
}

export const useCopyPasteSlice: StateCreator<
  CanvasStore,
  [["zustand/immer", never]],
  [],
  CopyPasteSlice
> = (_, get) => ({
  validatePastedData: (
    pastedData: any
  ): { isValid: boolean; errors: string[] } => {
    const errors: string[] = [];

    if (!pastedData.legos || !Array.isArray(pastedData.legos)) {
      errors.push("Invalid legos data: must be an array");
      return { isValid: false, errors };
    }

    if (!pastedData.connections || !Array.isArray(pastedData.connections)) {
      errors.push("Invalid connections data: must be an array");
      return { isValid: false, errors };
    }

    // Create a map of lego IDs for quick lookup
    const legoMap = new Map<string, any>();
    pastedData.legos.forEach((lego: any) => {
      if (!lego.instance_id) {
        errors.push("Lego missing instance_id");
        return;
      }

      // Validate parity check matrix exists and is valid
      if (
        !lego.parity_check_matrix ||
        !Array.isArray(lego.parity_check_matrix) ||
        lego.parity_check_matrix.length === 0
      ) {
        errors.push(
          `Lego '${lego.instance_id}': missing or invalid parity_check_matrix`
        );
        return;
      }

      if (
        !lego.parity_check_matrix[0] ||
        !Array.isArray(lego.parity_check_matrix[0]) ||
        lego.parity_check_matrix[0].length === 0
      ) {
        errors.push(
          `Lego '${lego.instance_id}': invalid parity_check_matrix structure`
        );
        return;
      }

      legoMap.set(lego.instance_id, lego);
    });

    // Create a map to track leg connections
    const legConnections = new Map<string, number>();

    // Validate each connection
    pastedData.connections.forEach((conn: any, index: number) => {
      if (!conn.from || !conn.to) {
        errors.push(`Connection ${index}: missing from or to property`);
        return;
      }

      // Check if from lego exists
      if (!legoMap.has(conn.from.legoId)) {
        errors.push(
          `Connection ${index}: from lego with ID '${conn.from.legoId}' does not exist`
        );
        return;
      }

      // Check if to lego exists
      if (!legoMap.has(conn.to.legoId)) {
        errors.push(
          `Connection ${index}: to lego with ID '${conn.to.legoId}' does not exist`
        );
        return;
      }

      const fromLego = legoMap.get(conn.from.legoId);
      const toLego = legoMap.get(conn.to.legoId);

      // Check if from leg index is valid
      if (typeof conn.from.leg_index !== "number" || conn.from.leg_index < 0) {
        errors.push(
          `Connection ${index}: invalid from leg_index '${conn.from.leg_index}'`
        );
        return;
      }

      // Check if to leg index is valid
      if (typeof conn.to.leg_index !== "number" || conn.to.leg_index < 0) {
        errors.push(
          `Connection ${index}: invalid to leg_index '${conn.to.leg_index}'`
        );
        return;
      }

      // Check if from leg exists (leg index is within the lego's number of legs)
      const fromLegoNumLegs = Math.trunc(
        (fromLego.parity_check_matrix?.[0]?.length || 0) / 2
      );
      if (conn.from.leg_index >= fromLegoNumLegs) {
        errors.push(
          `Connection ${index}: from leg_index '${conn.from.leg_index}' is out of range for lego '${conn.from.legoId}' (has ${fromLegoNumLegs} legs)`
        );
        return;
      }

      // Check if to leg exists (leg index is within the lego's number of legs)
      const toLegoNumLegs = Math.trunc(
        (toLego.parity_check_matrix?.[0]?.length || 0) / 2
      );
      if (conn.to.leg_index >= toLegoNumLegs) {
        errors.push(
          `Connection ${index}: to leg_index '${conn.to.leg_index}' is out of range for lego '${conn.to.legoId}' (has ${toLegoNumLegs} legs)`
        );
        return;
      }

      // Track leg connections to check for multiple connections per leg
      const fromLegKey = `${conn.from.legoId}-${conn.from.leg_index}`;
      const toLegKey = `${conn.to.legoId}-${conn.to.leg_index}`;

      legConnections.set(fromLegKey, (legConnections.get(fromLegKey) || 0) + 1);
      legConnections.set(toLegKey, (legConnections.get(toLegKey) || 0) + 1);
    });

    // Check for legs with multiple connections
    legConnections.forEach((count, legKey) => {
      if (count > 1) {
        errors.push(
          `Leg '${legKey}' has ${count} connections (should have only 1)`
        );
      }
    });

    // Check for self-connections (a lego connecting to itself)
    pastedData.connections.forEach((conn: any, index: number) => {
      if (
        conn.from.legoId === conn.to.legoId &&
        conn.from.leg_index === conn.to.leg_index
      ) {
        errors.push(
          `Connection ${index}: lego '${conn.from.legoId}' cannot connect leg ${conn.from.leg_index} to itself`
        );
      }
    });

    return { isValid: errors.length === 0, errors };
  },

  copyToClipboard: async (
    legos: DroppedLego[],
    connections: Connection[]
  ): Promise<void> => {
    if (legos.length === 0) {
      throw new Error("No legos to copy");
    }

    const selectedLegoIds = new Set(
      legos.map((l: DroppedLego) => l.instance_id)
    );

    const selectedConnections = connections.filter(
      (conn) =>
        selectedLegoIds.has(conn.from.legoId) &&
        selectedLegoIds.has(conn.to.legoId)
    );

    // Remove 'style' property from each lego before copying
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const plainLegos = legos.map(({ style, ...rest }) => rest);

    const clipboardData = {
      legos: plainLegos,
      connections: selectedConnections
    };

    await navigator.clipboard.writeText(JSON.stringify(clipboardData));
  },

  pasteFromClipboard: async (
    mousePosition: WindowPoint | null,
    onToast: (props: {
      title: string;
      description: string;
      status: string;
      duration: number;
      isClosable: boolean;
    }) => void
  ): Promise<{
    success: boolean;
    legos?: DroppedLego[];
    connections?: Connection[];
    error?: string;
  }> => {
    try {
      const clipText = await navigator.clipboard.readText();
      const pastedData = JSON.parse(clipText);

      // Validate the pasted data
      const validation = get().validatePastedData(pastedData);
      if (!validation.isValid) {
        const errorMessage = `Invalid network data: ${validation.errors.join(", ")}`;
        onToast({
          title: "Paste validation failed",
          description: errorMessage,
          status: "error",
          duration: 5000,
          isClosable: true
        });
        return { success: false, error: errorMessage };
      }

      if (
        pastedData.legos &&
        Array.isArray(pastedData.legos) &&
        pastedData.legos.length > 0
      ) {
        const dropPoint = mousePosition
          ? get().viewport.fromWindowToLogical(mousePosition)
          : get().viewport.logicalCenter;

        // Create a mapping from old instance IDs to new ones
        const startingId = parseInt(get().newInstanceId());
        const instanceIdMap = new Map<string, string>();

        // Create new legos with new instance IDs
        const newLegos = pastedData.legos.map((l: DroppedLego, idx: number) => {
          const newId = String(startingId + idx);
          instanceIdMap.set(l.instance_id, newId);
          // Style will be recalculated in DroppedLego constructor
          return new DroppedLego(
            l,
            new LogicalPoint(
              l.logicalPosition.x +
                dropPoint.x -
                pastedData.legos[0].logicalPosition.x,
              l.logicalPosition.y +
                dropPoint.y -
                pastedData.legos[0].logicalPosition.y
            ),
            newId
          );
        });

        // Create new connections with updated instance IDs
        const newConnections = (pastedData.connections || []).map(
          (conn: Connection) => {
            return new Connection(
              {
                legoId: instanceIdMap.get(conn.from.legoId)!,
                leg_index: conn.from.leg_index
              },
              {
                legoId: instanceIdMap.get(conn.to.legoId)!,
                leg_index: conn.to.leg_index
              }
            );
          }
        );

        onToast({
          title: "Paste successful",
          description: `Pasted ${newLegos.length} lego${
            newLegos.length > 1 ? "s" : ""
          }`,
          status: "success",
          duration: 2000,
          isClosable: true
        });

        return {
          success: true,
          legos: newLegos,
          connections: newConnections
        };
      }

      return { success: false, error: "No valid legos found in clipboard" };
    } catch (err) {
      const errorMessage = `Failed to paste from clipboard: ${err}`;
      onToast({
        title: "Paste failed",
        description: errorMessage,
        status: "error",
        duration: 2000,
        isClosable: true
      });
      return { success: false, error: errorMessage };
    }
  }
});
