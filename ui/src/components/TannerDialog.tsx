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
    FormControl,
    FormLabel,
    Switch,
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
    const defaultMspMatrix = `11110000
00001100
00000011`;

    const defaultCssMatrix = `0011
1100`;

    const defaultStabilizer = `XZIZ,IXZI,IIXZ`;

    const [matrixText, setMatrixText] = useState('')
    const [error, setError] = useState('')
    const [useStabilizer, setUseStabilizer] = useState(false);

    // Set default value when dialog opens
    useEffect(() => {
        if (isOpen) {
            setError('');

            if (!matrixText || matrixText === '') {
                if (title === 'Measurement State Prep Network') {
                    setMatrixText(useStabilizer ? defaultStabilizer : defaultMspMatrix);
                } else if (cssOnly) {
                    setMatrixText(useStabilizer ? defaultStabilizer : defaultCssMatrix);
                } else {
                    setMatrixText(useStabilizer ? defaultStabilizer : '1010\n0101\n1100');
                }
            }
        }
    }, [isOpen, title, cssOnly]);

    const toast = useToast()

    const pauliToSymplectic = (pauliString: string): number[] => {
        const n = pauliString.length;
        const symplectic = new Array(2 * n).fill(0);

        for (let i = 0; i < n; i++) {
            const pauli = pauliString[i];
            if (pauli === 'X') {
                symplectic[i] = 1;
            } else if (pauli === 'Z') {
                symplectic[i + n] = 1;
            } else if (pauli === 'Y') {
                symplectic[i] = 1;
                symplectic[i + n] = 1;
            }
        }

        return symplectic;
    };

    const symplecticToPauli = (symplectic: number[]): string => {
        const n = symplectic.length / 2;
        let pauli = '';
        for (let i = 0; i < n; i++) {
            const x = symplectic[i];
            const z = symplectic[i + n];
            if (x === 1 && z === 1) {
                pauli += 'Y';
            } else if (x === 1) {
                pauli += 'X';
            } else if (z === 1) {
                pauli += 'Z';
            } else {
                pauli += 'I';
            }
        }
        return pauli;
    };

    const parseMatrix = (input: string): number[][] => {
        if (useStabilizer) {
            // Split by commas and newlines, remove spaces, capitalize
            const pauliStrings = input
                .toUpperCase()
                .split(/[,\n]/)
                .map(s => s.trim())
                .filter(s => s.length > 0);

            // Convert each Pauli string to symplectic representation
            return pauliStrings.map(pauliToSymplectic);
        } else {
            return input
                .trim()
                .split('\n')
                .map(row => row
                    .trim()
                    .replace(/[,\[\]()]/g, '')
                    .replace(/\s+/g, '')
                    .split('')
                    .map(Number)
                );
        }
    };

    const convertInput = (input: string, toStabilizer: boolean): string => {
        try {
            if (toStabilizer) {
                // Convert matrix to stabilizer, preserving newlines
                const matrix = parseMatrix(input);
                const pauliStrings = matrix.map(symplecticToPauli);
                // If the input had newlines, use them as separators
                if (input.includes('\n')) {
                    return pauliStrings.join('\n');
                }
                // Otherwise use commas
                return pauliStrings.join(',');
            } else {
                // Convert stabilizer to matrix
                const matrix = parseMatrix(input);
                return matrix.map(row => row.join('')).join('\n');
            }
        } catch (e) {
            // If conversion fails, return the original input
            return input;
        }
    };

    const validateMatrix = (input: string): number[][] | null => {
        try {
            const matrix = parseMatrix(input);

            // Validate the matrix
            if (matrix.length === 0 || matrix[0].length === 0) {
                throw new Error('Matrix cannot be empty');
            }

            // Check if all rows have the same length
            const rowLength = matrix[0].length;
            if (!matrix.every(row => row.length === rowLength)) {
                throw new Error('All rows must have the same length');
            }

            if (!useStabilizer) {
                // Check if all elements are 0 or 1
                if (!matrix.every(row => row.every(val => val === 0 || val === 1))) {
                    throw new Error('Matrix elements must be 0 or 1');
                }
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
                            {useStabilizer
                                ? "Enter the stabilizer generators as Pauli strings (e.g., XXXX,ZZZZ):"
                                : cssOnly
                                    ? "Enter the CSS symplectic matrix (one row per line):"
                                    : "Enter the parity check matrix (one row per line):"}
                        </Text>
                        <FormControl display="flex" alignItems="center">
                            <FormLabel htmlFor="use-stabilizer" mb="0">
                                Use Pauli strings
                            </FormLabel>
                            <Switch
                                id="use-stabilizer"
                                isChecked={useStabilizer}
                                onChange={(e) => {
                                    const newUseStabilizer = e.target.checked;

                                    // Convert existing input to the new format
                                    const convertedInput = convertInput(matrixText, newUseStabilizer);
                                    console.log(matrixText);
                                    console.log(convertedInput);
                                    setMatrixText(convertedInput);
                                    setUseStabilizer(newUseStabilizer);
                                    setError('');
                                }}
                            />
                        </FormControl>
                        <Textarea
                            value={matrixText}
                            onChange={(e) => {
                                setMatrixText(e.target.value);
                                setError('');
                            }}
                            onKeyDown={(e) => {
                                e.stopPropagation();
                                if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    e.currentTarget.select();
                                }
                                if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    handleSubmit();
                                }
                            }}
                            placeholder={useStabilizer
                                ? defaultStabilizer
                                : cssOnly
                                    ? defaultCssMatrix
                                    : title === 'Measurement State Prep Network'
                                        ? defaultMspMatrix
                                        : "1010\n0101\n1100"}
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
                        Cancel (Esc)
                    </Button>
                    <Button colorScheme="blue" onClick={handleSubmit}>
                        Create Network (Ctrl+Enter)
                    </Button>
                </ModalFooter>
            </ModalContent>
        </Modal>
    )
} 