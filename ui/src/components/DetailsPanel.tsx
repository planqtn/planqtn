import { Box, VStack, Heading, Text, Button, Icon, HStack, IconButton, useColorModeValue, useClipboard } from '@chakra-ui/react'
import { FaTable, FaCube, FaCode, FaCopy } from 'react-icons/fa'
import { DroppedLego, SelectedNetwork } from '../types.ts'
import { ParityCheckMatrixDisplay } from './ParityCheckMatrixDisplay.tsx'
import { BlochSphereLoader } from './BlochSphereLoader.tsx'

interface DetailsPanelProps {
    selectedNetwork: SelectedNetwork | null
    selectedLego: DroppedLego | null
    manuallySelectedLegos: DroppedLego[]
    droppedLegos: DroppedLego[]
    onCalculateParityCheckMatrix: () => void
    onCalculateWeightEnumerator: () => void
    onGenerateConstructionCode: () => void
}

const DetailsPanel: React.FC<DetailsPanelProps> = ({
    selectedNetwork,
    selectedLego,
    manuallySelectedLegos,
    droppedLegos,
    onCalculateParityCheckMatrix,
    onCalculateWeightEnumerator,
    onGenerateConstructionCode
}) => {
    const bgColor = useColorModeValue('white', 'gray.800')
    const borderColor = useColorModeValue('gray.200', 'gray.600')
    const { onCopy: onCopyCode, hasCopied: hasCopiedCode } = useClipboard(selectedNetwork?.constructionCode || "")

    return (
        <Box
            h="100%"
            borderLeft="1px"
            borderColor={borderColor}
            bg={bgColor}
            overflowY="auto"
        >
            <VStack align="stretch" spacing={4} p={4}>
                {selectedNetwork ? (
                    <>
                        <Heading size="md">Tensor Network</Heading>
                        <Text>Selected components: {selectedNetwork.legos.length} Legos</Text>
                        <Box p={4} borderWidth={1} borderRadius="lg" bg={bgColor}>
                            <VStack align="stretch" spacing={4}>
                                <Heading size="md">Network Details</Heading>
                                <VStack align="stretch" spacing={3}>
                                    <Button
                                        onClick={onCalculateParityCheckMatrix}
                                        colorScheme="blue"
                                        size="sm"
                                        width="full"
                                        leftIcon={<Icon as={FaTable} />}
                                    >
                                        Calculate Parity Check Matrix
                                    </Button>
                                    <Button
                                        onClick={onCalculateWeightEnumerator}
                                        colorScheme="teal"
                                        size="sm"
                                        width="full"
                                        leftIcon={<Icon as={FaCube} />}
                                    >
                                        Calculate Weight Enumerator
                                    </Button>
                                    <Button
                                        onClick={onGenerateConstructionCode}
                                        colorScheme="purple"
                                        size="sm"
                                        width="full"
                                        leftIcon={<Icon as={FaCode} />}
                                    >
                                        Python Code
                                    </Button>
                                </VStack>
                                {selectedNetwork.parityCheckMatrix && (
                                    <ParityCheckMatrixDisplay
                                        matrix={selectedNetwork.parityCheckMatrix}
                                        title="Parity Check Matrix"
                                    />
                                )}
                                {selectedNetwork.weightEnumerator ? (
                                    <VStack align="stretch" spacing={2}>
                                        <Heading size="sm">Weight Enumerator Polynomial</Heading>
                                        <Box p={3} borderWidth={1} borderRadius="md" bg="gray.50">
                                            <Text fontFamily="mono">{selectedNetwork.weightEnumerator}</Text>
                                        </Box>
                                    </VStack>
                                ) : selectedNetwork.isCalculatingWeightEnumerator ? (
                                    <BlochSphereLoader />
                                ) : null}
                                {selectedNetwork.constructionCode && (
                                    <VStack align="stretch" spacing={2}>
                                        <HStack justify="space-between">
                                            <Heading size="sm">Construction Code</Heading>
                                            <IconButton
                                                aria-label="Copy code"
                                                icon={<Icon as={FaCopy} />}
                                                size="sm"
                                                onClick={onCopyCode}
                                                variant="ghost"
                                            />
                                        </HStack>
                                        <Box
                                            p={3}
                                            borderWidth={1}
                                            borderRadius="md"
                                            bg="gray.50"
                                            position="relative"
                                            fontFamily="mono"
                                            whiteSpace="pre"
                                            overflowX="auto"
                                        >
                                            <Text>{selectedNetwork.constructionCode}</Text>
                                            {hasCopiedCode && (
                                                <Box
                                                    position="absolute"
                                                    top={2}
                                                    right={2}
                                                    px={2}
                                                    py={1}
                                                    bg="green.500"
                                                    color="white"
                                                    borderRadius="md"
                                                    fontSize="sm"
                                                >
                                                    Copied!
                                                </Box>
                                            )}
                                        </Box>
                                    </VStack>
                                )}
                            </VStack>
                        </Box>
                    </>
                ) : selectedLego ? (
                    <>
                        <Heading size="md">Matrix Details</Heading>
                        <VStack align="stretch" spacing={3}>
                            <Text fontWeight="bold">{selectedLego.name}</Text>
                            <Text fontSize="sm" color="gray.600">
                                {selectedLego.description}
                            </Text>
                            <ParityCheckMatrixDisplay matrix={selectedLego.parity_check_matrix} lego={selectedLego} />
                        </VStack>
                    </>
                ) : manuallySelectedLegos.length > 0 ? (
                    <>
                        <Heading size="md">Selection</Heading>
                        <Text>Selected Legos: {manuallySelectedLegos.length}</Text>
                        <Text color="gray.600">
                            For details, select only one lego or a complete connected component
                        </Text>
                    </>
                ) : (
                    <>
                        <Heading size="md">Canvas Overview</Heading>
                        <Text color="gray.600">
                            No legos are selected. There {droppedLegos.length === 1 ? 'is' : 'are'} {droppedLegos.length} {droppedLegos.length === 1 ? 'lego' : 'legos'} on the canvas.
                        </Text>
                    </>
                )}
            </VStack>
        </Box>
    )
}

export default DetailsPanel 