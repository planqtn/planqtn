import { useCallback, useEffect, useRef } from "react";
import { Connection } from "../../lib/types";
import { DroppedLego } from "../../stores/droppedLegoStore";
import { CanvasStateSerializer } from "./CanvasStateSerializer";

interface CanvasStateManagerProps {
  droppedLegos: DroppedLego[];
  connections: Connection[];
  hideConnectedLegs: boolean;
  onStateLoad: (result: {
    pieces: DroppedLego[];
    connections: Connection[];
    hideConnectedLegs: boolean;
    canvasId: string;
  }) => void;
  onCanvasIdChange: (canvasId: string) => void;
  onError: (error: Error) => void;
}

export const CanvasStateManager: React.FC<CanvasStateManagerProps> = ({
  droppedLegos,
  connections,
  hideConnectedLegs,
  onStateLoad,
  onCanvasIdChange,
  onError
}) => {
  const stateSerializerRef = useRef<CanvasStateSerializer>(
    new CanvasStateSerializer()
  );

  const encodeCanvasState = useCallback(
    (
      pieces: DroppedLego[],
      conns: Connection[],
      hideConnectedLegs: boolean
    ) => {
      try {
        stateSerializerRef.current.encode(pieces, conns, hideConnectedLegs);
      } catch (error) {
        console.error("Failed to encode canvas state:", error);
      }
    },
    []
  );

  const decodeCanvasState = useCallback(
    async (encoded: string) => {
      try {
        const result = await stateSerializerRef.current.decode(encoded);
        onCanvasIdChange(result.canvasId);
        onStateLoad(result);
        return result;
      } catch (error) {
        console.error("Failed to decode canvas state:", error);
        onError(error instanceof Error ? error : new Error(String(error)));
        throw error;
      }
    },
    [onStateLoad, onCanvasIdChange, onError]
  );

  // Handle initial URL state and hash changes
  useEffect(() => {
    const handleHashChange = async () => {
      const hashParams = new URLSearchParams(window.location.hash.slice(1));
      const stateParam = hashParams.get("state");

      if (stateParam) {
        try {
          await decodeCanvasState(stateParam);
        } catch {
          // Hash change will handle the error via onError callback
        }
      } else {
        // No state in URL, generate a new canvas ID
        const newCanvasId = stateSerializerRef.current.getCanvasId();
        onCanvasIdChange(newCanvasId);
      }
    };

    // Listen for hash changes
    window.addEventListener("hashchange", handleHashChange);

    // Initial load
    handleHashChange();

    // Cleanup
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, [decodeCanvasState, onCanvasIdChange]);

  // Auto-encode state changes
  useEffect(() => {
    if (droppedLegos.length > 0 || connections.length > 0) {
      encodeCanvasState(droppedLegos, connections, hideConnectedLegs);
    }
  }, [droppedLegos, connections, hideConnectedLegs, encodeCanvasState]);

  // This component manages state but doesn't render anything
  return null;
};
