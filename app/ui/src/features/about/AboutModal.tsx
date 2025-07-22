import React from "react";
import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalCloseButton,
  VStack,
  Text,
  Image,
  Link,
  HStack,
  Icon,
  useColorModeValue
} from "@chakra-ui/react";
import { FiExternalLink, FiGithub } from "react-icons/fi";
import { privacyPolicyUrl, termsOfServiceUrl } from "../../config/config";
import packageJson from "../../../package.json";

interface AboutModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AboutModal: React.FC<AboutModalProps> = ({ isOpen, onClose }) => {
  const linkColor = useColorModeValue("blue.500", "blue.300");

  return (
    <Modal isOpen={isOpen} onClose={onClose} isCentered size="md">
      <ModalOverlay />
      <ModalContent>
        <ModalHeader textAlign="center">About PlanqTN</ModalHeader>
        <ModalCloseButton />
        <ModalBody pb={6}>
          <VStack spacing={6} align="center">
            <Image
              src="/planqtn_logo.png"
              alt="PlanqTN Logo"
              maxW="200px"
              mx="auto"
            />

            <Text fontSize="lg" fontWeight="bold" textAlign="center">
              PlanqTN Studio
            </Text>

            <Text textAlign="center" color="gray.600">
              An interactive studio to create, manipulate and analyze tensor
              network based quantum error correcting codes.
            </Text>

            <Text textAlign="center" fontSize="sm" color="gray.500">
              Built with ❤️ by the PlanqTN team on{" "}
              <Link href="https://github.com/planqtn/planqtn" isExternal>
                <Icon as={FiGithub} boxSize={3} />
                Github
              </Link>
            </Text>

            <VStack spacing={3} w="full">
              <Text fontSize="sm" fontWeight="medium">
                Legal & Privacy
              </Text>

              <HStack spacing={4} justify="center">
                <Link
                  href={privacyPolicyUrl}
                  isExternal
                  color={linkColor}
                  display="flex"
                  alignItems="center"
                  gap={1}
                  fontSize="sm"
                >
                  Privacy Policy
                  <Icon as={FiExternalLink} boxSize={3} />
                </Link>

                <Link
                  href={termsOfServiceUrl}
                  isExternal
                  color={linkColor}
                  display="flex"
                  alignItems="center"
                  gap={1}
                  fontSize="sm"
                >
                  Terms of Service
                  <Icon as={FiExternalLink} boxSize={3} />
                </Link>
              </HStack>
            </VStack>

            <Text fontSize="xs" color="gray.400" textAlign="center">
              Version {packageJson.version}
            </Text>
          </VStack>
        </ModalBody>
      </ModalContent>
    </Modal>
  );
};
