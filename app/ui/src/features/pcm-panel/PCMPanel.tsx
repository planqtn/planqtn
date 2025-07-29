import React from "react";
import { Box, Text, VStack, useColorModeValue } from "@chakra-ui/react";
import { ParityCheckMatrixDisplay } from "../details-panel/ParityCheckMatrixDisplay";
import { ParityCheckMatrix } from "../../stores/tensorNetworkStore";

interface PCMPanelProps {
  networkSignature: string;
  parityCheckMatrix: ParityCheckMatrix;
  networkName: string;
}

const PCMPanel: React.FC<PCMPanelProps> = ({
  parityCheckMatrix,
  networkName
}) => {
  if (!parityCheckMatrix) {
    return null;
  }
  const bgColor = useColorModeValue("white", "gray.800");
  const borderColor = useColorModeValue("gray.200", "gray.600");

  return (
    <Box h="100%" bg={bgColor} overflowY="auto">
      <VStack align="stretch" spacing={0}>
        <Box p={3} borderBottom="1px" borderColor={borderColor}>
          <Text fontWeight="bold" fontSize="sm">
            Parity Check Matrix
          </Text>
          <Text fontSize="xs" color="gray.500">
            {networkName}
          </Text>
        </Box>
        <Box flex={1} p={2}>
          <ParityCheckMatrixDisplay
            matrix={parityCheckMatrix.matrix}
            title={`PCM for ${networkName}`}
            legOrdering={parityCheckMatrix.legOrdering}
          />
        </Box>
      </VStack>
    </Box>
  );
};

export default PCMPanel;
