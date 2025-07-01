import { useEffect, useRef } from "react";
import { Connection } from "../../lib/types";
import { TensorNetwork } from "../../lib/TensorNetwork";
import { useCanvasStore } from "../../stores/canvasStateStore";
import * as _ from "lodash";
import { DroppedLego } from "../../stores/droppedLegoStore";

interface KeyboardHandlerProps {
  onSetAltKeyPressed: (pressed: boolean) => void;
  onSetError: (error: string) => void;
  onFuseLegos: (legos: DroppedLego[]) => void;
  onPullOutSameColoredLeg: (lego: DroppedLego) => void;
  onToast: (props: {
    title: string;
    description: string;
    status: string;
    duration: number;
    isClosable: boolean;
  }) => void;
}

export const KeyboardHandler: React.FC<KeyboardHandlerProps> = ({
  onSetAltKeyPressed,
  onSetError,
  onFuseLegos,
  onPullOutSameColoredLeg,
  onToast
}) => {
  const mousePositionRef = useRef<{ x: number; y: number } | null>(null);
  const {
    droppedLegos,
    addDroppedLegos,
    removeDroppedLegos,
    connections,
    addConnections,
    removeConnections,
    newInstanceId,
    addOperation,
    undo,
    redo,
    tensorNetwork,
    setTensorNetwork
  } = useCanvasStore();

  useEffect(() => {
    const handleKeyDown = async (e: KeyboardEvent) => {
      if (e.key === "Alt") {
        onSetAltKeyPressed(true);
      } else if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if (
        ((e.ctrlKey || e.metaKey) && e.key === "y") ||
        ((e.ctrlKey || e.metaKey) && e.key === "z" && e.shiftKey)
      ) {
        e.preventDefault();
        redo();
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
                return new DroppedLego(
                  l,
                  l.x + dropX - pastedData.legos[0].x,
                  l.y + dropY - pastedData.legos[0].y,
                  newId
                );
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
            addDroppedLegos(newLegos);
            addConnections(newConnections);

            // Add to history
            addOperation({
              type: "add",
              data: {
                legosToAdd: newLegos,
                connectionsToAdd: newConnections
              }
            });

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
          addOperation({
            type: "remove",
            data: {
              legosToRemove: legosToRemove,
              connectionsToRemove: connectionsToRemove
            }
          });

          // Remove the connections and legos
          removeConnections(
            connections.filter((conn) =>
              legosToRemove.some(
                (lego) =>
                  conn.from.legoId === lego.instanceId ||
                  conn.to.legoId === lego.instanceId
              )
            )
          );
          removeDroppedLegos(legosToRemove.map((l) => l.instanceId));
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key === "a") {
        console.log("select all");
        e.preventDefault();
        if (droppedLegos.length > 0) {
          const tensorNetwork = new TensorNetwork({
            legos: _.cloneDeep(droppedLegos),
            connections: _.cloneDeep(connections)
          });

          console.log("tensorNetwork", tensorNetwork);
          setTensorNetwork(tensorNetwork);
        } else {
          console.log("no droppedLegos");
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
      // onSetCanvasDragState({
      //   isDragging: false
      // });
      // onSetAltKeyPressed(false);
    };

    const handleFocus = () => {
      // onSetCanvasDragState({
      //   isDragging: false
      // });
      // onSetAltKeyPressed(false);
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
  }, [tensorNetwork, droppedLegos, connections, onSetAltKeyPressed]);

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
