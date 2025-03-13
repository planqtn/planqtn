import { Box, VStack, Heading, Text, Button, Icon, HStack, IconButton, useColorModeValue, useClipboard } from '@chakra-ui/react'
import { FaTable, FaCube, FaCode, FaCopy } from 'react-icons/fa'
import { DroppedLego, TensorNetwork, TensorNetworkLeg } from '../types.ts'
import { ParityCheckMatrixDisplay } from './ParityCheckMatrixDisplay.tsx'
import { BlochSphereLoader } from './BlochSphereLoader.tsx'
import axios, { AxiosResponse } from 'axios'
import { useState } from 'react'

interface DetailsPanelProps {
    tensorNetwork: TensorNetwork | null
    selectedLego: DroppedLego | null
    manuallySelectedLegos: DroppedLego[]
    droppedLegos: DroppedLego[]
    setTensorNetwork: (value: TensorNetwork | null | ((prev: TensorNetwork | null) => TensorNetwork | null)) => void
    setError: (error: string) => void
}

const DetailsPanel: React.FC<DetailsPanelProps> = ({
    tensorNetwork: tensorNetwork,
    selectedLego,
    manuallySelectedLegos,
    droppedLegos,
    setTensorNetwork: setTensorNetwork,
    setError
}) => {
    const bgColor = useColorModeValue('white', 'gray.800')
    const borderColor = useColorModeValue('gray.200', 'gray.600')
    const { onCopy: onCopyCode, hasCopied: hasCopiedCode } = useClipboard(tensorNetwork?.constructionCode || "")
    const [parityCheckMatrixCache] = useState<Map<string, AxiosResponse<{ matrix: number[][], legs: TensorNetworkLeg[] }>>>(new Map())
    const [weightEnumeratorCache] = useState<Map<string, string>>(new Map())

    // Helper function to generate network signature for caching
    const getNetworkSignature = (network: TensorNetwork) => {
        const sortedLegos = [...network.legos].sort((a, b) => a.instanceId.localeCompare(b.instanceId));
        const sortedConnections = [...network.connections].sort((a, b) => {
            const aStr = `${a.from.legoId}${a.from.legIndex}${a.to.legoId}${a.to.legIndex}`;
            const bStr = `${b.from.legoId}${b.from.legIndex}${b.to.legoId}${b.to.legIndex}`;
            return aStr.localeCompare(bStr);
        });
        return JSON.stringify({ legos: sortedLegos, connections: sortedConnections });
    };

    const calculateParityCheckMatrix = async () => {
        if (!tensorNetwork) return;
        try {
            const response = await axios.post('/api/paritycheck', {
                legos: tensorNetwork.legos.reduce((acc, lego) => {
                    acc[lego.instanceId] = lego;
                    return acc;
                }, {} as Record<string, DroppedLego>),
                connections: tensorNetwork.connections
            });

            const legOrdering = response.data.legs.map((leg: TensorNetworkLeg) => ({
                instanceId: leg.instanceId,
                legIndex: leg.legIndex
            }));

            console.log("legOrdering", legOrdering)

            setTensorNetwork({
                ...tensorNetwork,
                parityCheckMatrix: response.data.matrix,
                legOrdering: legOrdering
            });

            parityCheckMatrixCache.set(getNetworkSignature(tensorNetwork), response);
        } catch (error) {
            console.error('Error calculating parity check matrix:', error);
            setError('Failed to calculate parity check matrix');
        }
    };

    const calculateWeightEnumerator = async () => {
        if (!tensorNetwork) return;

        const signature = getNetworkSignature(tensorNetwork);
        const cachedEnumerator = weightEnumeratorCache.get(signature);
        if (cachedEnumerator) {
            setTensorNetwork({
                ...tensorNetwork,
                weightEnumerator: cachedEnumerator,
                isCalculatingWeightEnumerator: false
            });
            return;
        }

        try {
            setTensorNetwork((prev: TensorNetwork | null) => prev ? {
                ...prev,
                isCalculatingWeightEnumerator: true,
                weightEnumerator: undefined
            } : null);

            const response = await axios.post('/api/weightenumerator', {
                legos: tensorNetwork.legos.reduce((acc, lego) => {
                    acc[lego.instanceId] = lego;
                    return acc;
                }, {} as Record<string, DroppedLego>),
                connections: tensorNetwork.connections
            });

            // Cache the result
            weightEnumeratorCache.set(signature, response.data.polynomial);

            setTensorNetwork((prev: TensorNetwork | null) => prev ? {
                ...prev,
                weightEnumerator: response.data.polynomial,
                isCalculatingWeightEnumerator: false
            } : null);
        } catch (error) {
            console.error('Error calculating weight enumerator:', error);
            setError('Failed to calculate weight enumerator');
            setTensorNetwork((prev: TensorNetwork | null) => prev ? {
                ...prev,
                isCalculatingWeightEnumerator: false
            } : null);
        }
    };

    const generateConstructionCode = async () => {
        if (!tensorNetwork) return;

        try {
            const response = await axios.post('/api/constructioncode', {
                legos: tensorNetwork.legos.reduce((acc, lego) => {
                    acc[lego.instanceId] = lego;
                    return acc;
                }, {} as Record<string, DroppedLego>),
                connections: tensorNetwork.connections
            });

            setTensorNetwork(prev => prev ? {
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
                {tensorNetwork ? (
                    <>
                        <Heading size="md">Tensor Network</Heading>
                        <Text>Selected components: {tensorNetwork.legos.length} Legos</Text>
                        <Box p={4} borderWidth={1} borderRadius="lg" bg={bgColor}>
                            <VStack align="stretch" spacing={4}>
                                <Heading size="md">Network Details</Heading>
                                <VStack align="stretch" spacing={3}>
                                    {!tensorNetwork.parityCheckMatrix &&
                                        !parityCheckMatrixCache.get(getNetworkSignature(tensorNetwork)) && (
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
                                    {!tensorNetwork.weightEnumerator &&
                                        !weightEnumeratorCache.get(getNetworkSignature(tensorNetwork)) &&
                                        !tensorNetwork.isCalculatingWeightEnumerator && (
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
                                {(tensorNetwork.parityCheckMatrix ||
                                    (tensorNetwork && parityCheckMatrixCache.get(getNetworkSignature(tensorNetwork)))) && (
                                        <ParityCheckMatrixDisplay
                                            matrix={tensorNetwork.parityCheckMatrix ||
                                                parityCheckMatrixCache.get(getNetworkSignature(tensorNetwork))!.data.matrix}
                                            title="Parity Check Matrix"
                                            legOrdering={tensorNetwork.legOrdering ||
                                                parityCheckMatrixCache.get(getNetworkSignature(tensorNetwork))!.data.legs}
                                            onMatrixChange={(newMatrix) => {
                                                // Update the tensor network state
                                                setTensorNetwork(prev => prev ? {
                                                    ...prev,
                                                    parityCheckMatrix: newMatrix
                                                } : null);

                                                // Update the cache
                                                const signature = getNetworkSignature(tensorNetwork);
                                                const cachedResponse = parityCheckMatrixCache.get(signature);
                                                if (cachedResponse) {
                                                    parityCheckMatrixCache.set(signature, {
                                                        ...cachedResponse,
                                                        data: {
                                                            ...cachedResponse.data,
                                                            matrix: newMatrix
                                                        }
                                                    });
                                                }
                                            }}
                                            onRecalculate={calculateParityCheckMatrix}
                                        />
                                    )}
                                {(tensorNetwork.weightEnumerator ||
                                    (tensorNetwork && weightEnumeratorCache.get(getNetworkSignature(tensorNetwork)))) ? (
                                    <VStack align="stretch" spacing={2}>
                                        <Heading size="sm">Weight Enumerator Polynomial</Heading>
                                        <Box p={3} borderWidth={1} borderRadius="md" bg="gray.50">
                                            <Text fontFamily="mono">
                                                {tensorNetwork.weightEnumerator ||
                                                    weightEnumeratorCache.get(getNetworkSignature(tensorNetwork))}
                                            </Text>
                                        </Box>
                                    </VStack>
                                ) : tensorNetwork.isCalculatingWeightEnumerator ? (
                                    <BlochSphereLoader />
                                ) : null}
                                {tensorNetwork.constructionCode && (
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
                                            <Text>{tensorNetwork.constructionCode}</Text>
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
                        <Heading size="md">Lego Instance Details</Heading>
                        <VStack align="stretch" spacing={3}>
                            <Text fontWeight="bold">{selectedLego.name}</Text>
                            <Text fontSize="sm" color="gray.600">
                                {selectedLego.description}, instaceId: {selectedLego.instanceId}
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