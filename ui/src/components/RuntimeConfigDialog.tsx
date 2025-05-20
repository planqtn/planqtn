import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalFooter,
  ModalBody,
  ModalCloseButton,
  Button,
  Textarea,
  Text,
  VStack,
  useToast,
  Alert,
  AlertIcon,
} from "@chakra-ui/react";
import { useState } from "react";

interface RuntimeConfigDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (config: Record<string, string>) => void;
  isLocal: boolean;
}

export const RuntimeConfigDialog: React.FC<RuntimeConfigDialogProps> = ({
  isOpen,
  onClose,
  onSubmit,
  isLocal,
}) => {
  const [configText, setConfigText] = useState("");
  const [error, setError] = useState("");
  const toast = useToast();

  const handleSubmit = () => {
    try {
      const config = JSON.parse(configText);
      onSubmit(config);
      onClose();
    } catch (err) {
      console.error(err);
      setError("Invalid JSON configuration: " + err);
      toast({
        title: "Error",
        description: "Please provide valid JSON configuration",
        status: "error",
        duration: 3000,
        isClosable: true,
      });
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="xl">
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>
          {isLocal ? "Switch to Cloud Runtime" : "Switch to Local Runtime"}
        </ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <VStack spacing={4}>
            <Alert status="warning">
              <AlertIcon />
              <Text>
                Warning: Changing runtime configuration will sign you out and
                may cause you to lose unsaved work. Are you sure you want to
                continue?
              </Text>
            </Alert>
            <Text>
              {isLocal
                ? "Paste the output of 'supabase status -o json' to switch to local runtime:"
                : "Paste the output of 'supabase status -o json' to switch to cloud runtime:"}
            </Text>
            <Textarea
              value={configText}
              onChange={(e) => {
                setConfigText(e.target.value);
                setError("");
              }}
              onKeyDown={(e) => {
                e.stopPropagation();
                if (e.key === "Enter" && e.shiftKey) {
                  handleSubmit();
                }
              }}
              placeholder="Paste JSON configuration here..."
              height="200px"
              fontFamily="monospace"
            />
            {error && <Text color="red.500">{error}</Text>}
          </VStack>
        </ModalBody>
        <ModalFooter>
          <Button variant="ghost" mr={3} onClick={onClose}>
            Cancel
          </Button>
          <Button colorScheme="blue" onClick={handleSubmit}>
            {isLocal ? "Switch to Cloud" : "Switch to Local"}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};
