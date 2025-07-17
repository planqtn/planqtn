import React, { useState, useCallback } from "react";
import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalFooter,
  ModalBody,
  ModalCloseButton,
  Button,
  VStack,
  HStack,
  Text,
  Icon,
  Box,
  useToast,
  Alert,
  AlertIcon,
  AlertTitle,
  AlertDescription
} from "@chakra-ui/react";
import { FiUpload, FiFile, FiCheckCircle } from "react-icons/fi";
import { validateCanvasStateString } from "../../schemas/v1/canvas-state-validator";

interface ImportCanvasModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ImportCanvasModal: React.FC<ImportCanvasModalProps> = ({
  isOpen,
  onClose
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const toast = useToast();

  const handleFileSelect = useCallback((selectedFile: File) => {
    if (
      selectedFile.type !== "application/json" &&
      !selectedFile.name.endsWith(".json")
    ) {
      setError("Please select a JSON file");
      return;
    }

    setFile(selectedFile);
    setError(null);
  }, []);

  const handleFileInputChange = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) {
      handleFileSelect(selectedFile);
    }
  };

  const handleDrop = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      setIsDragOver(false);

      const droppedFile = event.dataTransfer.files[0];
      if (droppedFile) {
        handleFileSelect(droppedFile);
      }
    },
    [handleFileSelect]
  );

  const handleDragOver = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      setIsDragOver(true);
    },
    []
  );

  const handleDragLeave = useCallback(() => {
    setIsDragOver(false);
  }, []);

  const generateNewCanvasId = (): string => {
    return crypto.randomUUID();
  };

  const handleImport = async () => {
    if (!file) return;

    setIsLoading(true);
    setError(null);

    try {
      const fileContent = await file.text();

      // Validate the JSON structure
      const validationResult = validateCanvasStateString(fileContent);
      if (!validationResult.isValid) {
        throw new Error(
          `Invalid canvas state format: ${validationResult.errors?.join(", ")}`
        );
      }

      // Generate a new canvas ID for the imported canvas
      const newCanvasId = generateNewCanvasId();

      // Parse and modify the canvas state to have a new ID
      const canvasState = JSON.parse(fileContent);
      canvasState.canvasId = newCanvasId;

      // Serialize the state for local storage
      const serializedState = JSON.stringify({
        state: {
          jsonState: JSON.stringify(canvasState),
          _timestamp: Date.now()
        }
      });

      // Save to local storage with the new canvas ID
      const storageKey = `canvas-state-${newCanvasId}`;
      localStorage.setItem(storageKey, serializedState);
      localStorage.setItem(storageKey + "-backup", serializedState);
      console.log("Imported canvas state to local storage", storageKey);

      // Open new tab with the imported canvas
      const currentUrl = new URL(window.location.href);
      currentUrl.searchParams.set("canvasId", newCanvasId);
      window.open(currentUrl.toString(), "_blank");

      toast({
        title: "Canvas Imported Successfully",
        description: `"${canvasState.title || "Untitled Canvas"}" has been imported and opened in a new tab`,
        status: "success",
        duration: 5000,
        isClosable: true
      });

      // Close the modal and reset state
      onClose();
      setFile(null);
      setError(null);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to import canvas";
      setError(errorMessage);
      toast({
        title: "Import Failed",
        description: errorMessage,
        status: "error",
        duration: 5000,
        isClosable: true
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    setFile(null);
    setError(null);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleCancel} size="lg">
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>
          <HStack>
            <Icon as={FiUpload} />
            <Text>Import Canvas from JSON</Text>
          </HStack>
        </ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <VStack spacing={6} align="stretch">
            <Text fontSize="sm" color="gray.600">
              Import a canvas from a JSON file that was previously exported or
              downloaded. This will create a new canvas and open it in a new
              tab.
            </Text>

            {error && (
              <Alert status="error">
                <AlertIcon />
                <Box>
                  <AlertTitle>Import Error</AlertTitle>
                  <AlertDescription>{error}</AlertDescription>
                </Box>
              </Alert>
            )}

            {/* File Drop Area */}
            <Box
              border="2px dashed"
              borderColor={isDragOver ? "blue.400" : "gray.300"}
              borderRadius="md"
              p={8}
              textAlign="center"
              bg={isDragOver ? "blue.50" : "gray.50"}
              transition="all 0.2s"
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              cursor="pointer"
              _hover={{ borderColor: "blue.400", bg: "blue.50" }}
              onClick={() => document.getElementById("file-input")?.click()}
            >
              <VStack spacing={4}>
                <Icon
                  as={file ? FiCheckCircle : FiFile}
                  boxSize={12}
                  color={file ? "green.500" : "gray.400"}
                />
                {file ? (
                  <VStack spacing={2}>
                    <Text fontWeight="medium" color="green.600">
                      {file.name}
                    </Text>
                    <Text fontSize="sm" color="gray.600">
                      {(file.size / 1024).toFixed(1)} KB
                    </Text>
                  </VStack>
                ) : (
                  <VStack spacing={2}>
                    <Text fontWeight="medium">
                      Drop your JSON file here or click to browse
                    </Text>
                    <Text fontSize="sm" color="gray.600">
                      Supports .json files exported from PlanqTN
                    </Text>
                  </VStack>
                )}
              </VStack>
            </Box>

            {/* Hidden File Input */}
            <input
              id="file-input"
              type="file"
              accept=".json,application/json"
              onChange={handleFileInputChange}
              style={{ display: "none" }}
            />
          </VStack>
        </ModalBody>
        <ModalFooter>
          <HStack spacing={3}>
            <Button variant="ghost" onClick={handleCancel}>
              Cancel
            </Button>
            <Button
              colorScheme="blue"
              onClick={handleImport}
              isLoading={isLoading}
              loadingText="Importing..."
              isDisabled={!file}
            >
              Import & Open New Tab
            </Button>
          </HStack>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};
