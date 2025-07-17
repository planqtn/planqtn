import React, { useState } from "react";
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
  Input,
  useToast,
  Icon,
  Box,
  Divider,
  Alert,
  AlertIcon,
  AlertTitle,
  AlertDescription
} from "@chakra-ui/react";
import { FiCopy, FiDownload, FiShare2, FiAlertTriangle } from "react-icons/fi";
import { useCanvasStore } from "../../stores/canvasStateStore";
import * as LZString from "lz-string";

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
}

// Node.js default max header size is 8KB
const MAX_URL_LENGTH = 8192;

export const ShareModal: React.FC<ShareModalProps> = ({ isOpen, onClose }) => {
  const [shareUrl, setShareUrl] = useState<string>("");
  const [isGenerating, setIsGenerating] = useState(false);
  const toast = useToast();

  const canvasStateSerializer = useCanvasStore(
    (state) => state.canvasStateSerializer
  );
  const title = useCanvasStore((state) => state.title);

  // Create a sharing-specific serialization that excludes canvasId and uses compression
  const getEncodedCanvasStateForSharing = () => {
    const store = useCanvasStore.getState();
    const serialized = canvasStateSerializer.toSerializableCanvasState(store);

    // Remove canvasId from the serialized state for sharing
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { canvasId, ...sharingState } = serialized;

    // First stringify the state
    const jsonString = JSON.stringify(sharingState);

    // Then compress it using lz-string
    const compressed = LZString.compressToEncodedURIComponent(jsonString);

    return compressed;
  };

  const generateShareUrl = async () => {
    setIsGenerating(true);
    try {
      const encodedState = getEncodedCanvasStateForSharing();
      const currentUrl = new URL(window.location.href);
      currentUrl.searchParams.set("state", encodedState);
      const newShareUrl = currentUrl.toString();
      setShareUrl(newShareUrl);

      toast({
        title: "Share URL Generated",
        description: "The share URL has been generated successfully",
        status: "success",
        duration: 3000,
        isClosable: true
      });
    } catch {
      toast({
        title: "Error",
        description: "Failed to generate share URL",
        status: "error",
        duration: 5000,
        isClosable: true
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const copyShareUrl = async () => {
    if (!shareUrl) {
      await generateShareUrl();
      return;
    }

    try {
      await navigator.clipboard.writeText(shareUrl);
      toast({
        title: "Copied to Clipboard",
        description: "Share URL has been copied to your clipboard",
        status: "success",
        duration: 3000,
        isClosable: true
      });
    } catch {
      toast({
        title: "Copy Failed",
        description: "Failed to copy URL to clipboard",
        status: "error",
        duration: 3000,
        isClosable: true
      });
    }
  };

  const downloadCanvasJson = () => {
    try {
      const canvasStore = useCanvasStore.getState();
      const serializedState =
        canvasStateSerializer.toSerializableCanvasState(canvasStore);
      const jsonString = JSON.stringify(serializedState, null, 2);

      const blob = new Blob([jsonString], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${title || "canvas-state"}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({
        title: "Download Started",
        description: "Canvas JSON file is being downloaded",
        status: "success",
        duration: 3000,
        isClosable: true
      });
    } catch {
      toast({
        title: "Download Failed",
        description: "Failed to download canvas JSON",
        status: "error",
        duration: 5000,
        isClosable: true
      });
    }
  };

  // Reset shareUrl when modal closes
  React.useEffect(() => {
    if (!isOpen) {
      setShareUrl("");
    }
  }, [isOpen]);

  const urlLength = shareUrl.length;
  const isUrlTooLong = urlLength > MAX_URL_LENGTH;
  const urlLengthPercent = (urlLength / MAX_URL_LENGTH) * 100;

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="lg">
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>
          <HStack>
            <Icon as={FiShare2} />
            <Text>Share Canvas</Text>
          </HStack>
        </ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <VStack spacing={6} align="stretch">
            {/* Share URL Section */}
            <Box>
              <Text fontSize="md" fontWeight="semibold" mb={3}>
                Share Long URL
              </Text>
              <Text fontSize="sm" color="gray.600" mb={3}>
                Generate a compressed URL that contains your entire canvas
                state. Anyone with this link can view your canvas.
              </Text>

              {/* URL Length Warning */}
              {isUrlTooLong && (
                <Alert status="warning" mb={3}>
                  <AlertIcon />
                  <Box>
                    <AlertTitle>URL Too Long!</AlertTitle>
                    <AlertDescription>
                      The URL is {formatBytes(urlLength)} which exceeds the
                      maximum header size limit of {formatBytes(MAX_URL_LENGTH)}
                      . This may cause issues with some servers. Consider using
                      JSON download instead.
                    </AlertDescription>
                  </Box>
                </Alert>
              )}

              <HStack spacing={2}>
                <Input
                  value={shareUrl}
                  placeholder={
                    isGenerating
                      ? "Generating..."
                      : "Click Copy to generate and copy share URL"
                  }
                  isReadOnly
                  size="sm"
                />
                <Button
                  size="sm"
                  onClick={copyShareUrl}
                  leftIcon={
                    <Icon as={isUrlTooLong ? FiAlertTriangle : FiCopy} />
                  }
                  colorScheme={isUrlTooLong ? "orange" : "blue"}
                  isLoading={isGenerating}
                  loadingText="Generating"
                  isDisabled={isUrlTooLong}
                >
                  {isUrlTooLong ? "Too Long" : "Copy"}
                </Button>
              </HStack>

              {/* URL Length Display */}
              {shareUrl && (
                <Box mt={2}>
                  <Text fontSize="xs" color="gray.500">
                    URL Length: {formatBytes(urlLength)} /{" "}
                    {formatBytes(MAX_URL_LENGTH)} ({urlLengthPercent.toFixed(1)}
                    %)
                  </Text>
                  <Box
                    width="100%"
                    height="2px"
                    bg="gray.200"
                    borderRadius="1px"
                    mt={1}
                  >
                    <Box
                      width={`${Math.min(urlLengthPercent, 100)}%`}
                      height="100%"
                      bg={
                        isUrlTooLong
                          ? "orange.400"
                          : urlLengthPercent > 80
                            ? "yellow.400"
                            : "green.400"
                      }
                      borderRadius="1px"
                      transition="all 0.3s ease"
                    />
                  </Box>
                </Box>
              )}
            </Box>

            <Divider />

            {/* Download JSON Section */}
            <Box>
              <Text fontSize="md" fontWeight="semibold" mb={3}>
                Download Canvas JSON
              </Text>
              <Text fontSize="sm" color="gray.600" mb={3}>
                Download the raw JSON representation of your canvas state for
                backup or programmatic use.
              </Text>
              <Button
                onClick={downloadCanvasJson}
                leftIcon={<Icon as={FiDownload} />}
                colorScheme="green"
                variant="outline"
                size="sm"
              >
                Download JSON
              </Button>
            </Box>
          </VStack>
        </ModalBody>
        <ModalFooter>
          <Button variant="ghost" onClick={onClose}>
            Close
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};
