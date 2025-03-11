import { Box, VStack, Heading, Text, Button, Icon, HStack, IconButton, useColorModeValue, useClipboard } from '@chakra-ui/react'
import { FaTable, FaCube, FaCode, FaCopy } from 'react-icons/fa'
import { DroppedLego, SelectedNetwork } from '../types.ts'
import { ParityCheckMatrixDisplay } from './ParityCheckMatrixDisplay.tsx'
import { BlochSphereLoader } from './BlochSphereLoader.tsx'
import axios from 'axios'
import { useState } from 'react'

interface DetailsPanelProps {
    selectedNetwork: SelectedNetwork | null
    selectedLego: DroppedLego | null
    manuallySelectedLegos: DroppedLego[]
    droppedLegos: DroppedLego[]
    setSelectedNetwork: (value: SelectedNetwork | null | ((prev: SelectedNetwork | null) => SelectedNetwork | null)) => void
    setError: (error: string) => void
}

const DetailsPanel: React.FC<DetailsPanelProps> = ({
    selectedNetwork,
    selectedLego,
    manuallySelectedLegos,
    droppedLegos,
    setSelectedNetwork,
    setError
}) => {
    const bgColor = useColorModeValue('white', 'gray.800')
    const borderColor = useColorModeValue('gray.200', 'gray.600')
    const { onCopy: onCopyCode, hasCopied: hasCopiedCode } = useClipboard(selectedNetwork?.constructionCode || "")
    const [parityCheckMatrixCache] = useState<Map<string, number[][]>>(new Map())
    const [weightEnumeratorCache] = useState<Map<string, string>>(new Map())

    // Helper function to generate network signature for caching
    const getNetworkSignature = (network: SelectedNetwork) => {
        const sortedLegos = [...network.legos].sort((a, b) => a.instanceId.localeCompare(b.instanceId));
        const sortedConnections = [...network.connections].sort((a, b) => {
            const aStr = `${a.from.legoId}${a.from.legIndex}${a.to.legoId}${a.to.legIndex}`;
            const bStr = `${b.from.legoId}${b.from.legIndex}${b.to.legoId}${b.to.legIndex}`;
            return aStr.localeCompare(bStr);
        });
        return JSON.stringify({ legos: sortedLegos, connections: sortedConnections });
    };

    const calculateParityCheckMatrix = async () => {
        if (!selectedNetwork) return;
        try {
            const response = await axios.post('/api/paritycheck', {
                legos: selectedNetwork.legos.reduce((acc, lego) => {
                    acc[lego.instanceId] = lego;
                    return acc;
                }, {} as Record<string, DroppedLego>),
                connections: selectedNetwork.connections
            });

            setSelectedNetwork({
                ...selectedNetwork,
                parityCheckMatrix: response.data.matrix
            });

            parityCheckMatrixCache.set(getNetworkSignature(selectedNetwork), response.data.matrix);
        } catch (error) {
            console.error('Error calculating parity check matrix:', error);
            setError('Failed to calculate parity check matrix');
        }
    };

    const calculateWeightEnumerator = async () => {
        if (!selectedNetwork) return;

        const signature = getNetworkSignature(selectedNetwork);
        const cachedEnumerator = weightEnumeratorCache.get(signature);
        if (cachedEnumerator) {
            setSelectedNetwork({
                ...selectedNetwork,
                weightEnumerator: cachedEnumerator,
                isCalculatingWeightEnumerator: false
            });
            return;
        }

        try {
            setSelectedNetwork((prev: SelectedNetwork | null) => prev ? {
                ...prev,
                isCalculatingWeightEnumerator: true,
                weightEnumerator: undefined
            } : null);

            const response = await axios.post('/api/weightenumerator', {
                legos: selectedNetwork.legos.reduce((acc, lego) => {
                    acc[lego.instanceId] = lego;
                    return acc;
                }, {} as Record<string, DroppedLego>),
                connections: selectedNetwork.connections
            });

            // Cache the result
            weightEnumeratorCache.set(signature, response.data.polynomial);

            setSelectedNetwork((prev: SelectedNetwork | null) => prev ? {
                ...prev,
                weightEnumerator: response.data.polynomial,
                isCalculatingWeightEnumerator: false
            } : null);
        } catch (error) {
            console.error('Error calculating weight enumerator:', error);
            setError('Failed to calculate weight enumerator');
            setSelectedNetwork((prev: SelectedNetwork | null) => prev ? {
                ...prev,
                isCalculatingWeightEnumerator: false
            } : null);
        }
    };

    const generateConstructionCode = async () => {
        if (!selectedNetwork) return;

        try {
            const response = await axios.post('/api/constructioncode', {
                legos: selectedNetwork.legos.reduce((acc, lego) => {
                    acc[lego.instanceId] = lego;
                    return acc;
                }, {} as Record<string, DroppedLego>),
                connections: selectedNetwork.connections
            });

            setSelectedNetwork(prev => prev ? {
                ...prev,
                constructionCode: response.data.code
            } : null);
        } catch (error) {
            console.error('Error generating Python code:', error);
            setError('Failed to generate Python code');
        }
    };

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
                                    {!selectedNetwork.parityCheckMatrix &&
                                        !parityCheckMatrixCache.get(getNetworkSignature(selectedNetwork)) && (
                                            <Button
                                                onClick={calculateParityCheckMatrix}
                                                colorScheme="blue"
                                                size="sm"
                                                width="full"
                                                leftIcon={<Icon as={FaTable} />}
                                            >
                                                Calculate Parity Check Matrix
                                            </Button>
                                        )}
                                    {!selectedNetwork.weightEnumerator &&
                                        !weightEnumeratorCache.get(getNetworkSignature(selectedNetwork)) &&
                                        !selectedNetwork.isCalculatingWeightEnumerator && (
                                            <Button
                                                onClick={calculateWeightEnumerator}
                                                colorScheme="teal"
                                                size="sm"
                                                width="full"
                                                leftIcon={<Icon as={FaCube} />}
                                            >
                                                Calculate Weight Enumerator
                                            </Button>
                                        )}
                                    <Button
                                        onClick={generateConstructionCode}
                                        colorScheme="purple"
                                        size="sm"
                                        width="full"
                                        leftIcon={<Icon as={FaCode} />}
                                    >
                                        Python Code
                                    </Button>
                                </VStack>
                                {(selectedNetwork.parityCheckMatrix ||
                                    (selectedNetwork && parityCheckMatrixCache.get(getNetworkSignature(selectedNetwork)))) && (
                                        <ParityCheckMatrixDisplay
                                            matrix={selectedNetwork.parityCheckMatrix ||
                                                parityCheckMatrixCache.get(getNetworkSignature(selectedNetwork))!}
                                            title="Parity Check Matrix"
                                        />
                                    )}
                                {(selectedNetwork.weightEnumerator ||
                                    (selectedNetwork && weightEnumeratorCache.get(getNetworkSignature(selectedNetwork)))) ? (
                                    <VStack align="stretch" spacing={2}>
                                        <Heading size="sm">Weight Enumerator Polynomial</Heading>
                                        <Box p={3} borderWidth={1} borderRadius="md" bg="gray.50">
                                            <Text fontFamily="mono">
                                                {selectedNetwork.weightEnumerator ||
                                                    weightEnumeratorCache.get(getNetworkSignature(selectedNetwork))}
                                            </Text>
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