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
  Code,
  HStack,
  Icon,
  IconButton
} from "@chakra-ui/react";
import { useState, useEffect } from "react";
import { FiCopy } from "react-icons/fi";
import { QuestionIcon } from "@chakra-ui/icons";
import { useCanvasStore } from "../../stores/canvasStateStore";

interface RuntimeConfigDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (config: Record<string, string>) => void;
  isLocal: boolean;
  initialConfig?: Record<string, string>;
}

export const RuntimeConfigDialog: React.FC<RuntimeConfigDialogProps> = ({
  isOpen,
  onClose,
  onSubmit,
  isLocal,
  initialConfig
}) => {
  const [configText, setConfigText] = useState("");
  const [error, setError] = useState("");
  const toast = useToast();
  const openHelpDialog = useCanvasStore((state) => state.openHelpDialog);

  // Prefill with initial config when dialog opens
  useEffect(() => {
    if (isOpen && initialConfig) {
      setConfigText(JSON.stringify(initialConfig, null, 2));
    } else if (isOpen && !initialConfig) {
      setConfigText("");
    }
  }, [isOpen, initialConfig]);

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
        isClosable: true
      });
    }
  };

  const handleCopyCommand = async () => {
    try {
      await navigator.clipboard.writeText("htn kernel status");
      toast({
        title: "Copied!",
        description: "Command copied to clipboard",
        status: "success",
        duration: 2000,
        isClosable: true
      });
    } catch {
      toast({
        title: "Copy failed",
        description: "Failed to copy command to clipboard",
        status: "error",
        duration: 2000,
        isClosable: true
      });
    }
  };

  const handleHelpClick = () => {
    openHelpDialog(
      "/docs/planqtn-studio/runtimes/#local-runtime",
      "Local Runtime Help"
    );
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="xl">
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>
          <HStack spacing={2} align="center">
            <Text>
              {isLocal ? "Switch to Cloud Runtime" : "Switch to Local Runtime"}
            </Text>
            <IconButton
              aria-label="Help"
              icon={<QuestionIcon />}
              size="sm"
              variant="ghost"
              onClick={handleHelpClick}
            />
          </HStack>
        </ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <VStack spacing={4}>
            <Text>
              {isLocal
                ? "Clear the configuration below to switch to cloud runtime:"
                : "Paste the output of the following command to switch to local runtime:"}
            </Text>
            <HStack spacing={2}>
              <Code>htn kernel status</Code>
              <Button
                size="sm"
                variant="ghost"
                onClick={handleCopyCommand}
                leftIcon={<Icon as={FiCopy} />}
              >
                Copy
              </Button>
            </HStack>
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
