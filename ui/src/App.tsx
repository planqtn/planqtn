import { Box, Container, Heading, Text, VStack, HStack, List, ListItem, Icon, Badge, useColorModeValue, Table, Thead, Tbody, Tr, Td, Button } from '@chakra-ui/react'
import { useEffect, useState, useRef, useCallback } from 'react'
import axios from 'axios'
import { FaCube, FaCode, FaTable } from 'react-icons/fa'

interface LegoPiece {
    id: string
    name: string
    shortName: string
    type: string
    description: string
    is_dynamic?: boolean
    parameters?: Record<string, any>
    parity_check_matrix: number[][]
}

interface DroppedLego extends LegoPiece {
    x: number
    y: number
    instanceId: string
}

interface Connection {
    from: {
        legoId: string
        legIndex: number
    }
    to: {
        legoId: string
        legIndex: number
    }
}

interface DragState {
    isDragging: boolean
    draggedLegoIndex: number
    startX: number
    startY: number
    originalX: number
    originalY: number
}

interface LegDragState {
    isDragging: boolean
    legoId: string
    legIndex: number
    startX: number
    startY: number
}

interface CanvasState {
    pieces: Array<{
        id: string
        instanceId: string
        x: number
        y: number
    }>
    connections: Array<Connection>
}

interface SelectedNetwork {
    legos: DroppedLego[]
    connections: Connection[]
}

interface Operation {
    type: 'add' | 'remove' | 'move' | 'connect' | 'disconnect';
    data: {
        legos?: DroppedLego[];
        connections?: Connection[];
        legoInstanceId?: string;
        oldX?: number;
        oldY?: number;
        newX?: number;
        newY?: number;
    };
}

function App() {
    const [message, setMessage] = useState<string>('Loading...')
    const [legos, setLegos] = useState<LegoPiece[]>([])
    const [droppedLegos, setDroppedLegos] = useState<DroppedLego[]>([])
    const [connections, setConnections] = useState<Connection[]>([])
    const [error, setError] = useState<string>('')
    const [selectedLego, setSelectedLego] = useState<DroppedLego | null>(null)
    const [legDragState, setLegDragState] = useState<LegDragState | null>(null)
    const [dragState, setDragState] = useState<DragState>({
        isDragging: false,
        draggedLegoIndex: -1,
        startX: 0,
        startY: 0,
        originalX: 0,
        originalY: 0
    })
    const canvasRef = useRef<HTMLDivElement>(null)
    const [selectedNetwork, setSelectedNetwork] = useState<SelectedNetwork | null>(null)
    const [operationHistory, setOperationHistory] = useState<Operation[]>([])
    const [redoHistory, setRedoHistory] = useState<Operation[]>([])

    const bgColor = useColorModeValue('white', 'gray.800')
    const borderColor = useColorModeValue('gray.200', 'gray.600')

    const encodeCanvasState = useCallback((pieces: DroppedLego[], conns: Connection[]) => {
        const state: CanvasState = {
            pieces: pieces.map(piece => ({
                id: piece.id,
                instanceId: piece.instanceId,
                x: piece.x,
                y: piece.y
            })),
            connections: conns
        }
        const encoded = btoa(JSON.stringify(state))
        window.history.replaceState(null, '', `#state=${encoded}`)
    }, [])

    const decodeCanvasState = useCallback(async (encoded: string): Promise<{
        pieces: DroppedLego[],
        connections: Connection[]
    }> => {
        try {
            const decoded = JSON.parse(atob(encoded))
            if (!decoded.pieces || !Array.isArray(decoded.pieces)) {
                return { pieces: [], connections: [] }
            }

            // Fetch legos if not already loaded
            let legosList = legos
            if (legos.length === 0) {
                const response = await axios.get('/api/legos')
                legosList = response.data
            }

            // Reconstruct dropped legos with full lego information
            const reconstructedPieces = decoded.pieces.map((piece: { id: string; instanceId: string; x: number; y: number }) => {
                const fullLego = legosList.find(l => l.id === piece.id)
                if (!fullLego) return null
                return {
                    ...fullLego,
                    instanceId: piece.instanceId,
                    x: piece.x,
                    y: piece.y
                }
            }).filter((piece: DroppedLego | null): piece is DroppedLego => piece !== null)

            return {
                pieces: reconstructedPieces,
                connections: decoded.connections || []
            }
        } catch (error) {
            console.error('Error decoding canvas state:', error)
            return { pieces: [], connections: [] }
        }
    }, [legos])

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [healthResponse, legosResponse] = await Promise.all([
                    axios.get('/api/health'),
                    axios.get('/api/legos')
                ])
                setMessage(healthResponse.data.message)
                setLegos(legosResponse.data)
            } catch (error) {
                setMessage('Error connecting to backend')
                setError('Failed to fetch data')
                console.error('Error:', error)
            }
        }

        fetchData()
    }, [])

    // Update URL when dropped legos change
    useEffect(() => {
        if (droppedLegos.length > 0 || connections.length > 0) {
            encodeCanvasState(droppedLegos, connections)
        }
    }, [droppedLegos, connections, encodeCanvasState])

    // Add a new effect to handle initial URL state
    useEffect(() => {
        const handleHashChange = async () => {
            const hashParams = new URLSearchParams(window.location.hash.slice(1))
            const stateParam = hashParams.get('state')
            if (stateParam) {
                const decodedState = await decodeCanvasState(stateParam)
                setDroppedLegos(decodedState.pieces)
                setConnections(decodedState.connections)
            }
        }

        // Listen for hash changes
        window.addEventListener('hashchange', handleHashChange)

        // Initial load
        handleHashChange()

        // Cleanup
        return () => window.removeEventListener('hashchange', handleHashChange)
    }, [decodeCanvasState])

    const getLegoIcon = (type: string) => {
        switch (type) {
            case 'tensor':
                return FaCube
            case 'code':
                return FaCode
            default:
                return FaTable
        }
    }

    const handleDragStart = (e: React.DragEvent, lego: LegoPiece) => {
        e.dataTransfer.setData('application/json', JSON.stringify(lego))
    }

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault()
    }

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault()
        const legoData = e.dataTransfer.getData('application/json')
        if (legoData) {
            const lego = JSON.parse(legoData)
            const rect = e.currentTarget.getBoundingClientRect()
            const x = e.clientX - rect.left
            const y = e.clientY - rect.top
            const instanceId = `${lego.id}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
            const newLego = { ...lego, x, y, instanceId }
            setDroppedLegos(prev => [...prev, newLego])
            addToHistory({
                type: 'add',
                data: { legos: [newLego] }
            })
        }
    }

    const handleLegoMouseDown = (e: React.MouseEvent, index: number) => {
        e.preventDefault();
        e.stopPropagation();
        const lego = droppedLegos[index];

        if (e.shiftKey) {
            // Create a new instance with a new instanceId
            const newInstanceId = `${lego.id}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            const newLego = {
                ...lego,
                instanceId: newInstanceId,
                x: lego.x + 20, // Offset slightly to make it visible
                y: lego.y + 20
            };

            // Add the new lego to the list
            setDroppedLegos(prev => [...prev, newLego]);

            // Set up drag state for the new lego
            setDragState({
                isDragging: true,
                draggedLegoIndex: droppedLegos.length, // Index of the new lego
                startX: e.clientX,
                startY: e.clientY,
                originalX: lego.x + 20,
                originalY: lego.y + 20
            });
        } else {
            // Original drag behavior
            setDragState({
                isDragging: true,
                draggedLegoIndex: index,
                startX: e.clientX,
                startY: e.clientY,
                originalX: lego.x,
                originalY: lego.y
            });
        }
    }

    const handleLegoClick = (e: React.MouseEvent, lego: DroppedLego) => {
        if (!dragState.isDragging) {
            e.stopPropagation();

            if (selectedLego?.instanceId === lego.instanceId) {
                // If clicking the same lego again, select the connected component
                const network = findConnectedComponent(lego);
                setSelectedNetwork(network);
            } else {
                // First click, just select the individual lego
                setSelectedLego(lego);
                setSelectedNetwork(null);
            }
        }
    }

    const handleCanvasClick = () => {
        setSelectedLego(null);
        setSelectedNetwork(null);
    }

    const handleLegMouseDown = (e: React.MouseEvent, legoId: string, legIndex: number) => {
        e.preventDefault();
        e.stopPropagation();
        const rect = canvasRef.current?.getBoundingClientRect();
        if (!rect) return;

        setLegDragState({
            isDragging: true,
            legoId,
            legIndex,
            startX: e.clientX - rect.left,
            startY: e.clientY - rect.top
        });
    };

    const handleCanvasMouseMove = (e: React.MouseEvent) => {
        e.preventDefault();
        if (dragState.isDragging) {
            const rect = canvasRef.current?.getBoundingClientRect();
            if (!rect) return;

            const deltaX = e.clientX - dragState.startX;
            const deltaY = e.clientY - dragState.startY;
            const newX = dragState.originalX + deltaX;
            const newY = dragState.originalY + deltaY;

            // Check if any part of the lego touches the canvas edges (considering 25px radius)
            const isOutsideCanvas =
                newX - 25 < 0 ||
                newX + 25 > rect.width ||
                newY - 25 < 0 ||
                newY + 25 > rect.height;

            setDroppedLegos(prev => prev.map((lego, index) => {
                if (index === dragState.draggedLegoIndex) {
                    return {
                        ...lego,
                        x: newX,
                        y: newY
                    }
                }
                return lego
            }));

            // Add visual feedback when touching edges
            const canvas = canvasRef.current;
            if (canvas) {
                canvas.style.boxShadow = isOutsideCanvas ? 'inset 0 0 0 4px #FC8181' : 'inset 0 0 6px rgba(0, 0, 0, 0.1)';
            }
        }

        // Handle leg dragging
        if (legDragState?.isDragging) {
            const rect = canvasRef.current?.getBoundingClientRect();
            if (rect) {
                setLegDragState(prev => ({
                    ...prev!,
                    startX: e.clientX - rect.left,
                    startY: e.clientY - rect.top
                }));
            }
        }
    };

    const handleCanvasMouseUp = (e: React.MouseEvent) => {
        const rect = canvasRef.current?.getBoundingClientRect();
        if (!rect) {
            setLegDragState(null);
            return;
        }

        if (dragState.isDragging) {
            const deltaX = e.clientX - dragState.startX;
            const deltaY = e.clientY - dragState.startY;
            const newX = dragState.originalX + deltaX;
            const newY = dragState.originalY + deltaY;

            const isOutsideCanvas =
                newX - 25 < 0 ||
                newX + 25 > rect.width ||
                newY - 25 < 0 ||
                newY + 25 > rect.height;

            if (isOutsideCanvas) {
                const legoToRemove = droppedLegos[dragState.draggedLegoIndex];
                const connectionsToRemove = connections.filter(conn =>
                    conn.from.legoId === legoToRemove.instanceId || conn.to.legoId === legoToRemove.instanceId
                );

                // Add to history before removing
                addToHistory({
                    type: 'remove',
                    data: {
                        legos: [legoToRemove],
                        connections: connectionsToRemove
                    }
                });

                setConnections(prev => prev.filter(conn =>
                    conn.from.legoId !== legoToRemove.instanceId && conn.to.legoId !== legoToRemove.instanceId
                ));
                setDroppedLegos(prev => prev.filter((_, index) => index !== dragState.draggedLegoIndex));

                if (selectedLego?.instanceId === legoToRemove.instanceId) {
                    setSelectedLego(null);
                }
                if (selectedNetwork?.legos.some(l => l.instanceId === legoToRemove.instanceId)) {
                    setSelectedNetwork(null);
                }
            } else if (deltaX !== 0 || deltaY !== 0) {
                // Record move operation only if the piece actually moved
                addToHistory({
                    type: 'move',
                    data: {
                        legoInstanceId: droppedLegos[dragState.draggedLegoIndex].instanceId,
                        oldX: dragState.originalX,
                        oldY: dragState.originalY,
                        newX,
                        newY
                    }
                });
            }

            // Reset canvas visual feedback
            const canvas = canvasRef.current;
            if (canvas) {
                canvas.style.boxShadow = 'inset 0 0 6px rgba(0, 0, 0, 0.1)';
            }
        }

        // Handle leg connection
        if (legDragState?.isDragging) {
            const mouseX = e.clientX - rect.left;
            const mouseY = e.clientY - rect.top;

            // Find if we're over another leg
            const targetLego = droppedLegos.find(lego => {
                if (lego.instanceId === legDragState.legoId) return false;

                const legCount = lego.parity_check_matrix[0].length / 2;
                for (let i = 0; i < legCount; i++) {
                    const legEndpoint = getLegEndpoint(lego, i);

                    const distance = Math.sqrt(
                        Math.pow(mouseX - legEndpoint.x, 2) +
                        Math.pow(mouseY - legEndpoint.y, 2)
                    );
                    if (distance < 10) {
                        const connectionExists = connections.some(conn =>
                            (conn.from.legoId === legDragState.legoId && conn.from.legIndex === legDragState.legIndex &&
                                conn.to.legoId === lego.instanceId && conn.to.legIndex === i) ||
                            (conn.from.legoId === lego.instanceId && conn.from.legIndex === i &&
                                conn.to.legoId === legDragState.legoId && conn.to.legIndex === legDragState.legIndex)
                        );

                        if (!connectionExists) {
                            const newConnection = {
                                from: {
                                    legoId: legDragState.legoId,
                                    legIndex: legDragState.legIndex
                                },
                                to: {
                                    legoId: lego.instanceId,
                                    legIndex: i
                                }
                            };

                            setConnections(prev => [...prev, newConnection]);
                            addToHistory({
                                type: 'connect',
                                data: { connections: [newConnection] }
                            });
                            return true;
                        }
                    }
                }
                return false;
            });
        }

        setLegDragState(null);
        setDragState(prev => ({
            ...prev,
            isDragging: false,
            draggedLegoIndex: -1
        }));
    };

    const handleCanvasMouseLeave = () => {
        if (dragState.isDragging) {
            setLegDragState(null);
            setDragState(prev => ({
                ...prev,
                isDragging: false,
                draggedLegoIndex: -1
            }));
        }
    }

    const getLegEndpoint = (lego: DroppedLego, legIndex: number) => {
        const angle = (2 * Math.PI * legIndex) / (lego.parity_check_matrix[0].length / 2);
        const legLength = 40;
        return {
            x: lego.x + legLength * Math.cos(angle),
            y: lego.y + legLength * Math.sin(angle)
        };
    };

    // Add this new function to find connected components
    const findConnectedComponent = (startLego: DroppedLego) => {
        const visited = new Set<string>();
        const component: DroppedLego[] = [];
        const componentConnections: Connection[] = [];

        const dfs = (legoId: string) => {
            if (visited.has(legoId)) return;
            visited.add(legoId);

            const lego = droppedLegos.find(l => l.instanceId === legoId);
            if (!lego) return;
            component.push(lego);

            // Find all connections involving this lego
            connections.forEach(conn => {
                if (conn.from.legoId === legoId && !visited.has(conn.to.legoId)) {
                    componentConnections.push(conn);
                    dfs(conn.to.legoId);
                } else if (conn.to.legoId === legoId && !visited.has(conn.from.legoId)) {
                    componentConnections.push(conn);
                    dfs(conn.from.legoId);
                }
            });
        };

        dfs(startLego.instanceId);
        return { legos: component, connections: componentConnections };
    };

    // Update addToHistory to clear redo stack when new operations are added
    const addToHistory = (operation: Operation) => {
        setOperationHistory(prev => [...prev, operation]);
        setRedoHistory([]); // Clear redo stack when new operation is performed
    };

    // Handle undo
    const handleUndo = useCallback(() => {
        if (operationHistory.length === 0) return;

        const lastOperation = operationHistory[operationHistory.length - 1];

        // Move the operation to redo history before undoing
        setRedoHistory(prev => [...prev, lastOperation]);

        switch (lastOperation.type) {
            case 'add':
                if (lastOperation.data.legos) {
                    const legoToRemove = lastOperation.data.legos[0];
                    setDroppedLegos(prev => prev.filter(lego => lego.instanceId !== legoToRemove.instanceId));
                }
                break;
            case 'remove':
                if (lastOperation.data.legos && lastOperation.data.connections) {
                    setDroppedLegos(prev => [...prev, ...(lastOperation.data.legos || [])]);
                    setConnections(prev => [...prev, ...(lastOperation.data.connections || [])]);
                }
                break;
            case 'move':
                if (lastOperation.data.legoInstanceId && lastOperation.data.oldX !== undefined && lastOperation.data.oldY !== undefined) {
                    setDroppedLegos(prev => prev.map(lego =>
                        lego.instanceId === lastOperation.data.legoInstanceId
                            ? { ...lego, x: lastOperation.data.oldX!, y: lastOperation.data.oldY! }
                            : lego
                    ));
                }
                break;
            case 'connect':
                if (lastOperation.data.connections) {
                    const connectionToRemove = lastOperation.data.connections[0];
                    setConnections(prev => prev.filter(conn =>
                        !(conn.from.legoId === connectionToRemove.from.legoId &&
                            conn.from.legIndex === connectionToRemove.from.legIndex &&
                            conn.to.legoId === connectionToRemove.to.legoId &&
                            conn.to.legIndex === connectionToRemove.to.legIndex)
                    ));
                }
                break;
            case 'disconnect':
                if (lastOperation.data.connections) {
                    setConnections(prev => [...prev, ...(lastOperation.data.connections || [])]);
                }
                break;
        }

        setOperationHistory(prev => prev.slice(0, -1));
    }, [operationHistory]);

    // Handle redo
    const handleRedo = useCallback(() => {
        if (redoHistory.length === 0) return;

        const nextOperation = redoHistory[redoHistory.length - 1];

        switch (nextOperation.type) {
            case 'add':
                if (nextOperation.data.legos) {
                    const legoToAdd = nextOperation.data.legos[0];
                    setDroppedLegos(prev => [...prev, legoToAdd]);
                }
                break;
            case 'remove':
                if (nextOperation.data.legos) {
                    const legoToRemove = nextOperation.data.legos[0];
                    setDroppedLegos(prev => prev.filter(lego => lego.instanceId !== legoToRemove.instanceId));
                    setConnections(prev => prev.filter(conn =>
                        conn.from.legoId !== legoToRemove.instanceId && conn.to.legoId !== legoToRemove.instanceId
                    ));
                }
                break;
            case 'move':
                if (nextOperation.data.legoInstanceId && nextOperation.data.newX !== undefined && nextOperation.data.newY !== undefined) {
                    setDroppedLegos(prev => prev.map(lego =>
                        lego.instanceId === nextOperation.data.legoInstanceId
                            ? { ...lego, x: nextOperation.data.newX!, y: nextOperation.data.newY! }
                            : lego
                    ));
                }
                break;
            case 'connect':
                if (nextOperation.data.connections) {
                    setConnections(prev => [...prev, ...(nextOperation.data.connections || [])]);
                }
                break;
            case 'disconnect':
                if (nextOperation.data.connections) {
                    const connectionToRemove = nextOperation.data.connections[0];
                    setConnections(prev => prev.filter(conn =>
                        !(conn.from.legoId === connectionToRemove.from.legoId &&
                            conn.from.legIndex === connectionToRemove.from.legIndex &&
                            conn.to.legoId === connectionToRemove.to.legoId &&
                            conn.to.legIndex === connectionToRemove.to.legIndex)
                    ));
                }
                break;
        }

        // Move the operation back to the history stack
        setOperationHistory(prev => [...prev, nextOperation]);
        setRedoHistory(prev => prev.slice(0, -1));
    }, [redoHistory]);

    // Update keyboard event listener for both Ctrl+Z and Ctrl+Y
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
                e.preventDefault();
                handleUndo();
            } else if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.shiftKey && e.key === 'Z'))) {
                e.preventDefault();
                handleRedo();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [handleUndo, handleRedo]);

    const handleConnectionDoubleClick = (e: React.MouseEvent, connection: Connection) => {
        e.preventDefault();
        e.stopPropagation();

        // Add to history before removing
        addToHistory({
            type: 'disconnect',
            data: { connections: [connection] }
        });

        // Remove the connection
        setConnections(prev => prev.filter(conn =>
            !(conn.from.legoId === connection.from.legoId &&
                conn.from.legIndex === connection.from.legIndex &&
                conn.to.legoId === connection.to.legoId &&
                conn.to.legIndex === connection.to.legIndex)
        ));
    };

    return (
        <HStack spacing={0} align="stretch" h="100vh">
            {/* Left Panel */}
            <Box
                w="300px"
                p={4}
                borderRight="1px"
                borderColor={borderColor}
                bg={bgColor}
                overflowY="auto"
            >
                <VStack align="stretch" spacing={4}>
                    <Heading size="md">Lego Pieces</Heading>
                    <List spacing={3}>
                        {legos.map((lego) => (
                            <ListItem
                                key={lego.id}
                                p={3}
                                borderWidth="1px"
                                borderRadius="md"
                                _hover={{ bg: 'gray.50' }}
                                cursor="move"
                                draggable
                                onDragStart={(e) => handleDragStart(e, lego)}
                            >
                                <HStack spacing={2}>
                                    <Icon as={getLegoIcon(lego.type)} boxSize={5} />
                                    <VStack align="start" spacing={1}>
                                        <Text fontWeight="bold">{lego.name}</Text>
                                        <Text fontSize="sm" color="gray.600">
                                            {lego.description}
                                        </Text>
                                        <HStack>
                                            <Badge colorScheme="blue">{lego.type}</Badge>
                                            {lego.is_dynamic && (
                                                <Badge colorScheme="green">Dynamic</Badge>
                                            )}
                                        </HStack>
                                    </VStack>
                                </HStack>
                            </ListItem>
                        ))}
                    </List>
                </VStack>
            </Box>

            {/* Main Content */}
            <Box flex={1} display="flex" flexDirection="column" p={4}>
                {/* Status Bar */}
                <Box p={2} borderWidth={1} borderRadius="lg" mb={4}>
                    <Text fontSize="sm">Backend Status: {message}</Text>
                </Box>

                {/* Gray Panel */}
                <Box
                    ref={canvasRef}
                    flex={1}
                    bg="gray.100"
                    borderRadius="lg"
                    boxShadow="inner"
                    position="relative"
                    onDragOver={handleDragOver}
                    onDrop={handleDrop}
                    onMouseMove={handleCanvasMouseMove}
                    onMouseUp={handleCanvasMouseUp}
                    onMouseLeave={handleCanvasMouseLeave}
                    onClick={handleCanvasClick}
                    style={{ userSelect: 'none' }}
                >
                    {/* Connection Lines */}
                    <svg
                        style={{
                            position: 'absolute',
                            top: 0,
                            left: 0,
                            width: '100%',
                            height: '100%',
                            pointerEvents: 'none',
                            userSelect: 'none'
                        }}
                    >
                        {/* Existing connections */}
                        <g style={{ pointerEvents: 'all' }}>
                            {connections.map((conn, index) => {
                                const fromLego = droppedLegos.find(l => l.instanceId === conn.from.legoId);
                                const toLego = droppedLegos.find(l => l.instanceId === conn.to.legoId);
                                if (!fromLego || !toLego) return null;

                                const fromPoint = getLegEndpoint(fromLego, conn.from.legIndex);
                                const toPoint = getLegEndpoint(toLego, conn.to.legIndex);

                                return (
                                    <g key={`conn-${index}`}>
                                        {/* Invisible wider line for easier clicking */}
                                        <line
                                            x1={fromPoint.x}
                                            y1={fromPoint.y}
                                            x2={toPoint.x}
                                            y2={toPoint.y}
                                            stroke="transparent"
                                            strokeWidth="10"
                                            style={{ cursor: 'pointer' }}
                                            onDoubleClick={(e) => handleConnectionDoubleClick(e, conn)}
                                        />
                                        {/* Visible line */}
                                        <line
                                            x1={fromPoint.x}
                                            y1={fromPoint.y}
                                            x2={toPoint.x}
                                            y2={toPoint.y}
                                            stroke="#3182CE"
                                            strokeWidth="2"
                                            style={{ pointerEvents: 'none' }}
                                        />
                                    </g>
                                );
                            })}
                        </g>

                        {/* Temporary line while dragging */}
                        {legDragState?.isDragging && (() => {
                            const fromLego = droppedLegos.find(l => l.instanceId === legDragState.legoId);
                            if (!fromLego) return null;

                            const fromPoint = getLegEndpoint(fromLego, legDragState.legIndex);

                            return (
                                <line
                                    x1={fromPoint.x}
                                    y1={fromPoint.y}
                                    x2={legDragState.startX}
                                    y2={legDragState.startY}
                                    stroke="#3182CE"
                                    strokeWidth="2"
                                    strokeDasharray="4"
                                    opacity={0.5}
                                />
                            );
                        })()}

                        {/* Leg Labels */}
                        {droppedLegos.map((lego) => (
                            Array(lego.parity_check_matrix[0].length / 2).fill(0).map((_, legIndex) => {
                                const angle = (2 * Math.PI * legIndex) / (lego.parity_check_matrix[0].length / 2);
                                const legLength = 40;
                                const labelX = lego.x + (legLength + 10) * Math.cos(angle);
                                const labelY = lego.y + (legLength + 10) * Math.sin(angle);

                                return (
                                    <text
                                        key={`${lego.instanceId}-label-${legIndex}`}
                                        x={labelX}
                                        y={labelY}
                                        fontSize="12"
                                        fill="#666666"
                                        textAnchor="middle"
                                        dominantBaseline="middle"
                                        style={{ pointerEvents: 'none' }}
                                    >
                                        {legIndex}
                                    </text>
                                );
                            })
                        ))}
                    </svg>

                    {droppedLegos.map((lego, index) => (
                        <Box
                            key={`${lego.instanceId}`}
                            position="absolute"
                            left={`${lego.x - 25}px`}
                            top={`${lego.y - 25}px`}
                            style={{ userSelect: 'none' }}
                        >
                            {/* Legs */}
                            {Array(lego.parity_check_matrix[0].length / 2).fill(0).map((_, legIndex) => {
                                const angle = (2 * Math.PI * legIndex) / (lego.parity_check_matrix[0].length / 2);
                                const legLength = 40;
                                const endX = 25 + legLength * Math.cos(angle);
                                const endY = 25 + legLength * Math.sin(angle);

                                const isBeingDragged = legDragState?.isDragging &&
                                    legDragState.legoId === lego.instanceId &&
                                    legDragState.legIndex === legIndex;

                                return (
                                    <Box key={`leg-${legIndex}`} position="absolute" style={{ pointerEvents: 'none' }}>
                                        {/* Line */}
                                        <Box
                                            position="absolute"
                                            left="25px"
                                            top="25px"
                                            w={`${legLength}px`}
                                            h="2px"
                                            bg="gray.400"
                                            transformOrigin="0 0"
                                            style={{
                                                transform: `rotate(${angle}rad)`,
                                                pointerEvents: 'none'
                                            }}
                                        />
                                        {/* Draggable Endpoint */}
                                        <Box
                                            position="absolute"
                                            left={`${endX}px`}
                                            top={`${endY}px`}
                                            w="10px"
                                            h="10px"
                                            borderRadius="full"
                                            bg={isBeingDragged ? "blue.100" : "white"}
                                            border="2px"
                                            borderColor={isBeingDragged ? "blue.500" : "gray.400"}
                                            transform="translate(-50%, -50%)"
                                            cursor="pointer"
                                            onMouseDown={(e) => handleLegMouseDown(e, lego.instanceId, legIndex)}
                                            _hover={{ borderColor: "blue.400", bg: "blue.50" }}
                                            transition="all 0.2s"
                                            style={{ pointerEvents: 'all' }}
                                        />
                                    </Box>
                                );
                            })}
                            {/* Main Circle */}
                            <Box
                                w="50px"
                                h="50px"
                                borderRadius="full"
                                bg={
                                    selectedNetwork?.legos.some(l => l.instanceId === lego.instanceId)
                                        ? "blue.200"
                                        : selectedLego?.instanceId === lego.instanceId
                                            ? "blue.100"
                                            : "white"
                                }
                                border="2px"
                                borderColor={
                                    selectedNetwork?.legos.some(l => l.instanceId === lego.instanceId)
                                        ? "blue.600"
                                        : selectedLego?.instanceId === lego.instanceId
                                            ? "blue.500"
                                            : "blue.400"
                                }
                                display="flex"
                                alignItems="center"
                                justifyContent="center"
                                cursor={dragState.isDragging && dragState.draggedLegoIndex === index ? "grabbing" : "grab"}
                                title={lego.name}
                                boxShadow="md"
                                _hover={{ boxShadow: "lg" }}
                                onMouseDown={(e) => handleLegoMouseDown(e, index)}
                                onClick={(e) => handleLegoClick(e, lego)}
                                style={{
                                    transform: dragState.isDragging && dragState.draggedLegoIndex === index
                                        ? 'scale(1.05)'
                                        : 'scale(1)',
                                    transition: 'transform 0.1s',
                                    userSelect: 'none',
                                    touchAction: 'none'
                                }}
                                position="relative"
                                zIndex={1}
                            >
                                <Box style={{ pointerEvents: 'none', userSelect: 'none' }}>
                                    <Text fontSize="xs" fontWeight="bold" noOfLines={1}>
                                        {lego.shortName}
                                    </Text>
                                </Box>
                            </Box>
                        </Box>
                    ))}
                </Box>
            </Box>

            {/* Right Panel */}
            <Box
                w="400px"
                p={4}
                borderLeft="1px"
                borderColor={borderColor}
                bg={bgColor}
                overflowY="auto"
                display={selectedLego || selectedNetwork ? "block" : "none"}
            >
                <VStack align="stretch" spacing={4}>
                    {selectedNetwork ? (
                        <>
                            <Heading size="md">Tensor Network</Heading>
                            <Text>Selected components: {selectedNetwork.legos.length} Legos</Text>
                            <Button
                                colorScheme="blue"
                                onClick={() => {
                                    // TODO: Implement parity check calculation
                                    console.log("Calculate conjoined parity check");
                                }}
                            >
                                Calculate Conjoined Parity Check
                            </Button>
                            <Button
                                colorScheme="green"
                                onClick={() => {
                                    // TODO: Implement Python code export
                                    console.log("Export Python code");
                                }}
                            >
                                Export Python Code
                            </Button>
                        </>
                    ) : selectedLego && (
                        <>
                            <Heading size="md">Matrix Details</Heading>
                            <VStack align="stretch" spacing={3}>
                                <Text fontWeight="bold">{selectedLego.name}</Text>
                                <Text fontSize="sm" color="gray.600">
                                    {selectedLego.description}
                                </Text>
                                <Box overflowX="auto">
                                    <Table size="sm" variant="simple">
                                        <Thead>
                                            <Tr>
                                                {selectedLego.parity_check_matrix[0] && (
                                                    <>
                                                        <Td
                                                            p={2}
                                                            textAlign="center"
                                                            borderWidth={0}
                                                            colSpan={selectedLego.parity_check_matrix[0].length / 2}
                                                            fontWeight="bold"
                                                            color="blue.600"
                                                        >
                                                            X
                                                        </Td>
                                                        <Td
                                                            p={2}
                                                            textAlign="center"
                                                            borderWidth={0}
                                                            colSpan={selectedLego.parity_check_matrix[0].length / 2}
                                                            fontWeight="bold"
                                                            color="red.600"
                                                        >
                                                            Z
                                                        </Td>
                                                    </>
                                                )}
                                            </Tr>
                                            <Tr>
                                                {selectedLego.parity_check_matrix[0] && (
                                                    <>
                                                        {/* X indices */}
                                                        {Array(selectedLego.parity_check_matrix[0].length / 2).fill(0).map((_, i) => (
                                                            <Td
                                                                key={`x-idx-${i}`}
                                                                p={2}
                                                                textAlign="center"
                                                                borderWidth={0}
                                                                colSpan={1}
                                                                fontSize="sm"
                                                                color="gray.600"
                                                            >
                                                                {i}
                                                            </Td>
                                                        ))}
                                                        {/* Z indices */}
                                                        {Array(selectedLego.parity_check_matrix[0].length / 2).fill(0).map((_, i) => (
                                                            <Td
                                                                key={`z-idx-${i}`}
                                                                p={2}
                                                                textAlign="center"
                                                                borderWidth={0}
                                                                colSpan={1}
                                                                fontSize="sm"
                                                                color="gray.600"
                                                            >
                                                                {i}
                                                            </Td>
                                                        ))}
                                                    </>
                                                )}
                                            </Tr>
                                        </Thead>
                                        <Tbody>
                                            {selectedLego.parity_check_matrix.map((row, rowIndex) => (
                                                <Tr key={rowIndex}>
                                                    {row.map((cell, cellIndex) => {
                                                        const isMiddle = cellIndex === row.length / 2 - 1;
                                                        return (
                                                            <Td
                                                                key={cellIndex}
                                                                p={2}
                                                                textAlign="center"
                                                                bg={cell === 1 ? "blue.100" : "transparent"}
                                                                borderWidth={1}
                                                                borderColor="gray.200"
                                                                borderRightWidth={isMiddle ? 3 : 1}
                                                                borderRightColor={isMiddle ? "gray.400" : "gray.200"}
                                                            >
                                                                {cell}
                                                            </Td>
                                                        )
                                                    })}
                                                </Tr>
                                            ))}
                                        </Tbody>
                                    </Table>
                                </Box>
                            </VStack>
                        </>
                    )}
                </VStack>
            </Box>
        </HStack>
    )
}

export default App 