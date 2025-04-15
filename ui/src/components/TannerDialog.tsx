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
} from '@chakra-ui/react'
import { useState, useEffect } from 'react'

interface TannerDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (matrix: number[][]) => void;
    title?: string;
    cssOnly?: boolean;
}

export const TannerDialog: React.FC<TannerDialogProps> = ({
    isOpen,
    onClose,
    onSubmit,
    title = 'Create Tanner Network',
    cssOnly = false
}) => {
    const defaultMspMatrix = `1 1 1 1 0 0 0 0
0 0 0 0 1 1 0 0
0 0 0 0 0 0 1 1`;

    const defaultCssMatrix = `0 0 1 1
1 1 0 0`;

    const [matrixText, setMatrixText] = useState('')
    const [error, setError] = useState('')

    // Set default value when dialog opens
    useEffect(() => {
        if (isOpen) {
            if (title === 'Measurement State Prep Network') {
                setMatrixText(defaultMspMatrix);
            } else if (cssOnly) {
                setMatrixText(defaultCssMatrix);
            }
            setError('');
        }
    }, [isOpen, title, cssOnly]);

    const toast = useToast()

    const validateMatrix = (input: string): number[][] | null => {
        try {
            // Parse the input into a 2D array
            const matrix = input
                .trim()
                .split('\n')
                .map(row => row.trim().split(/\s+/).map(Number));

            // Validate the matrix
            if (matrix.length === 0 || matrix[0].length === 0) {
                throw new Error('Matrix cannot be empty');
            }

            // Check if all rows have the same length
            const rowLength = matrix[0].length;
            if (!matrix.every(row => row.length === rowLength)) {
                throw new Error('All rows must have the same length');
            }

            // Check if all elements are 0 or 1
            if (!matrix.every(row => row.every(val => val === 0 || val === 1))) {
                throw new Error('Matrix elements must be 0 or 1');
            }

            // Check if the number of columns is even (2n)
            if (rowLength % 2 !== 0) {
                throw new Error('Matrix must have an even number of columns (2n)');
            }

            // Additional validation for CSS case
            if (cssOnly) {
                const halfWidth = rowLength / 2;
                for (let i = 0; i < matrix.length; i++) {
                    const firstHalf = matrix[i].slice(0, halfWidth);
                    const secondHalf = matrix[i].slice(halfWidth);

                    const hasOnesInFirstHalf = firstHalf.some(x => x === 1);
                    const hasOnesInSecondHalf = secondHalf.some(x => x === 1);

                    if (hasOnesInFirstHalf && hasOnesInSecondHalf) {
                        throw new Error(`Row ${i + 1} is not CSS`);
                    }
                }
            }

            return matrix;
        } catch (e) {
            const errorMessage = e instanceof Error ? e.message : 'Invalid matrix format';
            if (cssOnly) {
                setError(errorMessage);
            } else {
                toast({
                    title: 'Error',
                    description: errorMessage,
                    status: 'error',
                    duration: 5000,
                    isClosable: true,
                });
            }
            return null;
        }
    };

    const handleSubmit = () => {
        const matrix = validateMatrix(matrixText);
        if (matrix) {
            onSubmit(matrix);
            onClose();
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} size="xl">
            <ModalOverlay />
            <ModalContent>
                <ModalHeader>{title}</ModalHeader>
                <ModalCloseButton />
                <ModalBody>
                    <VStack spacing={4}>
                        <Text>
                            {cssOnly
                                ? "Enter the CSS symplectic matrix (space-separated numbers, one row per line):"
                                : "Enter the parity check matrix as a space-separated matrix of 0s and 1s. Each row should be on a new line."}
                        </Text>
                        <Textarea
                            value={matrixText}
                            onChange={(e) => {
                                setMatrixText(e.target.value);
                                setError('');
                            }}
                            placeholder={cssOnly ? defaultCssMatrix : "1 0 1 0\n0 1 0 1\n1 1 0 0"}
                            rows={10}
                            fontFamily="monospace"
                        />
                        {cssOnly && error && (
                            <Text color="red.500" fontSize="sm">
                                {error}
                            </Text>
                        )}
                    </VStack>
                </ModalBody>
                <ModalFooter>
                    <Button variant="ghost" mr={3} onClick={onClose}>
                        Cancel
                    </Button>
                    <Button colorScheme="blue" onClick={handleSubmit}>
                        Create Network
                    </Button>
                </ModalFooter>
            </ModalContent>
        </Modal>
    )
} 