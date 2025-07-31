import React, { useMemo, useState, useRef, useEffect } from "react";
import { useCanvasStore } from "../../stores/canvasStateStore";
import { usePanelConfigStore } from "../../stores/panelConfigStore";
import { useUserStore } from "../../stores/userStore";
import { SubnetToolbar } from "./SubnetToolbar";
import { DraggingStage } from "../../stores/legoDragState";
import { calculateBoundingBoxForLegos } from "../../stores/canvasUISlice";
import { WindowPoint } from "../../types/coordinates";

export const SubnetToolbarOverlay: React.FC = () => {
  const { isUserLoggedIn } = useUserStore();

  const tensorNetwork = useCanvasStore((state) => state.tensorNetwork);
  const calculateTensorNetworkBoundingBox = useCanvasStore(
    (state) => state.calculateTensorNetworkBoundingBox
  );
  const viewport = useCanvasStore((state) => state.viewport);
  const calculateParityCheckMatrix = useCanvasStore(
    (state) => state.calculateParityCheckMatrix
  );
  const openPCMPanel = usePanelConfigStore((state) => state.openPCMPanel);
  const openSingleLegoPCMPanel = usePanelConfigStore(
    (state) => state.openSingleLegoPCMPanel
  );

  // Get the same bounding box logic as LegosLayer
  const legoDragState = useCanvasStore((state) => state.legoDragState);
  const groupDragState = useCanvasStore((state) => state.groupDragState);
  const droppedLegos = useCanvasStore((state) => state.droppedLegos);
  const resizeProxyLegos = useCanvasStore((state) => state.resizeProxyLegos);

  // Calculate bounding box for the current tensor network
  const tnBoundingBoxLogical =
    tensorNetwork && tensorNetwork.legos.length > 0
      ? calculateTensorNetworkBoundingBox()
      : null;

  // Calculate dragged legos (same logic as LegosLayer)
  const draggedLegos = useMemo(() => {
    if (legoDragState.draggingStage !== DraggingStage.DRAGGING) {
      return [];
    }

    // Get all dragged legos (both individual and group)
    const draggedIds = new Set<string>();

    // Add individually dragged lego
    if (legoDragState.draggedLegoInstanceId) {
      draggedIds.add(legoDragState.draggedLegoInstanceId);
    }

    // Add group dragged legos
    if (groupDragState && groupDragState.legoInstanceIds) {
      groupDragState.legoInstanceIds.forEach((id) => draggedIds.add(id));
    }

    return droppedLegos.filter((lego) => draggedIds.has(lego.instance_id));
  }, [groupDragState, legoDragState, droppedLegos]);

  // Track mouse position for drag operations (same as LegosLayer)
  const [mousePos, setMousePos] = useState(new WindowPoint(0, 0));
  const animationFrameRef = useRef<number | null>(null);

  useEffect(() => {
    const shouldTrackMouse =
      legoDragState.draggingStage === DraggingStage.DRAGGING &&
      (!!groupDragState || !!legoDragState.draggedLegoInstanceId);

    if (!shouldTrackMouse) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      animationFrameRef.current = requestAnimationFrame(() => {
        const newMousePos = WindowPoint.fromMouseEvent(e);
        setMousePos(newMousePos);
      });
    };

    window.addEventListener("mousemove", handleMouseMove);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [legoDragState.draggingStage, groupDragState]);

  // Calculate bounding box for dragged legos (same logic as LegosLayer)
  const draggedLegosBoundingBoxLogical = useMemo(() => {
    if (draggedLegos.length === 0) return null;

    // Calculate the delta from original positions to current positions (same logic as DragProxy)
    const startMouseLogicalPoint = viewport.fromWindowToLogical(
      legoDragState.startMouseWindowPoint
    );
    const currentMouseLogicalPoint = viewport.fromWindowToLogical(mousePos);

    const deltaLogical = currentMouseLogicalPoint.minus(startMouseLogicalPoint);

    // Handle single lego drag (same logic as SingleLegoDragProxy)
    if (legoDragState.draggedLegoInstanceId && draggedLegos.length === 1) {
      const lego = draggedLegos[0];

      // Calculate the mouse starting grab delta (same as DragProxy)
      const mouseStartingGrabDeltaWindow =
        legoDragState.startMouseWindowPoint.minus(
          viewport.fromLogicalToWindow(legoDragState.startLegoLogicalPoint)
        );

      // Calculate the new canvas position (same as DragProxy)
      const proxyCanvasPos = viewport.fromWindowToCanvas(
        mousePos.minus(mouseStartingGrabDeltaWindow)
      );

      // Convert back to logical position for bounding box calculation
      const newLogicalPos = viewport.fromCanvasToLogical(proxyCanvasPos);

      const updatedLego = lego.with({
        logicalPosition: newLogicalPos
      });
      return calculateBoundingBoxForLegos([updatedLego]);
    }

    // Handle group drag (multiple legos)
    if (groupDragState && groupDragState.originalPositions) {
      // Create legos with updated positions for bounding box calculation (same as DragProxy)
      const legosWithUpdatedPositions = draggedLegos.map((lego) => {
        const originalPos = groupDragState.originalPositions[lego.instance_id];
        if (originalPos) {
          return lego.with({
            logicalPosition: originalPos.plus(deltaLogical)
          });
        }
        return lego;
      });

      return calculateBoundingBoxForLegos(legosWithUpdatedPositions);
    }

    return calculateBoundingBoxForLegos(draggedLegos);
  }, [draggedLegos, groupDragState, legoDragState, viewport, mousePos]);

  // Use the same bounding box priority as LegosLayer
  const proxyBoundingBoxLogical = resizeProxyLegos
    ? calculateBoundingBoxForLegos(resizeProxyLegos)
    : null;

  const boundingBoxLogical =
    proxyBoundingBoxLogical ||
    draggedLegosBoundingBoxLogical ||
    tnBoundingBoxLogical;
  const boundingBox = boundingBoxLogical
    ? viewport.fromLogicalToCanvasBB(boundingBoxLogical)
    : null;

  // Calculate constrained positions to keep toolbar and name within canvas bounds
  const constrainedBoundingBox = useMemo(() => {
    if (!boundingBox) return null;

    // Get canvas dimensions
    const canvasWidth = viewport.screenWidth;
    const canvasHeight = viewport.screenHeight;

    // Toolbar dimensions (approximate)
    const toolbarHeight = 50;
    const toolbarWidth = 400; // Approximate width of the toolbar

    // Name display dimensions (approximate)
    const nameHeight = 30;
    const nameWidth = 200; // Approximate width of the name

    // Calculate desired positions
    const desiredToolbarTop = boundingBox.minY - 90;
    const boundingBoxCenterX = boundingBox.minX + boundingBox.width / 2;
    const desiredToolbarLeft = boundingBoxCenterX - toolbarWidth / 2;

    // Constrain toolbar position while maintaining center alignment when possible
    const constrainedToolbarTop = Math.max(
      10,
      Math.min(
        desiredToolbarTop,
        canvasHeight - toolbarHeight - nameHeight - 20
      ) // Leave space for name
    );

    // Center the toolbar on the bounding box, but constrain to canvas bounds
    let constrainedToolbarLeft = desiredToolbarLeft;
    if (constrainedToolbarLeft < 10) {
      // If too far left, align to left edge but maintain center alignment if possible
      constrainedToolbarLeft = 10;
    } else if (constrainedToolbarLeft + toolbarWidth > canvasWidth - 10) {
      // If too far right, align to right edge but maintain center alignment if possible
      constrainedToolbarLeft = canvasWidth - toolbarWidth - 10;
    }

    // Name position is ALWAYS below the toolbar with fixed spacing, but constrained to canvas bounds
    const desiredNameTop = constrainedToolbarTop + toolbarHeight + 10; // Always 10px below toolbar
    const constrainedNameTop = Math.min(
      desiredNameTop,
      canvasHeight - nameHeight - 10
    ); // Don't go off bottom

    // Center the name on the bounding box, but constrain to canvas bounds
    const desiredNameLeft = boundingBoxCenterX - nameWidth / 2;
    let constrainedNameLeft = desiredNameLeft;
    if (constrainedNameLeft < 10) {
      // If too far left, align to left edge
      constrainedNameLeft = 10;
    } else if (constrainedNameLeft + nameWidth > canvasWidth - 10) {
      // If too far right, align to right edge
      constrainedNameLeft = canvasWidth - nameWidth - 10;
    }
    return {
      ...boundingBox,
      // Adjust the bounding box to account for the constrained positions
      constrainedToolbarTop,
      constrainedToolbarLeft,
      constrainedNameTop,
      constrainedNameLeft
    };
  }, [boundingBox, viewport.screenWidth, viewport.screenHeight]);

  // Placeholder handlers for toolbar actions
  const handleToggleLock = () => {
    console.log("Toggle lock");
  };

  const handleCollapse = () => {
    console.log("Collapse");
  };

  const handleExpand = () => {
    console.log("Expand");
  };

  const handleWeightEnumerator = () => {
    console.log("Weight enumerator");
  };

  const handleParityCheckMatrix = async () => {
    if (tensorNetwork?.isSingleLego) {
      // For single legos, open the PCM panel directly with the lego's matrix
      const singleLego = tensorNetwork.singleLego;
      openSingleLegoPCMPanel(
        singleLego.instance_id,
        singleLego.short_name || singleLego.name
      );
    } else {
      // For multi-lego networks, calculate the parity check matrix and open the panel
      await calculateParityCheckMatrix((networkSignature, networkName) => {
        // Open PCM panel after successful calculation
        openPCMPanel(networkSignature, networkName);
      });
    }
  };

  const handleMatrixRowSelectionForSelectedTensorNetwork = useCanvasStore(
    (state) => state.handleMatrixRowSelectionForSelectedTensorNetwork
  );
  const handleSingleLegoMatrixRowSelection = useCanvasStore(
    (state) => state.handleSingleLegoMatrixRowSelection
  );

  const parityCheckMatrices = useCanvasStore(
    (state) => state.parityCheckMatrices
  );

  const handleChangeColor = () => {
    console.log("Change color");
  };

  const handlePullOutSameColor = () => {
    console.log("Pull out same color");
  };

  const handleBiAlgebra = () => {
    console.log("Bi-algebra");
  };

  const handleInverseBiAlgebra = () => {
    console.log("Inverse bi-algebra");
  };

  const handleUnfuseToLegs = () => {
    console.log("Unfuse to legs");
  };

  const handleUnfuseToTwo = () => {
    console.log("Unfuse to two");
  };

  const handleCompleteGraph = () => {
    console.log("Complete graph");
  };

  const handleConnectViaCentral = () => {
    console.log("Connect via central");
  };

  const handleRemoveFromCache = () => {
    console.log("Remove from cache");
  };

  const handleRemoveHighlights = () => {
    if (tensorNetwork && tensorNetwork.legos.length == 1) {
      handleMatrixRowSelectionForSelectedTensorNetwork([]);
      return;
    }
    // otherwise we'll have to go through all selected legos and clear their highlights
    if (tensorNetwork) {
      if (parityCheckMatrices[tensorNetwork.signature]) {
        handleMatrixRowSelectionForSelectedTensorNetwork([]);
      }

      tensorNetwork.legos.forEach((lego) => {
        handleSingleLegoMatrixRowSelection(lego, []);
      });
    }
  };

  // Only render if we have a tensor network and bounding box
  if (!tensorNetwork || !constrainedBoundingBox) {
    return null;
  }

  return (
    <SubnetToolbar
      boundingBox={constrainedBoundingBox}
      onToggleLock={handleToggleLock}
      onCollapse={handleCollapse}
      onExpand={handleExpand}
      onWeightEnumerator={handleWeightEnumerator}
      onParityCheckMatrix={handleParityCheckMatrix}
      onChangeColor={handleChangeColor}
      onPullOutSameColor={handlePullOutSameColor}
      onBiAlgebra={handleBiAlgebra}
      onInverseBiAlgebra={handleInverseBiAlgebra}
      onUnfuseToLegs={handleUnfuseToLegs}
      onUnfuseToTwo={handleUnfuseToTwo}
      onCompleteGraph={handleCompleteGraph}
      onConnectViaCentral={handleConnectViaCentral}
      onRemoveFromCache={handleRemoveFromCache}
      onRemoveHighlights={handleRemoveHighlights}
      isUserLoggedIn={isUserLoggedIn}
    />
  );
};
