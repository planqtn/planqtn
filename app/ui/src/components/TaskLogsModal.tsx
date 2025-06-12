import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalCloseButton,
  Box,
  VStack,
  Text,
  Spinner
} from "@chakra-ui/react";
import { KeyboardEvent } from "react";

interface TaskLogsModalProps {
  isOpen: boolean;
  onClose: () => void;
  isLoading: boolean;
  logs: string;
}

const TaskLogsModal: React.FC<TaskLogsModalProps> = ({
  isOpen,
  onClose,
  isLoading,
  logs
}) => {
  const handleKeyDown = (e: KeyboardEvent) => {
    // Stop propagation of keyboard events when they occur within the modal
    e.stopPropagation();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="xl" motionPreset="none">
      <ModalOverlay />
      <ModalContent
        position="relative"
        maxW="90vw"
        maxH="85vh"
        h="95vh"
        bg="white"
        borderRadius="lg"
        boxShadow="xl"
        display="flex"
        flexDirection="column"
      >
        <ModalHeader borderBottomWidth={1} pb={4}>
          Task Logs
        </ModalHeader>
        <ModalCloseButton />
        <Box p={4} flex={1} minHeight={0} display="flex" flexDirection="column">
          <Box
            as="pre"
            p={4}
            bg="gray.50"
            borderRadius="md"
            overflowX="auto"
            overflowY="auto"
            h="100%"
            w="100%"
            whiteSpace="pre-wrap"
            fontFamily="mono"
            fontSize="sm"
            border="1px solid"
            borderColor="gray.200"
            display="flex"
            alignItems="center"
            justifyContent="center"
            wordBreak="break-all"
            onKeyDown={handleKeyDown}
            tabIndex={0} // Make the pre element focusable
          >
            {isLoading ? (
              <VStack align="center" spacing={4}>
                <Spinner size="xl" color="blue.500" thickness="4px" />
                <Text>
                  Loading logs, this might take up to a couple of minutes...
                </Text>
              </VStack>
            ) : (
              logs
            )}
          </Box>
        </Box>
      </ModalContent>
    </Modal>
  );
};

export default TaskLogsModal;
