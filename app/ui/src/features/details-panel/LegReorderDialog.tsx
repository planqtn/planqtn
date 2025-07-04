import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  ModalCloseButton,
  Button,
  VStack,
  HStack,
  Text,
  Box,
  IconButton,
  useToast
} from "@chakra-ui/react";
import { useState } from "react";
import { FaArrowUp, FaArrowDown } from "react-icons/fa";
import { TensorNetworkLeg } from "../../lib/TensorNetwork";

interface LegReorderDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (newLegOrdering: TensorNetworkLeg[]) => void;
  legOrdering: TensorNetworkLeg[];
}

export const LegReorderDialog: React.FC<LegReorderDialogProps> = ({
  isOpen,
  onClose,
  onSubmit,
  legOrdering
}) => {
  const [currentOrdering, setCurrentOrdering] = useState<TensorNetworkLeg[]>([
    ...legOrdering
  ]);
  const toast = useToast();

  const moveLeg = (fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex) return;

    const newOrdering = [...currentOrdering];
    const [movedLeg] = newOrdering.splice(fromIndex, 1);
    newOrdering.splice(toIndex, 0, movedLeg);
    setCurrentOrdering(newOrdering);
  };

  const handleSubmit = () => {
    onSubmit(currentOrdering);
    toast({
      title: "Legs reordered",
      description: "The leg ordering has been updated",
      status: "success",
      duration: 2000,
      isClosable: true
    });
    onClose();
  };

  const handleClose = () => {
    setCurrentOrdering([...legOrdering]); // Reset to original ordering
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} size="md">
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>Reorder Legs</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <VStack spacing={4} align="stretch">
            <Text>
              Drag and drop or use the arrow buttons to reorder the legs. The
              order will affect how the X and Z components are arranged in the
              parity check matrix.
            </Text>
            <VStack spacing={2} align="stretch">
              {currentOrdering.map((leg, index) => (
                <HStack
                  key={index}
                  justify="space-between"
                  p={3}
                  border="1px"
                  borderColor="gray.200"
                  borderRadius="md"
                  bg="white"
                  _hover={{ bg: "gray.50" }}
                >
                  <Box flex={1}>
                    <Text fontWeight="bold">Leg {index}</Text>
                    <Text fontSize="sm" color="gray.600">
                      {leg.instanceId}:{leg.legIndex}
                    </Text>
                  </Box>
                  <HStack spacing={1}>
                    <IconButton
                      size="sm"
                      icon={<FaArrowUp />}
                      aria-label="Move up"
                      onClick={() => moveLeg(index, Math.max(0, index - 1))}
                      isDisabled={index === 0}
                    />
                    <IconButton
                      size="sm"
                      icon={<FaArrowDown />}
                      aria-label="Move down"
                      onClick={() =>
                        moveLeg(
                          index,
                          Math.min(currentOrdering.length - 1, index + 1)
                        )
                      }
                      isDisabled={index === currentOrdering.length - 1}
                    />
                  </HStack>
                </HStack>
              ))}
            </VStack>
          </VStack>
        </ModalBody>
        <ModalFooter>
          <Button variant="ghost" mr={3} onClick={handleClose}>
            Cancel
          </Button>
          <Button colorScheme="blue" onClick={handleSubmit}>
            Apply Reordering
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};
