import React, { useState, useEffect } from "react";
import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  VStack,
  Checkbox,
} from "@chakra-ui/react";

interface LegPartitionDialogProps {
  open: boolean;
  numLegs: number;
  onClose: () => void;
  onSubmit: (legAssignments: number[]) => void;
}

export const LegPartitionDialog: React.FC<LegPartitionDialogProps> = ({
  open,
  numLegs,
  onClose,
  onSubmit,
}) => {
  const [legAssignments, setLegAssignments] = useState<number[]>([]);

  useEffect(() => {
    if (open && numLegs > 0) {
      const half = Math.floor(numLegs / 2);
      setLegAssignments(
        Array(numLegs)
          .fill(0)
          .map((_, i) => (i >= half ? 1 : 0)),
      );
    }
  }, [open, numLegs]);

  const handleToggle = (index: number) => {
    const newAssignments = [...legAssignments];
    newAssignments[index] = newAssignments[index] === 0 ? 1 : 0;
    setLegAssignments(newAssignments);
  };

  return (
    <Modal isOpen={open} onClose={onClose}>
      <ModalOverlay />
      <ModalContent>
        <ModalHeader>Assign Legs to Legos</ModalHeader>
        <ModalBody>
          <VStack align="start" spacing={2}>
            {legAssignments.map((isLego2, index) => (
              <Checkbox
                key={index}
                isChecked={isLego2 === 1}
                onChange={() => handleToggle(index)}
              >
                Leg {index} → Lego {isLego2 === 1 ? "2" : "1"}
              </Checkbox>
            ))}
          </VStack>
        </ModalBody>
        <ModalFooter>
          <Button variant="ghost" mr={3} onClick={onClose}>
            Cancel
          </Button>
          <Button colorScheme="blue" onClick={() => onSubmit(legAssignments)}>
            Confirm
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
};
