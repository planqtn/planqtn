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
    Text,
    Textarea,
    useToast,
} from '@chakra-ui/react'
import { useState } from 'react'
import axios from 'axios'

interface TannerDialogProps {
    isOpen: boolean;
    onClose: () => void;
    onSubmit: (matrix: number[][]) => void;
}

export const TannerDialog: React.FC<TannerDialogProps> = ({
    isOpen,
    onClose,
    onSubmit,
}) => {
    const [matrixText, setMatrixText] = useState('')
    const toast = useToast()

    const handleSubmit = async () => {
        try {
            // Parse the matrix text into a 2D array
            const matrix = matrixText
                .trim()
                .split('\n')
                .map(row => row.trim().split(/\s+/).map(Number))

            // Validate the matrix
            if (matrix.length === 0 || matrix[0].length === 0) {
                throw new Error('Matrix cannot be empty')
            }

            // Check if all rows have the same length
            const rowLength = matrix[0].length
            if (!matrix.every(row => row.length === rowLength)) {
                throw new Error('All rows must have the same length')
            }

            // Check if all elements are 0 or 1
            if (!matrix.every(row => row.every(val => val === 0 || val === 1))) {
                throw new Error('Matrix elements must be 0 or 1')
            }

            // Validate that the matrix is symplectic
            // 1. Check that the number of columns is even (2n)
            if (rowLength % 2 !== 0) {
                throw new Error('Matrix must have an even number of columns (2n)')
            }



            onSubmit(matrix)
            onClose()
        } catch (error) {
            toast({
                title: 'Error',
                description: error instanceof Error ? error.message : 'Failed to parse matrix',
                status: 'error',
                duration: 5000,
                isClosable: true,
            })
        }
    }

    return (
        <Modal isOpen={isOpen} onClose={onClose}>
            <ModalOverlay />
            <ModalContent>
                <ModalHeader>Create Tanner Network</ModalHeader>
                <ModalCloseButton />
                <ModalBody>
                    <VStack spacing={4}>
                        <Text>
                            Enter the parity check matrix as a space-separated matrix of 0s and 1s.
                            Each row should be on a new line.
                        </Text>
                        <Textarea
                            value={matrixText}
                            onChange={(e) => setMatrixText(e.target.value)}
                            placeholder="1 0 1 0&#10;0 1 0 1&#10;1 1 0 0"
                            rows={10}
                            fontFamily="monospace"
                        />
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