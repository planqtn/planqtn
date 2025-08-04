import React, { useMemo } from "react";
import { useCanvasStore } from "../../stores/canvasStateStore";
import { usePanelConfigStore } from "../../stores/panelConfigStore";
import { useUserStore } from "../../stores/userStore";
import { SubnetToolbar } from "./SubnetToolbar";
import { DraggingStage } from "../../stores/legoDragState";
import { calculateBoundingBoxForLegos } from "../../stores/canvasUISlice";

export const SubnetToolbarOverlay: React.FC = () => {
  const { isUserLoggedIn } = useUserStore();

  const tensorNetwork = useCanvasStore((state) => state.tensorNetwork);
  const showToolbar = usePanelConfigStore((state) => state.showToolbar);
  const calculateTensorNetworkBoundingBox = useCanvasStore(
    (state) => state.calculateTensorNetworkBoundingBox
  );
  const viewport = useCanvasStore((state) => state.viewport);

  // Get the same bounding box logic as LegosLayer
  const legoDragState = useCanvasStore((state) => state.legoDragState);
  const groupDragState = useCanvasStore((state) => state.groupDragState);
  const droppedLegos = useCanvasStore((state) => state.droppedLegos);
  const resizeProxyLegos = useCanvasStore((state) => state.resizeProxyLegos);

  // Calculate bounding box for the current tensor network
  const tnBoundingBoxLogical =
    tensorNetwork && tensorNetwork.legos.length > 0
      ? calculateTensorNetworkBoundingBox(tensorNetwork)
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
  const mousePos = useCanvasStore((state) => state.mousePos);

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

  const handleMatrixRowSelectionForSelectedTensorNetwork = useCanvasStore(
    (state) => state.handleMatrixRowSelectionForSelectedTensorNetwork
  );
  const handleSingleLegoMatrixRowSelection = useCanvasStore(
    (state) => state.handleSingleLegoMatrixRowSelection
  );

  const parityCheckMatrices = useCanvasStore(
    (state) => state.parityCheckMatrices
  );

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

  // Only render if we have a tensor network, bounding box, and toolbar is enabled
  if (!tensorNetwork || !constrainedBoundingBox || !showToolbar) {
    return null;
  }

  return (
    <SubnetToolbar
      boundingBox={constrainedBoundingBox}
      onRemoveHighlights={handleRemoveHighlights}
      isUserLoggedIn={isUserLoggedIn}
    />
  );
};
