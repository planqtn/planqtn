import React, { useEffect } from "react";
import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalCloseButton,
  Box,
  useColorModeValue,
  IconButton,
  HStack,
  Text
} from "@chakra-ui/react";
import { ExternalLinkIcon } from "@chakra-ui/icons";

interface HelpModalProps {
  isOpen: boolean;
  onClose: () => void;
  helpUrl?: string;
  title?: string;
}

const HelpModal: React.FC<HelpModalProps> = ({
  isOpen,
  onClose,
  helpUrl = "/docs/planqtn-studio/ui-controls/#canvases-panel",
  title = "Help"
}) => {
  const bgColor = useColorModeValue("white", "gray.800");
  const borderColor = useColorModeValue("gray.200", "gray.600");
  const closeButtonHoverBg = useColorModeValue("gray.200", "gray.600");

  // Handle ESC key to close modal even when iframe is focused
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };

    // Add event listener to document to catch ESC key regardless of focus
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  const handleExternalLink = () => {
    window.open(helpUrl, "_blank");
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="6xl">
      <ModalOverlay />
      <ModalContent
        maxW="90vw"
        maxH="90vh"
        bg={bgColor}
        border="1px"
        borderColor={borderColor}
        borderRadius="lg"
        boxShadow="xl"
      >
        <ModalHeader>
          <HStack spacing={2} align="center">
            <Text>{title}</Text>
            <IconButton
              aria-label="Open in new tab"
              icon={<ExternalLinkIcon />}
              size="sm"
              variant="ghost"
              onClick={handleExternalLink}
              _hover={{ bg: closeButtonHoverBg }}
            />
          </HStack>
        </ModalHeader>
        <ModalCloseButton />
        <Box p={0} height="calc(90vh - 120px)" width="100%" overflow="hidden">
          <iframe
            src={helpUrl}
            style={{
              width: "100%",
              height: "100%",
              border: "none",
              borderRadius: "0 0 8px 8px"
            }}
            title="Documentation"
          />
        </Box>
      </ModalContent>
    </Modal>
  );
};

export default HelpModal;
