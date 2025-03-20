import React, { useState, useEffect } from 'react';
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
} from '@chakra-ui/react';

interface LegPartitionDialogProps {
    open: boolean;
    numLegs: number;
    onClose: () => void;
    onConfirm: (legAssignments: boolean[]) => void;
}

export const LegPartitionDialog: React.FC<LegPartitionDialogProps> = ({ open, numLegs, onClose, onConfirm }) => {
    const [legAssignments, setLegAssignments] = useState<boolean[]>([]);

    useEffect(() => {
        if (open && numLegs > 0) {
            const half = Math.floor(numLegs / 2);
            setLegAssignments(Array(numLegs).fill(false).map((_, i) => i >= half));
        }
    }, [open, numLegs]);


    const handleToggle = (index: number) => {
        const newAssignments = [...legAssignments];
        newAssignments[index] = !newAssignments[index];
        setLegAssignments(newAssignments);
    };

    return (
        <Modal isOpen={open} onClose={onClose}>
            <ModalOverlay />
            <ModalContent>
                <ModalHeader>Assign Legs to Legos</ModalHeader>
                <ModalBody>
                    <VStack align="start" spacing={2}>
                        {legAssignments.map((isLego1, index) => (
                            <Checkbox
                                key={index}
                                isChecked={isLego1}
                                onChange={() => handleToggle(index)}
                            >
                                Leg {index} → Lego {isLego1 ? "2" : "1"}
                            </Checkbox>
                        ))}
                    </VStack>
                </ModalBody>
                <ModalFooter>
                    <Button variant="ghost" mr={3} onClick={onClose}>
                        Cancel
                    </Button>
                    <Button colorScheme="blue" onClick={() => onConfirm(legAssignments)}>
                        Confirm
                    </Button>
                </ModalFooter>
            </ModalContent>
        </Modal>
    );
}; 