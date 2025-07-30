import React from "react";
import { Box, useColorModeValue } from "@chakra-ui/react";
import { ParityCheckMatrixDisplay } from "../details-panel/ParityCheckMatrixDisplay";
import { ParityCheckMatrix } from "../../stores/tensorNetworkStore";

interface PCMPanelProps {
  networkSignature: string;
  parityCheckMatrix: ParityCheckMatrix;
  networkName: string;
}

const PCMPanel: React.FC<PCMPanelProps> = ({
  parityCheckMatrix,
  networkName,
  networkSignature
}) => {
  if (!parityCheckMatrix) {
    return null;
  }
  const bgColor = useColorModeValue("white", "gray.800");

  return (
    <Box h="100%" w="100%" bg={bgColor} overflowY="auto">
      <ParityCheckMatrixDisplay
        matrix={parityCheckMatrix.matrix}
        title={`PCM for ${networkName}`}
        legOrdering={parityCheckMatrix.legOrdering}
        signature={networkSignature}
      />
    </Box>
  );
};

export default PCMPanel;
