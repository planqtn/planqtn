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
  const updateDroppedLego = useCanvasStore((state) => state.updateDroppedLego);
  const highlightTensorNetworkLegs = useCanvasStore(
    (state) => state.highlightTensorNetworkLegs
  );
  const handleSingleLegoMatrixChange = useCanvasStore(
    (state) => state.handleSingleLegoMatrixChange
  );

  const selectedTensorNetworkParityCheckMatrixRows = useCanvasStore(
    (state) => state.selectedTensorNetworkParityCheckMatrixRows
  );

  // Handle matrix changes for single legos
  const handleMatrixChange = (newMatrix: number[][]) => {
    if (isSingleLego && singleLegoInstanceId) {
      const legoToUpdate = droppedLegos.find(
        (lego) => lego.instance_id === singleLegoInstanceId
      );
      if (legoToUpdate) {
        handleSingleLegoMatrixChange(legoToUpdate, newMatrix);
      }
    }
  };

  const selectedRows = useMemo(() => {
    if (isSingleLego && singleLegoInstanceId) {
      console.log(
        "selectedRows",
        droppedLegos.find((lego) => lego.instance_id === singleLegoInstanceId)
          ?.selectedMatrixRows
      );
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
    if (isSingleLego && singleLegoInstanceId) {
      const legoToUpdate = droppedLegos.find(
        (lego) => lego.instance_id === singleLegoInstanceId
      );
      if (legoToUpdate) {
        const updatedLego = legoToUpdate.with({
          selectedMatrixRows: selectedRows
        });
        updateDroppedLego(singleLegoInstanceId, updatedLego);
      }
    } else {
      // For multi-lego networks, use the existing behavior
      highlightTensorNetworkLegs(selectedRows);
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
      />
    </Box>
  );
};

export default PCMPanel;
