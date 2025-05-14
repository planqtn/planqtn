import {
  Button,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  Input,
  Text,
  VStack,
} from "@chakra-ui/react";
import { useState } from "react";

interface TruncationLevelDialogProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (truncateLength: number | null) => void;
}

const TruncationLevelDialog: React.FC<TruncationLevelDialogProps> = ({
  open,
  onClose,
  onSubmit,
}) => {
  const [truncateLength, setTruncateLength] = useState<string>("");

  const handleSubmit = () => {
    if (truncateLength === "") {
      onSubmit(null);
    } else {
      const value = parseInt(truncateLength);
      if (isNaN(value) || value < 1) {
        return;
      }
      onSubmit(value);
    }
    onClose();
  };

  return (
    <Modal isOpen={open} onClose={onClose}>
      <ModalContent>
        <ModalHeader>Enter Truncation Level</ModalHeader>
        <ModalBody>
          <VStack spacing={4}>
            <Text>
              Enter a truncation level (leave empty for no truncation):
            </Text>
            <Input
              value={truncateLength}
              onKeyDown={(e) => {
                e.stopPropagation();
                if (e.key === "Enter") {
                  handleSubmit();
                }
              }}
              onChange={(e) => setTruncateLength(e.target.value)}
              placeholder="Enter truncation level (≥ 1)"
              type="number"
              min={1}
            />
          </VStack>
        </ModalBody>
        <ModalFooter>
          <Button variant="ghost" mr={3} onClick={onClose}>
            Cancel
          </Button>
          <Button colorScheme="blue" onClick={handleSubmit}>
            Calculate
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};

export default TruncationLevelDialog;
