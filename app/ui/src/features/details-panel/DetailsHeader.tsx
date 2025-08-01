import {
  Box,
  VStack,
  Heading,
  Text,
  Input,
  Checkbox,
  Badge,
  HStack,
  useColorModeValue,
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td
} from "@chakra-ui/react";
import { TensorNetwork } from "@/lib/TensorNetwork";
import { CachedTensorNetwork } from "../../stores/tensorNetworkStore";
import { DroppedLego } from "@/stores/droppedLegoStore";
import { useCanvasStore } from "../../stores/canvasStateStore";

interface DetailsHeaderProps {
  tensorNetwork: TensorNetwork | null;
  lego: DroppedLego | null;
  isSingleLego: boolean;
  droppedLegosCount: number;
  cachedTensorNetwork: CachedTensorNetwork | null;
  onShortNameChange: (newShortName: string) => void;
  onAlwaysShowLegsChange: (alwaysShow: boolean) => void;
}

const DetailsHeader: React.FC<DetailsHeaderProps> = ({
  tensorNetwork,
  lego,
  isSingleLego,
  droppedLegosCount,
  cachedTensorNetwork,
  onShortNameChange,
  onAlwaysShowLegsChange
}) => {
  const bgColor = useColorModeValue("white", "gray.800");
  const borderColor = useColorModeValue("gray.200", "gray.600");
  const accentColor = useColorModeValue("blue.500", "blue.300");

  // Tensor network naming logic
  const updateCachedTensorNetworkName = useCanvasStore(
    (state) => state.updateCachedTensorNetworkName
  );
  const cachedTensorNetworks = useCanvasStore(
    (state) => state.cachedTensorNetworks
  );
  const cacheTensorNetwork = useCanvasStore(
    (state) => state.cacheTensorNetwork
  );

  const handleTensorNetworkNameChange = (newName: string) => {
    if (tensorNetwork && newName.trim()) {
      const networkSignature = tensorNetwork.signature;
      if (!(networkSignature in cachedTensorNetworks)) {
        cacheTensorNetwork({
          tensorNetwork: tensorNetwork,
          name: newName.trim(),
          isActive: true,
          svg: "<svg>render me</svg>",
          isLocked: false,
          lastUpdated: new Date()
        });
      } else {
        updateCachedTensorNetworkName(networkSignature, newName.trim());
      }
    }
  };

  if (isSingleLego && lego) {
    return (
      <VStack
        align="stretch"
        spacing={3}
        p={4}
        bg={bgColor}
        borderBottom="1px"
        borderColor={borderColor}
      >
        <VStack align="stretch" spacing={2}>
          <HStack justify="space-between" align="center">
            <Heading size="md" color={accentColor}>
              {lego.name || lego.short_name}
            </Heading>
            <Badge colorScheme="blue" variant="subtle">
              Lego
            </Badge>
          </HStack>

          <Box>
            <Text fontSize="sm" fontWeight="medium" mb={2}>
              Properties
            </Text>
            <Table size="sm" variant="simple">
              <Tbody>
                <Tr>
                  <Td fontSize="xs" py={1} px={2} fontWeight="medium">
                    Name
                  </Td>
                  <Td fontSize="xs" py={1} px={2}>
                    <Input
                      size="xs"
                      value={lego.short_name || ""}
                      onChange={(e) => onShortNameChange(e.target.value)}
                      onKeyDown={(e) => e.stopPropagation()}
                      placeholder="Enter short name..."
                    />
                  </Td>
                </Tr>
                <Tr>
                  <Td fontSize="xs" py={1} px={2} fontWeight="medium">
                    Description
                  </Td>
                  <Td fontSize="xs" py={1} px={2} fontFamily="mono">
                    {lego.description}
                  </Td>
                </Tr>
                <Tr>
                  <Td fontSize="xs" py={1} px={2} fontWeight="medium">
                    ID
                  </Td>
                  <Td fontSize="xs" py={1} px={2} fontFamily="mono">
                    {lego.instance_id}
                  </Td>
                </Tr>
                <Tr>
                  <Td fontSize="xs" py={1} px={2} fontWeight="medium">
                    Legs
                  </Td>
                  <Td fontSize="xs" py={1} px={2} fontFamily="mono">
                    {lego.numberOfLegs}
                  </Td>
                </Tr>
              </Tbody>
            </Table>
          </Box>

          <Checkbox
            isChecked={lego.alwaysShowLegs || false}
            onChange={(e) => onAlwaysShowLegsChange(e.target.checked)}
            size="sm"
          >
            Always show legs
          </Checkbox>
        </VStack>
      </VStack>
    );
  }

  if (tensorNetwork && tensorNetwork.legos.length > 1) {
    return (
      <VStack
        align="stretch"
        spacing={3}
        p={4}
        bg={bgColor}
        borderBottom="1px"
        borderColor={borderColor}
      >
        <VStack align="stretch" spacing={2}>
          <HStack justify="space-between" align="center">
            <Heading size="md" color={accentColor}>
              {cachedTensorNetwork?.name ||
                `${tensorNetwork.legos.length} Legos`}
            </Heading>
            <Badge colorScheme="green" variant="subtle">
              Network
            </Badge>
          </HStack>

          <Box>
            <Text fontSize="sm" fontWeight="medium" mb={2}>
              Properties
            </Text>
            <Table size="sm" variant="simple">
              <Tbody>
                <Tr>
                  <Td fontSize="xs" py={1} px={2} fontWeight="medium">
                    Name
                  </Td>
                  <Td fontSize="xs" py={1} px={2}>
                    <Input
                      size="xs"
                      value={cachedTensorNetwork?.name || ""}
                      onChange={(e) =>
                        handleTensorNetworkNameChange(e.target.value)
                      }
                      onKeyDown={(e) => e.stopPropagation()}
                      placeholder="Enter network name..."
                    />
                  </Td>
                </Tr>
                <Tr>
                  <Td fontSize="xs" py={1} px={2} fontWeight="medium">
                    Legos
                  </Td>
                  <Td fontSize="xs" py={1} px={2} fontFamily="mono">
                    {tensorNetwork.legos.length}
                  </Td>
                </Tr>
                <Tr>
                  <Td fontSize="xs" py={1} px={2} fontWeight="medium">
                    Connections
                  </Td>
                  <Td fontSize="xs" py={1} px={2} fontFamily="mono">
                    {tensorNetwork.connections.length}
                  </Td>
                </Tr>
              </Tbody>
            </Table>
          </Box>
        </VStack>
      </VStack>
    );
  }

  // Canvas overview case
  return (
    <VStack
      align="stretch"
      spacing={3}
      p={4}
      bg={bgColor}
      borderBottom="1px"
      borderColor={borderColor}
    >
      <VStack align="stretch" spacing={2}>
        <HStack justify="space-between" align="center">
          <Heading size="md" color={accentColor}>
            Canvas Overview
          </Heading>
          <Badge colorScheme="gray" variant="subtle">
            Overview
          </Badge>
        </HStack>

        <Text color="gray.600" fontSize="sm">
          No legos are selected. There {droppedLegosCount === 1 ? "is" : "are"}{" "}
          {droppedLegosCount} {droppedLegosCount === 1 ? "lego" : "legos"} on
          the canvas.
        </Text>
      </VStack>
    </VStack>
  );
};

export default DetailsHeader;
