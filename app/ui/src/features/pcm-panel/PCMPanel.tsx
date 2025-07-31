import React, { useMemo } from "react";
import { Box, useColorModeValue } from "@chakra-ui/react";
import { ParityCheckMatrixDisplay } from "../details-panel/ParityCheckMatrixDisplay";
import { ParityCheckMatrix } from "../../stores/tensorNetworkStore";
import { useCanvasStore } from "../../stores/canvasStateStore";

interface PCMPanelProps {
  networkSignature: string;
  parityCheckMatrix: ParityCheckMatrix;
  networkName: string;
  isSingleLego?: boolean;
  singleLegoInstanceId?: string;
}

const PCMPanel: React.FC<PCMPanelProps> = ({
  parityCheckMatrix,
  networkName,
  networkSignature,
  isSingleLego = false,
  singleLegoInstanceId
}) => {
  if (!parityCheckMatrix) {
    return null;
  }

  const bgColor = useColorModeValue("white", "gray.800");
  const droppedLegos = useCanvasStore((state) => state.droppedLegos);
  const cachedTensorNetworks = useCanvasStore(
    (state) => state.cachedTensorNetworks
  );

  const highlightCachedTensorNetworkLegs = useCanvasStore(
    (state) => state.highlightCachedTensorNetworkLegs
  );
  const handleSingleLegoMatrixChange = useCanvasStore(
    (state) => state.handleSingleLegoMatrixChange
  );
  const handleSingleLegoMatrixRowSelection = useCanvasStore(
    (state) => state.handleSingleLegoMatrixRowSelection
  );
  const handleMultiLegoMatrixChange = useCanvasStore(
    (state) => state.handleMultiLegoMatrixChange
  );
  const selectedTensorNetworkParityCheckMatrixRows = useCanvasStore(
    (state) => state.selectedTensorNetworkParityCheckMatrixRows
  );

  // Check if the tensor network is inactive
  const isDisabled = useMemo(() => {
    if (isSingleLego && singleLegoInstanceId) {
      // For single lego, check if the lego still exists on the canvas
      return !droppedLegos.some(
        (lego) => lego.instance_id === singleLegoInstanceId
      );
    } else {
      // For multi-lego networks, check if the cached tensor network is inactive
      const cachedNetwork = cachedTensorNetworks[networkSignature];
      return cachedNetwork ? !cachedNetwork.isActive : true;
    }
  }, [
    isSingleLego,
    singleLegoInstanceId,
    droppedLegos,
    networkSignature,
    cachedTensorNetworks
  ]);

  // Handle matrix changes for single legos
  const handleMatrixChange = (newMatrix: number[][]) => {
    if (isDisabled) return;

    if (isSingleLego && singleLegoInstanceId) {
      const legoToUpdate = droppedLegos.find(
        (lego) => lego.instance_id === singleLegoInstanceId
      );
      if (legoToUpdate) {
        handleSingleLegoMatrixChange(legoToUpdate, newMatrix);
      }
      return;
    }

    if (networkSignature) {
      handleMultiLegoMatrixChange(networkSignature, newMatrix);
    }
  };

  const selectedRows = useMemo(() => {
    if (isSingleLego && singleLegoInstanceId) {
      return (
        droppedLegos.find((lego) => lego.instance_id === singleLegoInstanceId)
          ?.selectedMatrixRows || []
      );
    }
    if (networkSignature) {
      return selectedTensorNetworkParityCheckMatrixRows[networkSignature] || [];
    }

    return [];
  }, [
    isSingleLego,
    singleLegoInstanceId,
    droppedLegos,
    selectedTensorNetworkParityCheckMatrixRows
  ]);

  // Handle row selection changes for single legos
  const handleRowSelectionChange = (selectedRows: number[]) => {
    if (isDisabled) return;

    if (isSingleLego && singleLegoInstanceId) {
      const legoToUpdate = droppedLegos.find(
        (lego) => lego.instance_id === singleLegoInstanceId
      );
      if (legoToUpdate) {
        handleSingleLegoMatrixRowSelection(legoToUpdate, selectedRows);
      }
    } else {
      // For multi-lego networks, use the existing behavior
      highlightCachedTensorNetworkLegs(networkSignature, selectedRows);
    }
  };

  return (
    <Box h="100%" w="100%" bg={bgColor} overflowY="auto">
      <ParityCheckMatrixDisplay
        matrix={parityCheckMatrix.matrix}
        title={`PCM for ${networkName}`}
        legOrdering={parityCheckMatrix.legOrdering}
        signature={networkSignature}
        onMatrixChange={handleMatrixChange}
        selectedRows={selectedRows}
        onRowSelectionChange={handleRowSelectionChange}
        isDisabled={isDisabled}
      />
    </Box>
  );
};

export default PCMPanel;
