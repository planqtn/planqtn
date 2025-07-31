import { useEffect, useRef } from "react";
import { TensorNetwork } from "../../lib/TensorNetwork";
import { useCanvasStore } from "../../stores/canvasStateStore";
import * as _ from "lodash";
import { DroppedLego } from "../../stores/droppedLegoStore";
import { WindowPoint } from "../../types/coordinates";
import { useToast } from "@chakra-ui/react";

interface KeyboardHandlerProps {
  onSetAltKeyPressed: (pressed: boolean) => void;
}

export const KeyboardHandler: React.FC<KeyboardHandlerProps> = ({
  onSetAltKeyPressed
}) => {
  const mousePositionRef = useRef<WindowPoint | null>(null);
  const {
    droppedLegos,
    addDroppedLegos,
    removeDroppedLegos,
    connections,
    addConnections,
    removeConnections,
    addOperation,
    undo,
    redo,
    tensorNetwork,
    setTensorNetwork,
    setError,
    copyToClipboard,
    pasteFromClipboard,
    fuseLegos,
    handlePullOutSameColoredLeg
  } = useCanvasStore();
  const toast = useToast();

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
        // Check if there's text selection - if so, allow normal copy behavior
        const selection = window.getSelection();
        const hasTextSelection = selection
          ? selection.toString().length > 0
          : false;

        if (!hasTextSelection) {
          e.preventDefault();
          if (tensorNetwork && tensorNetwork.legos.length > 0) {
            try {
              await copyToClipboard(tensorNetwork.legos, connections);
              toast({
                title: "Copied to clipboard",
                description: "Network data has been copied",
                status: "success",
                duration: 2000,
                isClosable: true
              });
            } catch (err) {
              console.error("Failed to copy to clipboard:", err);
              toast({
                title: "Copy failed",
                description: "Failed to copy network data (" + err + ")",
                status: "error",
                duration: 2000,
                isClosable: true
              });
            }
          }
        }
        // If text is selected, don't prevent default - let the browser handle normal copy
      } else if ((e.ctrlKey || e.metaKey) && e.key === "v") {
        e.preventDefault();

        const result = await pasteFromClipboard(
          mousePositionRef.current,
          (props) =>
            toast({
              ...props,
              status: props.status as "success" | "error" | "warning" | "info"
            })
        );

        if (result.success && result.legos && result.connections) {
          // Update state
          addDroppedLegos(result.legos);
          addConnections(result.connections);

          // Add to history
          addOperation({
            type: "add",
            data: {
              legosToAdd: result.legos,
              connectionsToAdd: result.connections
            }
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
                conn.from.legoId === lego.instance_id ||
                conn.to.legoId === lego.instance_id
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
                  conn.from.legoId === lego.instance_id ||
                  conn.to.legoId === lego.instance_id
              )
            )
          );
          removeDroppedLegos(legosToRemove.map((l) => l.instance_id));
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key === "a") {
        e.preventDefault();
        if (droppedLegos.length > 0) {
          const tensorNetwork = new TensorNetwork({
            legos: _.cloneDeep(droppedLegos),
            connections: _.cloneDeep(connections)
          });

          setTensorNetwork(tensorNetwork);
        }
      } else if (e.key === "Escape") {
        // Dismiss error message when Escape is pressed
        setError(null);
      } else if (e.key === "f") {
        e.preventDefault();
        if (tensorNetwork) {
          fuseLegos(tensorNetwork.legos);
        }
      } else if (e.key === "p") {
        e.preventDefault();
        if (
          tensorNetwork &&
          (tensorNetwork.legos[0].type_id === "x_rep_code" ||
            tensorNetwork.legos[0].type_id === "z_rep_code")
        ) {
          handlePullOutSameColoredLeg(tensorNetwork.legos[0]);
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
        mousePositionRef.current = WindowPoint.fromMouseEvent(e);
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
