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
} from '@chakra-ui/react';
import { useState } from 'react';

interface CssTannerDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (matrix: number[][]) => void;
}

export function CssTannerDialog({ isOpen, onClose, onSubmit }: CssTannerDialogProps) {
    const [matrixInput, setMatrixInput] = useState('0 0 1 1\n1 1 0 0');
    const [error, setError] = useState('');

    const validateMatrix = (input: string): number[][] | null => {
        try {
            // Parse the input into a 2D array
            const rows = input.trim().split('\n').map(row =>
                row.trim().split(/\s+/).map(num => parseInt(num, 10))
            );

            // Check if all rows have the same length
            const width = rows[0].length;
            if (!rows.every(row => row.length === width)) {
                setError('All rows must have the same length');
                return null;
            }

            // Check if width is even (required for symplectic matrix)
            if (width % 2 !== 0) {
                setError('Matrix width must be even for CSS symplectic matrix');
                return null;
            }

            // Check if all elements are binary (0 or 1)
            if (!rows.every(row => row.every(num => num === 0 || num === 1))) {
                setError('Matrix must contain only 0s and 1s');
                return null;
            }

            // Check if it's a valid CSS symplectic matrix
            // For each row i, j: <hi|hj> + <zi|zj> = 0 mod 2
            const n = width / 2;
            for (let i = 0; i < rows.length; i++) {
                for (let j = 0; j < rows.length; j++) {
                    let sum = 0;
                    for (let k = 0; k < n; k++) {
                        sum += rows[i][k] * rows[j][k + n] + rows[i][k + n] * rows[j][k];
                    }
                    if (sum % 2 !== 0) {
                        setError('Not a valid CSS symplectic matrix');
                        return null;
                    }
                }
            }

            return rows;
        } catch (e) {
            setError('Invalid matrix format');
            return null;
        }
    };

    const handleSubmit = () => {
        const matrix = validateMatrix(matrixInput);
        if (matrix) {
            onSubmit(matrix);
            onClose();
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} size="xl">
            <ModalOverlay />
            <ModalContent>
                <ModalHeader>Create CSS Tanner Network</ModalHeader>
                <ModalCloseButton />
                <ModalBody>
                    <VStack spacing={4} align="stretch">
                        <Text>
                            Enter the CSS symplectic matrix (space-separated numbers, one row per line):
                        </Text>
                        <Textarea
                            value={matrixInput}
                            onChange={(e) => {
                                setMatrixInput(e.target.value);
                                setError('');
                            }}
                            minHeight="200px"
                            fontFamily="monospace"
                        />
                        {error && (
                            <Text color="red.500" fontSize="sm">
                                {error}
                            </Text>
                        )}
                    </VStack>
                </ModalBody>
                <ModalFooter>
                    <Button colorScheme="blue" mr={3} onClick={handleSubmit}>
                        Create Network
                    </Button>
                    <Button variant="ghost" onClick={onClose}>
                        Cancel
                    </Button>
                </ModalFooter>
            </ModalContent>
        </Modal>
    );
} 