import {
  Box,
  VStack,
  Button,
  Text,
  useColorModeValue,
  Center
} from "@chakra-ui/react";
import { ParityCheckMatrixDisplay } from "./ParityCheckMatrixDisplay";
import { TensorNetwork } from "@/lib/TensorNetwork";
import { DroppedLego } from "@/stores/droppedLegoStore";

interface ParityCheckMatrixProps {
  tensorNetwork: TensorNetwork | null;
  lego: DroppedLego | null;
  isSingleLego: boolean;
  parityCheckMatrix: any;
  selectedRows: number[];
  singleLegoLegOrdering: Array<{ instance_id: string; leg_index: number }>;
  onCalculatePCM: () => void;
  onRowSelectionChange: (rows: number[]) => void;
  onMatrixChange: (matrix: number[][]) => void;
  onRecalculate?: () => void;
  signature?: string;
}

const ParityCheckMatrix: React.FC<ParityCheckMatrixProps> = ({
  tensorNetwork,
  lego,
  isSingleLego,
  parityCheckMatrix,
  selectedRows,
  singleLegoLegOrdering,
  onCalculatePCM,
  onRowSelectionChange,
  onMatrixChange,
  onRecalculate,
  signature
}) => {
  const bgColor = useColorModeValue("white", "gray.800");

  // If no tensor network is selected, don't render anything
  if (!tensorNetwork) {
    return null;
  }

  // For single lego case
  if (isSingleLego && lego) {
    return (
      <VStack align="stretch" spacing={3} p={0}>
        <Box
          p={0}
          borderWidth={0}
          borderRadius="lg"
          bg={bgColor}
          w="100%"
          h="300px"
        >
          <ParityCheckMatrixDisplay
            matrix={lego.parity_check_matrix}
            legOrdering={singleLegoLegOrdering}
            selectedRows={selectedRows}
            onRowSelectionChange={onRowSelectionChange}
            onMatrixChange={onMatrixChange}
            title={lego.name || lego.short_name}
            lego={lego}
            popOut={true}
          />
        </Box>
      </VStack>
    );
  }

  // For multi-lego tensor network case
  if (tensorNetwork.legos.length > 1) {
    if (!parityCheckMatrix) {
      return (
        <VStack align="stretch" spacing={3} p={0}>
          <Center h="200px">
            <VStack spacing={3}>
              <Text fontSize="sm" color="gray.600" textAlign="center">
                No parity check matrix calculated yet
              </Text>
              <Button colorScheme="blue" size="sm" onClick={onCalculatePCM}>
                Calculate Parity Check Matrix
              </Button>
            </VStack>
          </Center>
        </VStack>
      );
    }

    return (
      <VStack align="stretch" spacing={3} p={0}>
        <Box
          p={0}
          m={0}
          borderWidth={0}
          borderRadius="lg"
          bg={bgColor}
          w="100%"
          h="300px"
        >
          <ParityCheckMatrixDisplay
            matrix={parityCheckMatrix.matrix}
            title={`${tensorNetwork.legos.length} Legos`}
            legOrdering={parityCheckMatrix.legOrdering}
            onMatrixChange={onMatrixChange}
            onRecalculate={onRecalculate}
            onRowSelectionChange={onRowSelectionChange}
            selectedRows={selectedRows}
            signature={signature}
            popOut={true}
          />
        </Box>
      </VStack>
    );
  }

  return null;
};

export default ParityCheckMatrix;
