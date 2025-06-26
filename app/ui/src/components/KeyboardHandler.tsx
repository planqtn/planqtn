import { useEffect, useRef } from "react";
import { DroppedLego, Connection } from "../lib/types";
import { getLegoStyle } from "../LegoStyles";
import { TensorNetwork } from "../lib/TensorNetwork";
import { OperationHistory } from "../lib/OperationHistory";

interface KeyboardHandlerProps {
  droppedLegos: DroppedLego[];
  connections: Connection[];
  hideConnectedLegs: boolean;
  tensorNetwork: TensorNetwork | null;
  operationHistory: OperationHistory;
  newInstanceId: () => string;
  onSetDroppedLegos: (legos: DroppedLego[]) => void;
  onSetConnections: (connections: Connection[]) => void;
  onSetTensorNetwork: (network: unknown) => void;
  onSetAltKeyPressed: (pressed: boolean) => void;
  onEncodeCanvasState: (
    legos: DroppedLego[],
    connections: Connection[],
    hideLegs: boolean
  ) => void;
  onUndo: () => void;
  onRedo: () => void;
  onSetError: (error: string) => void;
  onFuseLegos: (legos: DroppedLego[]) => void;
  onPullOutSameColoredLeg: (lego: DroppedLego) => void;
  onCreateNetworkSignature: (network: TensorNetwork) => string;
  onSetCanvasDragState: (state: unknown) => void;
  onToast: (props: {
    title: string;
    description: string;
    status: string;
    duration: number;
    isClosable: boolean;
  }) => void;
}

export const KeyboardHandler: React.FC<KeyboardHandlerProps> = ({
  droppedLegos,
  connections,
  hideConnectedLegs,
  tensorNetwork,
  operationHistory,
  newInstanceId,
  onSetDroppedLegos,
  onSetConnections,
  onSetTensorNetwork,
  onSetAltKeyPressed,
  onEncodeCanvasState,
  onUndo,
  onRedo,
  onSetError,
  onFuseLegos,
  onPullOutSameColoredLeg,
  onCreateNetworkSignature,
  onSetCanvasDragState,
  onToast
}) => {
  const mousePositionRef = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const handleKeyDown = async (e: KeyboardEvent) => {
      if (e.key === "Alt") {
        onSetAltKeyPressed(true);
      } else if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        onUndo();
      } else if (
        ((e.ctrlKey || e.metaKey) && e.key === "y") ||
        ((e.ctrlKey || e.metaKey) && e.key === "z" && e.shiftKey)
      ) {
        e.preventDefault();
        onRedo();
      } else if ((e.ctrlKey || e.metaKey) && e.key === "c") {
        e.preventDefault();
        if (tensorNetwork && tensorNetwork.legos.length > 0) {
          const selectedLegos = tensorNetwork.legos;
          const selectedLegoIds = new Set(
            selectedLegos.map((l: DroppedLego) => l.instanceId)
          );

          const selectedConnections = connections.filter(
            (conn) =>
              selectedLegoIds.has(conn.from.legoId) &&
              selectedLegoIds.has(conn.to.legoId)
          );

          const clipboardData = {
            legos: selectedLegos,
            connections: selectedConnections
          };

          try {
            await navigator.clipboard.writeText(JSON.stringify(clipboardData));
            onToast({
              title: "Copied to clipboard",
              description: "Network data has been copied",
              status: "success",
              duration: 2000,
              isClosable: true
            });
          } catch (err) {
            console.error("Failed to copy to clipboard:", err);
            onToast({
              title: "Copy failed",
              description: "Failed to copy network data (" + err + ")",
              status: "error",
              duration: 2000,
              isClosable: true
            });
          }
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key === "v") {
        e.preventDefault();
        try {
          const clipText = await navigator.clipboard.readText();
          const pastedData = JSON.parse(clipText);

          if (
            pastedData.legos &&
            Array.isArray(pastedData.legos) &&
            pastedData.legos.length > 0
          ) {
            // Get canvas element and its dimensions
            const canvasPanel = document.querySelector("#main-panel");
            if (!canvasPanel) return;

            const canvasRect = canvasPanel.getBoundingClientRect();

            // Determine drop position
            let dropX: number, dropY: number;

            if (mousePositionRef.current) {
              // Use current mouse position
              dropX = mousePositionRef.current.x;
              dropY = mousePositionRef.current.y;
            } else {
              // Use random position around canvas center
              const centerX = canvasRect.width / 2;
              const centerY = canvasRect.height / 2;
              const randomOffset = 50; // pixels

              dropX = centerX + (Math.random() * 2 - 1) * randomOffset;
              dropY = centerY + (Math.random() * 2 - 1) * randomOffset;
            }

            // Create a mapping from old instance IDs to new ones
            const startingId = parseInt(newInstanceId());
            const instanceIdMap = new Map<string, string>();

            // Create new legos with new instance IDs
            const newLegos = pastedData.legos.map(
              (l: DroppedLego, idx: number) => {
                const newId = String(startingId + idx);
                instanceIdMap.set(l.instanceId, newId);
                return {
                  ...l,
                  instanceId: newId,
                  x: l.x + dropX - pastedData.legos[0].x, // Maintain relative positions
                  y: l.y + dropY - pastedData.legos[0].y,
                  style: getLegoStyle(l.id, l.parity_check_matrix[0].length / 2)
                };
              }
            );

            // Create new connections with updated instance IDs
            const newConnections = (pastedData.connections || []).map(
              (conn: Connection) => {
                return {
                  from: {
                    legoId: instanceIdMap.get(conn.from.legoId)!,
                    legIndex: conn.from.legIndex
                  },
                  to: {
                    legoId: instanceIdMap.get(conn.to.legoId)!,
                    legIndex: conn.to.legIndex
                  }
                };
              }
            );

            // Update state
            onSetDroppedLegos([...droppedLegos, ...newLegos]);
            onSetConnections([...connections, ...newConnections]);

            // Add to history
            operationHistory.addOperation({
              type: "add",
              data: {
                legosToAdd: newLegos,
                connectionsToAdd: newConnections
              }
            });

            // Update URL state
            onEncodeCanvasState(
              [...droppedLegos, ...newLegos],
              [...connections, ...newConnections],
              hideConnectedLegs
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
          }
        } catch (err) {
          console.error("Failed to paste from clipboard:", err);
          onToast({
            title: "Paste failed",
            description: "Invalid network data in clipboard (" + err + ")",
            status: "error",
            duration: 2000,
            isClosable: true
          });
        }
      } else if (e.key === "Delete" || e.key === "Backspace") {
        // Handle deletion of selected legos
        let legosToRemove: DroppedLego[] = [];

        if (tensorNetwork) {
          legosToRemove = tensorNetwork.legos;
        }

        if (legosToRemove.length > 0) {
          // Get all connections involving the legos to be removed
          const connectionsToRemove = connections.filter((conn) =>
            legosToRemove.some(
              (lego) =>
                conn.from.legoId === lego.instanceId ||
                conn.to.legoId === lego.instanceId
            )
          );

          // Add to history
          operationHistory.addOperation({
            type: "remove",
            data: {
              legosToRemove: legosToRemove,
              connectionsToRemove: connectionsToRemove
            }
          });

          // Remove the connections and legos
          onSetConnections(
            connections.filter(
              (conn) =>
                !legosToRemove.some(
                  (lego) =>
                    conn.from.legoId === lego.instanceId ||
                    conn.to.legoId === lego.instanceId
                )
            )
          );
          onSetDroppedLegos(
            droppedLegos.filter(
              (lego) =>
                !legosToRemove.some((l) => l.instanceId === lego.instanceId)
            )
          );

          // Clear selection states
          onSetTensorNetwork(null);

          // Update URL state
          onEncodeCanvasState(
            droppedLegos.filter(
              (lego) =>
                !legosToRemove.some((l) => l.instanceId === lego.instanceId)
            ),
            connections.filter(
              (conn) =>
                !legosToRemove.some(
                  (l) =>
                    conn.from.legoId === l.instanceId ||
                    conn.to.legoId === l.instanceId
                )
            ),
            hideConnectedLegs
          );
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key === "a") {
        e.preventDefault();
        if (droppedLegos.length > 0) {
          // Create a tensor network from all legos
          const selectedLegoIds = new Set(
            droppedLegos.map((lego) => lego.instanceId)
          );

          // Collect only internal connections between selected legos
          const internalConnections = connections.filter(
            (conn) =>
              selectedLegoIds.has(conn.from.legoId) &&
              selectedLegoIds.has(conn.to.legoId)
          );

          const tensorNetwork = new TensorNetwork(
            droppedLegos,
            internalConnections
          );

          tensorNetwork.signature = onCreateNetworkSignature(tensorNetwork);

          onSetTensorNetwork(tensorNetwork);
        }
      } else if (e.key === "Escape") {
        // Dismiss error message when Escape is pressed
        onSetError("");
      } else if (e.key === "f") {
        e.preventDefault();
        if (tensorNetwork) {
          onFuseLegos(tensorNetwork.legos);
        }
      } else if (e.key === "p") {
        e.preventDefault();
        if (
          tensorNetwork &&
          (tensorNetwork.legos[0].id === "x_rep_code" ||
            tensorNetwork.legos[0].id === "z_rep_code")
        ) {
          onPullOutSameColoredLeg(tensorNetwork.legos[0]);
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === "Alt") {
        onSetAltKeyPressed(false);
      }
    };

    const handleBlur = () => {
      onSetCanvasDragState({
        isDragging: false
      });
      onSetAltKeyPressed(false);
    };

    const handleFocus = () => {
      onSetCanvasDragState({
        isDragging: false
      });
      onSetAltKeyPressed(false);
    };

    // Add event listeners
    document.addEventListener("keydown", handleKeyDown);
    document.addEventListener("keyup", handleKeyUp);
    window.addEventListener("blur", handleBlur);
    window.addEventListener("focus", handleFocus);

    // Cleanup
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("blur", handleBlur);
      window.removeEventListener("focus", handleFocus);
    };
  }, [
    droppedLegos,
    connections,
    hideConnectedLegs,
    tensorNetwork,
    operationHistory,
    newInstanceId,
    onSetDroppedLegos,
    onSetConnections,
    onSetTensorNetwork,
    onSetAltKeyPressed,
    onEncodeCanvasState,
    onUndo,
    onRedo
  ]);

  // Track mouse position for paste operations
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const canvasPanel = document.querySelector("#main-panel");
      if (!canvasPanel) return;

      const canvasRect = canvasPanel.getBoundingClientRect();
      const isOverCanvas =
        e.clientX >= canvasRect.left &&
        e.clientX <= canvasRect.right &&
        e.clientY >= canvasRect.top &&
        e.clientY <= canvasRect.bottom;

      if (isOverCanvas) {
        mousePositionRef.current = {
          x: e.clientX - canvasRect.left,
          y: e.clientY - canvasRect.top
        };
      } else {
        mousePositionRef.current = null;
      }
    };

    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  // This component handles events but doesn't render anything
  return null;
};
