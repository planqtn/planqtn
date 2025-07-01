import React from "react";
import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalFooter,
  ModalBody,
  ModalCloseButton,
  Button,
  Box,
  Text,
  useToast,
  HStack,
  useColorModeValue
} from "@chakra-ui/react";
import { FaCopy, FaDownload } from "react-icons/fa";

interface PythonCodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  code: string;
  title?: string;
}

export const PythonCodeModal: React.FC<PythonCodeModalProps> = ({
  isOpen,
  onClose,
  code,
  title = "Python Code"
}) => {
  const toast = useToast();
  const bgColor = useColorModeValue("gray.50", "gray.900");
  const borderColor = useColorModeValue("gray.200", "gray.600");

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    toast({
      title: "Copied to clipboard",
      description: "Python code has been copied to clipboard.",
      status: "success",
      duration: 2000,
      isClosable: true
    });
  };

  const handleDownload = () => {
    const blob = new Blob([code], { type: "text/python" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "tensor_network_construction.py";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast({
      title: "Downloaded",
      description: "Python code has been downloaded as a file.",
      status: "success",
      duration: 2000,
      isClosable: true
    });
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="6xl">
      <ModalOverlay />
      <ModalContent maxH="90vh">
        <ModalHeader>{title}</ModalHeader>
        <ModalCloseButton />
        <ModalBody>
          <Box
            bg={bgColor}
            border="1px"
            borderColor={borderColor}
            borderRadius="md"
            p={4}
            maxH="60vh"
            overflowY="auto"
          >
            <Text
              as="pre"
              fontSize="sm"
              fontFamily="Monaco, Menlo, 'Ubuntu Mono', monospace"
              whiteSpace="pre-wrap"
              wordBreak="break-word"
            >
              {code}
            </Text>
          </Box>
        </ModalBody>
        <ModalFooter>
          <HStack spacing={3}>
            <Button
              leftIcon={<FaCopy />}
              variant="outline"
              onClick={handleCopy}
            >
              Copy
            </Button>
            <Button
              leftIcon={<FaDownload />}
              variant="outline"
              onClick={handleDownload}
            >
              Download
            </Button>
            <Button colorScheme="blue" onClick={onClose}>
              Close
            </Button>
          </HStack>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};

export default PythonCodeModal;
