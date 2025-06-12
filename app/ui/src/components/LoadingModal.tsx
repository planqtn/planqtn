import {
  Modal,
  ModalOverlay,
  ModalContent,
  VStack,
  Text,
  Spinner
} from "@chakra-ui/react";

interface LoadingModalProps {
  isOpen: boolean;
  message: string;
}

const LoadingModal: React.FC<LoadingModalProps> = ({ isOpen, message }) => {
  return (
    <Modal
      isOpen={isOpen}
      onClose={() => {}}
      closeOnOverlayClick={false}
      isCentered
    >
      <ModalOverlay />
      <ModalContent p={6} maxW="sm">
        <VStack spacing={4}>
          <Spinner size="xl" color="blue.500" thickness="4px" />
          <Text textAlign="center">{message}</Text>
        </VStack>
      </ModalContent>
    </Modal>
  );
};

export default LoadingModal;
