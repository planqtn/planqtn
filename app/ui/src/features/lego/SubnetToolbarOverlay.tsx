import React from "react";
import { useCanvasStore } from "../../stores/canvasStateStore";
import { usePanelConfigStore } from "../../stores/panelConfigStore";
import { useUserStore } from "../../stores/userStore";
import { SubnetToolbar } from "./SubnetToolbar";

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

  // Calculate bounding box for the current tensor network
  const tnBoundingBoxLogical =
    tensorNetwork && tensorNetwork.legos.length > 0
      ? calculateTensorNetworkBoundingBox()
      : null;
  const boundingBox = tnBoundingBoxLogical
    ? viewport.fromLogicalToCanvasBB(tnBoundingBoxLogical)
    : null;

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
    await calculateParityCheckMatrix((networkSignature, networkName) => {
      // Open PCM panel after successful calculation
      openPCMPanel(networkSignature, networkName);
    });
  };

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
    console.log("Remove highlights");
  };

  // Only render if we have a tensor network and bounding box
  if (!tensorNetwork || !boundingBox) {
    return null;
  }

  return (
    <SubnetToolbar
      boundingBox={boundingBox}
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
