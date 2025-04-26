import { Box, Text, VStack, HStack, useColorModeValue, Button, Menu, MenuButton, MenuList, MenuItem, useClipboard, MenuItemOption, useToast } from '@chakra-ui/react'
import { useEffect, useState, useRef, useCallback } from 'react'
import { Panel, PanelGroup } from 'react-resizable-panels'
import axios from 'axios'
import { getLegoStyle } from './LegoStyles'
import ErrorPanel from './components/ErrorPanel'
import LegoPanel from './components/LegoPanel'
import { Connection, DroppedLego, LegoPiece, LegDragState, DragState, TensorNetwork, GroupDragState, SelectionBoxState, PauliOperator, CanvasDragState } from './types'
import DetailsPanel from './components/DetailsPanel'
import { ResizeHandle } from './components/ResizeHandle'
import { CanvasStateSerializer } from './utils/CanvasStateSerializer'
import { DroppedLegoDisplay, calculateLegPosition } from './components/DroppedLegoDisplay'
import { DynamicLegoDialog } from './components/DynamicLegoDialog'
import { TannerDialog } from './components/TannerDialog'
import { OperationHistory } from './utils/OperationHistory'
import { FuseLegos } from './transformations/FuseLegos'
import { InjectTwoLegged } from './transformations/InjectTwoLegged'
import { AddStopper } from './transformations/AddStopper'
import { findConnectedComponent } from './utils/TensorNetwork'

// Add these helper functions near the top of the file
const pointToLineDistance = (x: number, y: number, x1: number, y1: number, x2: number, y2: number) => {
    const A = x - x1;
    const B = y - y1;
    const C = x2 - x1;
    const D = y2 - y1;

    const dot = A * C + B * D;
    const len_sq = C * C + D * D;
    let param = -1;
    if (len_sq !== 0) {
        param = dot / len_sq;
    }

    let xx, yy;

    if (param < 0) {
        xx = x1;
        yy = y1;
    } else if (param > 1) {
        xx = x2;
        yy = y2;
    } else {
        xx = x1 + param * C;
        yy = y1 + param * D;
    }

    const dx = x - xx;
    const dy = y - yy;
    return Math.sqrt(dx * dx + dy * dy);
};

const isScalarLego = (lego: DroppedLego) => {
    return lego.parity_check_matrix.length === 1 && lego.parity_check_matrix[0].length === 1;
}

// Add this before the App component
function findClosestDanglingLeg(dropPosition: { x: number, y: number }, droppedLegos: DroppedLego[], connections: Connection[]): { lego: DroppedLego, legIndex: number } | null {
    let closestLego: DroppedLego | null = null;
    let closestLegIndex: number = -1;
    let minDistance = Infinity;

    droppedLegos.forEach(lego => {
        const totalLegs = lego.parity_check_matrix[0].length / 2;
        for (let legIndex = 0; legIndex < totalLegs; legIndex++) {
            // Skip if leg is already connected
            const isConnected = connections.some(conn =>
                (conn.from.legoId === lego.instanceId && conn.from.legIndex === legIndex) ||
                (conn.to.legoId === lego.instanceId && conn.to.legIndex === legIndex)
            );
            if (isConnected) continue;

            const pos = calculateLegPosition(lego, legIndex);
            const legX = lego.x + pos.endX;
            const legY = lego.y + pos.endY;
            const distance = Math.sqrt(Math.pow(dropPosition.x - legX, 2) + Math.pow(dropPosition.y - legY, 2));

            if (distance < minDistance && distance < 20) { // 20 pixels threshold
                minDistance = distance;
                closestLego = lego;
                closestLegIndex = legIndex;
            }
        }
    });

    return closestLego && closestLegIndex !== -1 ? { lego: closestLego, legIndex: closestLegIndex } : null;
}


function App() {
    const newInstanceId = (currentLegos: DroppedLego[]): string => {
        const maxInstanceId = currentLegos.length > 0 ? (Math.max(...currentLegos.map(lego => parseInt(lego.instanceId)))) : 0
        return String(maxInstanceId + 1)
    }

    const [altKeyPressed, setAltKeyPressed] = useState(false);
    const [message, setMessage] = useState<string>('Loading...')
    const [legos, setLegos] = useState<LegoPiece[]>([])
    const [droppedLegos, setDroppedLegos] = useState<DroppedLego[]>([])
    const [connections, setConnections] = useState<Connection[]>([])
    const [error, setError] = useState<string>('')
    const [selectedLego, setSelectedLego] = useState<DroppedLego | null>(null)
    const [legDragState, setLegDragState] = useState<LegDragState | null>(null)
    const [canvasDragState, setCanvasDragState] = useState<CanvasDragState>({
        isDragging: false,
        startX: 0,
        startY: 0,
        currentX: 0,
        currentY: 0
    })
    const [dragState, setDragState] = useState<DragState>({
        isDragging: false,
        draggedLegoIndex: -1,
        startX: 0,
        startY: 0,
        originalX: 0,
        originalY: 0,
        justFinished: false
    })
    const [zoomLevel, setZoomLevel] = useState(1)
    const canvasRef = useRef<HTMLDivElement>(null)
    const stateSerializerRef = useRef<CanvasStateSerializer>(new CanvasStateSerializer([]))
    const [tensorNetwork, setTensorNetwork] = useState<TensorNetwork | null>(null)
    const [operationHistory] = useState<OperationHistory>(new OperationHistory([]))
    const [mousePosition, setMousePosition] = useState<{ x: number, y: number } | null>(null);

    const [groupDragState, setGroupDragState] = useState<GroupDragState | null>(null)
    const [selectionBox, setSelectionBox] = useState<SelectionBoxState>({
        isSelecting: false,
        startX: 0,
        startY: 0,
        currentX: 0,
        currentY: 0,
        justFinished: false
    });
    const [parityCheckMatrixCache] = useState<Map<string, number[][]>>(new Map())
    const [weightEnumeratorCache] = useState<Map<string, string>>(new Map())
    const { onCopy: onCopyCode } = useClipboard("")
    const [isBackendHealthy, setIsBackendHealthy] = useState<boolean>(false)
    const [isDialogOpen, setIsDialogOpen] = useState(false)
    const [selectedDynamicLego, setSelectedDynamicLego] = useState<LegoPiece | null>(null)
    const [pendingDropPosition, setPendingDropPosition] = useState<{ x: number; y: number } | null>(null)
    const [isCssTannerDialogOpen, setIsCssTannerDialogOpen] = useState(false)
    const [isTannerDialogOpen, setIsTannerDialogOpen] = useState(false)
    const [isMspDialogOpen, setIsMspDialogOpen] = useState(false)
    const [hideConnectedLegs, setHideConnectedLegs] = useState(false)
    const bgColor = useColorModeValue('white', 'gray.800')
    const borderColor = useColorModeValue('gray.200', 'gray.600')
    const [isLegoPanelCollapsed, setIsLegoPanelCollapsed] = useState(false);
    const [hoveredConnection, setHoveredConnection] = useState<Connection | null>(null);
    const [draggedLego, setDraggedLego] = useState<LegoPiece | null>(null);

    const [showCustomLegoDialog, setShowCustomLegoDialog] = useState(false);
    const [customLegoPosition, setCustomLegoPosition] = useState({ x: 0, y: 0 });

    // Inside the App component, add this line near the other hooks
    const toast = useToast();

    // Update the serializer when legos change
    useEffect(() => {
        stateSerializerRef.current.updateLegos(legos)
    }, [legos])

    const encodeCanvasState = useCallback((pieces: DroppedLego[], conns: Connection[], hideConnectedLegs: boolean) => {
        // console.log("Encoding droppedLegos", pieces, "connections", conns);
        // Print call stack for debugging
        // console.log('Canvas state encoding call stack:', new Error("just debugging").stack);
        stateSerializerRef.current.encode(pieces, conns, hideConnectedLegs)
    }, [])

    const decodeCanvasState = useCallback(async (encoded: string) => {
        return stateSerializerRef.current.decode(encoded)
    }, [])


    // Add checkBackendHealth function
    const checkBackendHealth = useCallback(async () => {
        try {
            const response = await axios.get('/api/health')
            setMessage(response.data.message)
            setIsBackendHealthy(true)
            setError('') // Clear any previous backend errors
        } catch (error) {
            setMessage('Error connecting to backend')
            setIsBackendHealthy(false)
            setError('Backend connection lost')
            console.error('Backend health check failed:', error)
        }
    }, [])

    // Add periodic health check effect
    useEffect(() => {
        // Initial health check
        checkBackendHealth()

        // Set up periodic health check every 30 seconds
        const healthCheckInterval = setInterval(checkBackendHealth, 10000)

        // Cleanup interval on component unmount
        return () => clearInterval(healthCheckInterval)
    }, [checkBackendHealth])

    useEffect(() => {
        const fetchData = async () => {
            try {
                const legosResponse = await axios.get('/api/legos')
                setLegos(legosResponse.data)
            } catch (error) {
                setError('Failed to fetch legos')
                console.error('Error:', error)
            }
        }

        // Only fetch legos if backend is healthy
        if (isBackendHealthy) {
            fetchData()
        }
    }, [isBackendHealthy]) // Depend on backend health status

    // Add a new effect to handle initial URL state
    useEffect(() => {
        const handleHashChange = async () => {
            const hashParams = new URLSearchParams(window.location.hash.slice(1))
            const stateParam = hashParams.get('state')
            if (stateParam) {
                const decodedState = await decodeCanvasState(stateParam)
                setDroppedLegos(decodedState.pieces)
                setConnections(decodedState.connections)
                setHideConnectedLegs(decodedState.hideConnectedLegs)
            }
        }

        // Listen for hash changes
        window.addEventListener('hashchange', handleHashChange)

        // Initial load
        handleHashChange()

        // Cleanup
        return () => window.removeEventListener('hashchange', handleHashChange)
    }, [decodeCanvasState])

    // Add mouse position tracking
    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            const canvasPanel = document.querySelector('#main-panel');
            if (!canvasPanel) return;

            const canvasRect = canvasPanel.getBoundingClientRect();
            const isOverCanvas = e.clientX >= canvasRect.left &&
                e.clientX <= canvasRect.right &&
                e.clientY >= canvasRect.top &&
                e.clientY <= canvasRect.bottom;

            if (isOverCanvas) {
                setMousePosition({
                    x: e.clientX - canvasRect.left,
                    y: e.clientY - canvasRect.top
                });
            } else {
                setMousePosition(null);
            }
        };

        window.addEventListener('mousemove', handleMouseMove);
        return () => window.removeEventListener('mousemove', handleMouseMove);
    }, []);

    const handleDragStart = (e: React.DragEvent<HTMLLIElement>, lego: LegoPiece) => {
        if (lego.id === 'custom') {
            // Store the drop position for the custom lego
            const rect = e.currentTarget.getBoundingClientRect();
            setCustomLegoPosition({
                x: rect.left + rect.width / 2,
                y: rect.top + rect.height / 2
            });
            // Set the draggedLego state for custom legos
            const draggedLego: DroppedLego = {
                ...lego,
                instanceId: newInstanceId(droppedLegos),
                x: rect.left + rect.width / 2,
                y: rect.top + rect.height / 2,
                style: getLegoStyle(lego.id, lego.parity_check_matrix[0].length / 2),
                selectedMatrixRows: []
            };
            setDraggedLego(draggedLego);
        } else {
            // Handle regular lego drag
            const rect = e.currentTarget.getBoundingClientRect();
            const draggedLego: DroppedLego = {
                ...lego,
                instanceId: newInstanceId(droppedLegos),
                x: rect.left + rect.width / 2,
                y: rect.top + rect.height / 2,
                style: getLegoStyle(lego.id, lego.parity_check_matrix[0].length / 2),
                selectedMatrixRows: []
            };
            setDraggedLego(draggedLego);
        }
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();

        // Use the draggedLego state instead of trying to get data from dataTransfer
        if (!draggedLego) return;

        const numLegs = draggedLego.parity_check_matrix[0].length / 2;

        // Only handle two-legged legos
        if (numLegs !== 2) return;

        const rect = e.currentTarget.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        // Find the closest connection
        let closestConnection: Connection | null = null;
        let minDistance = Infinity;

        connections.forEach(conn => {
            const fromLego = droppedLegos.find(l => l.instanceId === conn.from.legoId);
            const toLego = droppedLegos.find(l => l.instanceId === conn.to.legoId);
            if (!fromLego || !toLego) return;

            const fromPos = calculateLegPosition(fromLego, conn.from.legIndex);
            const toPos = calculateLegPosition(toLego, conn.to.legIndex);

            const fromPoint = {
                x: fromLego.x + fromPos.endX,
                y: fromLego.y + fromPos.endY
            };
            const toPoint = {
                x: toLego.x + toPos.endX,
                y: toLego.y + toPos.endY
            };

            // Calculate distance from point to line segment
            const distance = pointToLineDistance(x, y, fromPoint.x, fromPoint.y, toPoint.x, toPoint.y);
            if (distance < minDistance && distance < 20) { // 20 pixels threshold
                minDistance = distance;
                closestConnection = conn;
            }
        });

        setHoveredConnection(closestConnection);
    };

    const handleDropStopperOnConnection = (dropPosition: { x: number, y: number }, draggedLego: LegoPiece): boolean => {
        if (draggedLego.id.includes('stopper')) {
            const closestLeg = findClosestDanglingLeg(dropPosition, droppedLegos, connections);
            if (!closestLeg) return false;

            // Get max instance ID
            const maxInstanceId = Math.max(...droppedLegos.map(l => parseInt(l.instanceId)));

            // Create the stopper lego
            const stopperLego: DroppedLego = {
                ...draggedLego,
                instanceId: (maxInstanceId + 1).toString(),
                x: dropPosition.x,
                y: dropPosition.y,
                style: getLegoStyle(draggedLego.id, 1),
                selectedMatrixRows: []
            };
            try {
                const addStopper = new AddStopper(connections, droppedLegos);
                const result = addStopper.apply(closestLeg.lego, closestLeg.legIndex, stopperLego);
                setConnections(result.connections);
                setDroppedLegos(result.droppedLegos);
                operationHistory.addOperation(result.operation);
                encodeCanvasState(result.droppedLegos, result.connections, hideConnectedLegs);
                return true;
            } catch (error) {
                console.error('Failed to add stopper:', error);
                toast({
                    title: 'Error',
                    description: error instanceof Error ? error.message : 'Failed to add stopper',
                    status: 'error',
                    duration: 3000,
                    isClosable: true,
                });
                return false;
            }
        }
        return false;
    }

    const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
        if (!draggedLego) return;

        const dropPosition = {
            x: e.clientX - e.currentTarget.getBoundingClientRect().left,
            y: e.clientY - e.currentTarget.getBoundingClientRect().top
        };

        if (draggedLego.id === 'custom_lego') {
            setCustomLegoPosition(dropPosition);
            setShowCustomLegoDialog(true);
            return;
        }

        // Find the closest dangling leg if we're dropping a stopper
        const success = handleDropStopperOnConnection(dropPosition, draggedLego);
        if (success) return;

        const numLegs = draggedLego.parity_check_matrix[0].length / 2;

        if (draggedLego.is_dynamic) {
            setSelectedDynamicLego(draggedLego);
            setPendingDropPosition({ x: dropPosition.x, y: dropPosition.y });
            setIsDialogOpen(true);
            setDraggedLego(null);
            return;
        }

        const rect = e.currentTarget.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        const newLego = {
            ...draggedLego,
            x,
            y,
            instanceId: newInstanceId(droppedLegos),
            style: getLegoStyle(draggedLego.id, numLegs),
            selectedMatrixRows: []
        };

        // Handle two-legged lego insertion
        if (numLegs === 2 && hoveredConnection) {
            const trafo = new InjectTwoLegged(connections, droppedLegos);
            trafo.apply(newLego, hoveredConnection).then(({ connections: newConnections, droppedLegos: newDroppedLegos, operation }) => {
                setDroppedLegos(newDroppedLegos);
                setConnections(newConnections);
                operationHistory.addOperation(operation);
                encodeCanvasState(newDroppedLegos, newConnections, hideConnectedLegs);
            }).catch(error => {
                setError(`${error}`);
                console.error(error);
            });
        } else {
            console.log("Dropped lego", newLego);
            // If it's a custom lego, show the dialog after dropping
            if (draggedLego.id === 'custom') {
                setCustomLegoPosition({ x, y });
                setShowCustomLegoDialog(true);
            } else {
                setDroppedLegos(prev => [...prev, newLego]);
                operationHistory.addOperation({
                    type: 'add',
                    data: { legosToAdd: [newLego] }
                });
                encodeCanvasState([...droppedLegos, newLego], connections, hideConnectedLegs);
            }
        }

        setHoveredConnection(null);
        setDraggedLego(null);
    };

    // Add a handler for when drag ends
    const handleDragEnd = () => {
        setDraggedLego(null);
        setHoveredConnection(null);
    };

    const handleDynamicLegoSubmit = async (parameters: Record<string, any>) => {
        if (!selectedDynamicLego || !pendingDropPosition) return;

        try {
            const response = await fetch(`/api/dynamiclego`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    lego_id: selectedDynamicLego.id,
                    parameters,
                }),
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ message: 'Unknown error occurred' }));
                throw new Error(errorData.message || errorData.detail || `Error: ${response.status} ${response.statusText}`);
            }

            const dynamicLego = await response.json();
            const instanceId = newInstanceId(droppedLegos);
            const numLegs = dynamicLego.parity_check_matrix[0].length / 2
            const newLego = {
                ...dynamicLego,
                x: pendingDropPosition.x,
                y: pendingDropPosition.y,
                instanceId,
                style: getLegoStyle(dynamicLego.id, numLegs),
                selectedMatrixRows: []
            };
            setDroppedLegos(prev => [...prev, newLego]);
            operationHistory.addOperation({
                type: 'add',
                data: { legosToAdd: [newLego] }
            });
            encodeCanvasState([...droppedLegos, newLego], connections, hideConnectedLegs);
        } catch (error) {
            setError(error instanceof Error ? error.message : 'Failed to create dynamic lego');
        } finally {
            setIsDialogOpen(false);
            setSelectedDynamicLego(null);
            setPendingDropPosition(null);
        }
    };
    const handleClone = (lego: DroppedLego, clientX: number, clientY: number) => {
        // Check if we're cloning multiple legos
        const legosToClone = tensorNetwork?.legos || [lego];

        // Get a single starting ID for all new legos
        const startingId = parseInt(newInstanceId(droppedLegos));

        // Create a mapping from old instance IDs to new ones
        const instanceIdMap = new Map<string, string>();
        const newLegos = legosToClone.map((l, idx) => {
            const newId = String(startingId + idx);
            instanceIdMap.set(l.instanceId, newId);
            return {
                ...l,
                instanceId: newId,
                x: l.x + 20,
                y: l.y + 20,
            };
        });

        // Clone connections between the selected legos
        const newConnections = connections
            .filter(conn =>
                legosToClone.some(l => l.instanceId === conn.from.legoId) &&
                legosToClone.some(l => l.instanceId === conn.to.legoId)
            )
            .map(conn => (new Connection(
                {
                    legoId: instanceIdMap.get(conn.from.legoId)!,
                    legIndex: conn.from.legIndex
                },
                {
                    legoId: instanceIdMap.get(conn.to.legoId)!,
                    legIndex: conn.to.legIndex
                }
            )));

        // Add new legos and connections
        setDroppedLegos(prev => [...prev, ...newLegos]);
        setConnections(prev => [...prev, ...newConnections]);

        // Set up drag state for the group
        const positions: { [instanceId: string]: { x: number; y: number } } = {};
        newLegos.forEach(l => {
            positions[l.instanceId] = { x: l.x, y: l.y };
        });

        setGroupDragState({
            legoInstanceIds: newLegos.map(l => l.instanceId),
            originalPositions: positions
        });

        // Set up initial drag state for the first lego
        setDragState({
            isDragging: false,
            draggedLegoIndex: droppedLegos.length,
            startX: clientX,
            startY: clientY,
            originalX: lego.x + 20,
            originalY: lego.y + 20,
            justFinished: false
        });

        // Add to history
        operationHistory.addOperation({
            type: 'add',
            data: {
                legosToAdd: newLegos,
                connectionsToAdd: newConnections
            }
        });

        // Update URL state
        encodeCanvasState(droppedLegos.concat(newLegos), connections.concat(newConnections), hideConnectedLegs);
    };
    const handleLegoMouseDown = (e: React.MouseEvent, index: number) => {
        e.preventDefault();
        e.stopPropagation();
        const lego = droppedLegos[index];

        if (e.shiftKey) {
            handleClone(lego, e.clientX, e.clientY);
        } else {

            const isPartOfSelection = tensorNetwork?.legos.some(l => l.instanceId === lego.instanceId);

            if (isPartOfSelection) {
                const selectedLegos = tensorNetwork?.legos || [];
                const currentPositions: { [instanceId: string]: { x: number; y: number } } = {};
                selectedLegos.forEach(l => {
                    currentPositions[l.instanceId] = { x: l.x, y: l.y };
                });

                setGroupDragState({
                    legoInstanceIds: selectedLegos.map(l => l.instanceId),
                    originalPositions: currentPositions
                });
            }

            setDragState({
                isDragging: false,
                draggedLegoIndex: index,
                startX: e.clientX,
                startY: e.clientY,
                originalX: lego.x,
                originalY: lego.y,
                justFinished: false
            });
        }
    };

    const handleLegoClick = (e: React.MouseEvent, lego: DroppedLego) => {
        // Reset the justFinished flag first
        if (dragState.justFinished) {
            setDragState(prev => ({ ...prev, justFinished: false }));
            return; // Skip this click, but be ready for the next one
        }

        if (!dragState.isDragging) {  // Only handle click if not dragging
            e.stopPropagation();

            if (e.ctrlKey || e.metaKey) {
                // Handle Ctrl+click for toggling selection
                if (tensorNetwork) {
                    const isSelected = tensorNetwork.legos.some(l => l.instanceId === lego.instanceId);
                    if (isSelected) {
                        // Remove lego from tensor network
                        const newLegos = tensorNetwork.legos.filter(l => l.instanceId !== lego.instanceId);
                        const newConnections = tensorNetwork.connections.filter(conn =>
                            conn.from.legoId !== lego.instanceId && conn.to.legoId !== lego.instanceId
                        );
                        if (newLegos.length === 0) {
                            setTensorNetwork(null);
                        } else {
                            const newNetwork = {
                                legos: newLegos,
                                connections: newConnections
                            } as TensorNetwork;
                            newNetwork.signature = createNetworkSignature(newNetwork);
                            setTensorNetwork(newNetwork);
                        }
                    } else {
                        // Add lego to tensor network
                        const newLegos = [...tensorNetwork.legos, lego];
                        const newConnections = connections.filter(conn =>
                            newLegos.some(l => l.instanceId === conn.from.legoId) &&
                            newLegos.some(l => l.instanceId === conn.to.legoId)
                        );
                        const newNetwork = {
                            legos: newLegos,
                            connections: newConnections
                        } as TensorNetwork;
                        newNetwork.signature = createNetworkSignature(newNetwork);
                        setTensorNetwork(newNetwork);
                    }
                } else if (selectedLego) {
                    const newNetwork = {
                        legos: [lego, selectedLego],
                        connections: connections.filter(conn =>
                            conn.containsLego(lego.instanceId) && conn.containsLego(selectedLego.instanceId)
                        )
                    } as TensorNetwork;
                    newNetwork.signature = createNetworkSignature(newNetwork);
                    setTensorNetwork(newNetwork);
                    setSelectedLego(null);

                } else {
                    // If no tensor network exists, create one with just this lego
                    const newNetwork = {
                        legos: [lego],
                        connections: []
                    } as TensorNetwork;
                    newNetwork.signature = createNetworkSignature(newNetwork);
                    setTensorNetwork(newNetwork);
                }
                setSelectedLego(null);
            } else {
                // Regular click behavior
                if (tensorNetwork?.legos.some(l => l.instanceId === lego.instanceId)) {
                    setTensorNetwork(null);
                    setSelectedLego(lego);
                } else if (selectedLego?.instanceId === lego.instanceId) {
                    let network = findConnectedComponent(lego, droppedLegos, connections) as TensorNetwork;
                    network.signature = createNetworkSignature(network);
                    setTensorNetwork(network);
                    setSelectedLego(null);
                } else {
                    setSelectedLego(lego);
                    setTensorNetwork(null);
                }
            }
        }
    }


    const handleCanvasClick = (e: React.MouseEvent) => {
        // Only clear selection if clicking directly on canvas (not on a Lego)
        // and not during or right after selection box usage
        if (e.target === e.currentTarget && !selectionBox.isSelecting && !dragState.isDragging && !selectionBox.justFinished) {
            setSelectedLego(null);
            setTensorNetwork(null);
        }
        // Reset the justFinished flag after handling the click
        if (selectionBox.justFinished) {
            setSelectionBox(prev => ({ ...prev, justFinished: false }));
        }
    };

    const handleCanvasMouseDown = (e: React.MouseEvent) => {
        // Only start selection box if clicking directly on canvas (not on a Lego)
        if (e.target === e.currentTarget) {
            const rect = canvasRef.current?.getBoundingClientRect();
            if (!rect) return;

            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;

            if (!e.altKey) {

                setSelectionBox({
                    isSelecting: true,
                    startX: x,
                    startY: y,
                    currentX: x,
                    currentY: y,
                    justFinished: false
                });
            } else {
                setCanvasDragState({
                    isDragging: true,
                    startX: x,
                    startY: y,
                    currentX: x,
                    currentY: y
                });
            }
        }
    };

    const handleLegMouseDown = (e: React.MouseEvent, legoId: string, legIndex: number) => {
        e.preventDefault();
        e.stopPropagation();
        const rect = canvasRef.current?.getBoundingClientRect();
        if (!rect) return;

        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        setLegDragState({
            isDragging: true,
            legoId,
            legIndex,
            startX: x,
            startY: y,
            currentX: x,
            currentY: y
        });
    };

    // Helper function to handle selection box logic
    const handleSelectionBoxUpdate = (left: number, right: number, top: number, bottom: number, e: React.MouseEvent) => {
        // Find Legos within the selection box
        const selectedLegos = droppedLegos.filter(lego => {
            return (
                lego.x >= left &&
                lego.x <= right &&
                lego.y >= top &&
                lego.y <= bottom
            );
        });

        // Update selection state based on the selected Legos
        if (selectedLegos.length === 1) {
            if (e.ctrlKey || e.metaKey) {
                // If Ctrl is pressed, add to existing selection
                if (tensorNetwork) {
                    const newLegos = [...tensorNetwork.legos, ...selectedLegos];
                    const newConnections = connections.filter(conn =>
                        newLegos.some(l => l.instanceId === conn.from.legoId) &&
                        newLegos.some(l => l.instanceId === conn.to.legoId)
                    );
                    const newNetwork = {
                        legos: newLegos,
                        connections: newConnections
                    } as TensorNetwork;
                    newNetwork.signature = createNetworkSignature(newNetwork);
                    setTensorNetwork(newNetwork);
                } else {
                    const newNetwork = {
                        legos: selectedLegos,
                        connections: []
                    } as TensorNetwork;
                    newNetwork.signature = createNetworkSignature(newNetwork);
                    setTensorNetwork(newNetwork);
                }
                setSelectedLego(null);
            } else {
                setSelectedLego(selectedLegos[0]);
                setTensorNetwork(null);
            }
        } else if (selectedLegos.length > 1) {
            if (e.ctrlKey || e.metaKey) {
                // If Ctrl is pressed, add to existing selection
                if (tensorNetwork) {
                    const newLegos = [...tensorNetwork.legos, ...selectedLegos];
                    const newConnections = connections.filter(conn =>
                        newLegos.some(l => l.instanceId === conn.from.legoId) &&
                        newLegos.some(l => l.instanceId === conn.to.legoId)
                    );
                    const newNetwork = {
                        legos: newLegos,
                        connections: newConnections
                    } as TensorNetwork;
                    newNetwork.signature = createNetworkSignature(newNetwork);
                    setTensorNetwork(newNetwork);
                } else {
                    const selectedLegoIds = new Set(selectedLegos.map(lego => lego.instanceId));
                    const internalConnections = connections.filter(conn =>
                        selectedLegoIds.has(conn.from.legoId) &&
                        selectedLegoIds.has(conn.to.legoId)
                    );
                    const newNetwork = {
                        legos: selectedLegos,
                        connections: internalConnections
                    } as TensorNetwork;
                    newNetwork.signature = createNetworkSignature(newNetwork);
                    setTensorNetwork(newNetwork);
                }
                setSelectedLego(null);
            } else {
                // Create a tensor network from the selected legos
                const selectedLegoIds = new Set(selectedLegos.map(lego => lego.instanceId));
                const internalConnections = connections.filter(conn =>
                    selectedLegoIds.has(conn.from.legoId) &&
                    selectedLegoIds.has(conn.to.legoId)
                );
                const newNetwork = {
                    legos: selectedLegos,
                    connections: internalConnections
                } as TensorNetwork;
                newNetwork.signature = createNetworkSignature(newNetwork);
                setSelectedLego(null);
                setTensorNetwork(newNetwork);
            }
        } else {
            if (!(e.ctrlKey || e.metaKey)) {
                setSelectedLego(null);
                setTensorNetwork(null);
            }
        }
    };


    const handleCanvasMouseMove = (e: React.MouseEvent) => {
        e.preventDefault();
        const rect = canvasRef.current?.getBoundingClientRect();

        if (!rect) return;

        // Handle selection box dragging
        if (selectionBox.isSelecting) {
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;

            setSelectionBox(prev => ({
                ...prev,
                currentX: x,
                currentY: y
            }));

            // Calculate selection box bounds
            const left = Math.min(selectionBox.startX, x);
            const right = Math.max(selectionBox.startX, x);
            const top = Math.min(selectionBox.startY, y);
            const bottom = Math.max(selectionBox.startY, y);

            handleSelectionBoxUpdate(left, right, top, bottom, e);
            return;
        }

        if (canvasDragState.isDragging) {
            const newX = e.clientX - rect.left;
            const newY = e.clientY - rect.top;
            const deltaX = newX - canvasDragState.startX;
            const deltaY = newY - canvasDragState.startY;

            setCanvasDragState(prev => ({
                ...prev,
                startX: newX,
                startY: newY,
                currentX: newX,
                currentY: newY
            }));

            const movedLegos = droppedLegos.map(lego => ({
                ...lego,
                x: lego.x + deltaX,
                y: lego.y + deltaY
            }));
            setDroppedLegos(movedLegos);
            encodeCanvasState(movedLegos, connections, hideConnectedLegs);
        }

        // Check if we should start dragging
        if (!dragState.isDragging && dragState.draggedLegoIndex !== -1) {
            const deltaX = e.clientX - dragState.startX;
            const deltaY = e.clientY - dragState.startY;

            // Only start dragging if the mouse has moved more than 3 pixels
            if (Math.abs(deltaX) > 3 || Math.abs(deltaY) > 3) {
                setDragState(prev => ({
                    ...prev,
                    isDragging: true
                }));
            }
            return;
        }

        // Handle Lego dragging
        if (dragState.isDragging) {
            const deltaX = e.clientX - dragState.startX;
            const deltaY = e.clientY - dragState.startY;
            const newX = dragState.originalX + deltaX;
            const newY = dragState.originalY + deltaY;

            // Create a new array with updated positions
            const updatedLegos = droppedLegos.map((lego, index) => {
                if (groupDragState && groupDragState.legoInstanceIds.includes(lego.instanceId)) {
                    // Move all selected legos together
                    const originalPos = groupDragState.originalPositions[lego.instanceId];
                    return {
                        ...lego,
                        x: originalPos.x + deltaX,
                        y: originalPos.y + deltaY
                    };
                } else if (index === dragState.draggedLegoIndex) {
                    return {
                        ...lego,
                        x: newX,
                        y: newY
                    };
                }
                return lego;
            });

            setDroppedLegos(updatedLegos);
            if (groupDragState) {
                if (tensorNetwork) {
                    tensorNetwork.legos = updatedLegos.filter(lego => groupDragState.legoInstanceIds.includes(lego.instanceId));
                }
            } else if (selectedLego && droppedLegos[dragState.draggedLegoIndex]?.instanceId === selectedLego.instanceId) {
                selectedLego.x = newX;
                selectedLego.y = newY;
            }

            // Check if we're hovering over a connection (for two-legged legos) or a dangling leg (for stoppers)
            const draggedLego = updatedLegos[dragState.draggedLegoIndex];
            if (draggedLego) {
                const draggedLegoHasConnections = connections.some(conn => conn.containsLego(draggedLego.instanceId));
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;

                if (draggedLego.parity_check_matrix[0].length / 2 === 2 && !draggedLegoHasConnections) {
                    // Find the closest connection for two-legged legos
                    let closestConnection: Connection | null = null;
                    let minDistance = Infinity;

                    connections.forEach(conn => {
                        const fromLego = droppedLegos.find(l => l.instanceId === conn.from.legoId);
                        const toLego = droppedLegos.find(l => l.instanceId === conn.to.legoId);
                        if (!fromLego || !toLego) return;

                        const fromPos = calculateLegPosition(fromLego, conn.from.legIndex);
                        const toPos = calculateLegPosition(toLego, conn.to.legIndex);

                        const fromPoint = {
                            x: fromLego.x + fromPos.endX,
                            y: fromLego.y + fromPos.endY
                        };
                        const toPoint = {
                            x: toLego.x + toPos.endX,
                            y: toLego.y + toPos.endY
                        };

                        const distance = pointToLineDistance(x, y, fromPoint.x, fromPoint.y, toPoint.x, toPoint.y);
                        if (distance < minDistance && distance < 20) {
                            minDistance = distance;
                            closestConnection = conn;
                        }
                    });

                    setHoveredConnection(closestConnection);
                } else if (draggedLego.id.includes('stopper') && !draggedLegoHasConnections) {
                    // Find the closest dangling leg for stoppers
                    const closestLeg = findClosestDanglingLeg({ x, y }, droppedLegos, connections);
                    if (closestLeg) {
                        const pos = calculateLegPosition(closestLeg.lego, closestLeg.legIndex);
                        const legX = closestLeg.lego.x + pos.endX;
                        const legY = closestLeg.lego.y + pos.endY;
                        const distance = Math.sqrt(Math.pow(x - legX, 2) + Math.pow(y - legY, 2));

                        if (distance < 20) { // 20 pixels threshold
                            setHoveredConnection(new Connection(
                                { legoId: closestLeg.lego.instanceId, legIndex: closestLeg.legIndex },
                                { legoId: draggedLego.instanceId, legIndex: 0 }
                            ));
                        } else {
                            setHoveredConnection(null);
                        }
                    } else {
                        setHoveredConnection(null);
                    }
                }
            }
        }

        // Handle leg dragging
        if (legDragState?.isDragging) {
            const mouseX = e.clientX - rect.left;
            const mouseY = e.clientY - rect.top;

            setLegDragState(prev => ({
                ...prev!,
                currentX: mouseX,
                currentY: mouseY
            }));
        }
    };

    const handleCanvasMouseWheel = (e: React.WheelEvent) => {
        if (altKeyPressed) {
            const newZoomLevel = zoomLevel * Math.pow(1 + Math.sign(e.deltaY) / 10, Math.abs(e.deltaY) / 100)
            const scale = newZoomLevel / zoomLevel
            setZoomLevel(newZoomLevel);
            const centerX = e.currentTarget.getBoundingClientRect().width / 2
            const centerY = e.currentTarget.getBoundingClientRect().height / 2
            const rescaledLegos = droppedLegos.map(lego => ({
                ...lego,
                x: (lego.x - centerX) * scale + centerX,
                y: (lego.y - centerY) * scale + centerY
            }));
            setDroppedLegos(rescaledLegos);
            encodeCanvasState(rescaledLegos, connections, hideConnectedLegs);
        }
    }

    const handleCanvasMouseUp = (e: React.MouseEvent) => {
        const rect = canvasRef.current?.getBoundingClientRect();

        if (!rect) {
            setLegDragState(null);
            return;
        }

        // Handle selection box end
        if (selectionBox.isSelecting) {
            const left = Math.min(selectionBox.startX, selectionBox.currentX);
            const right = Math.max(selectionBox.startX, selectionBox.currentX);
            const top = Math.min(selectionBox.startY, selectionBox.currentY);
            const bottom = Math.max(selectionBox.startY, selectionBox.currentY);

            handleSelectionBoxUpdate(left, right, top, bottom, e);

            setSelectionBox(prev => ({
                ...prev,
                isSelecting: false,
                justFinished: true
            }));
            return;
        }

        if (canvasDragState.isDragging) {
            const newCanvasDragState = {
                isDragging: false,
                startX: 0,
                startY: 0,
                currentX: 0,
                currentY: 0
            }
            setCanvasDragState(newCanvasDragState);
            return;
        }

        if (dragState.isDragging) {
            const deltaX = e.clientX - dragState.startX;
            const deltaY = e.clientY - dragState.startY;
            const newX = dragState.originalX + deltaX;
            const newY = dragState.originalY + deltaY;

            // Check if we're dropping on a connection (for two-legged legos) or a dangling leg (for stoppers)
            if (hoveredConnection) {
                const draggedLego = droppedLegos[dragState.draggedLegoIndex];
                if (draggedLego) {
                    if (draggedLego.parity_check_matrix[0].length / 2 === 2) {
                        // Handle two-legged lego insertion
                        const updatedLego = {
                            ...draggedLego,
                            x: newX,
                            y: newY
                        };

                        const trafo = new InjectTwoLegged(connections, droppedLegos);
                        trafo.apply(updatedLego, hoveredConnection, { ...draggedLego, x: newX - deltaX, y: newY - deltaY }).then(({ connections: newConnections, droppedLegos: newDroppedLegos, operation }) => {
                            setDroppedLegos(newDroppedLegos);
                            setConnections(newConnections);
                            operationHistory.addOperation(operation);
                            encodeCanvasState(newDroppedLegos, newConnections, hideConnectedLegs);
                        }).catch(error => {
                            setError(`${error}`);
                            console.error(error);
                        });
                    } else if (draggedLego.id.includes('stopper')) {
                        // Handle stopper lego insertion
                        const updatedLego = {
                            ...draggedLego,
                            x: newX,
                            y: newY
                        };

                        const addStopper = new AddStopper(connections, droppedLegos);
                        try {
                            const { connections: newConnections, droppedLegos: newDroppedLegos, operation } = addStopper.apply(
                                droppedLegos.find(l => l.instanceId === hoveredConnection.from.legoId)!,
                                hoveredConnection.from.legIndex,
                                updatedLego
                            );
                            setDroppedLegos(newDroppedLegos);
                            setConnections(newConnections);
                            operationHistory.addOperation(operation);
                            encodeCanvasState(newDroppedLegos, newConnections, hideConnectedLegs);
                        } catch (error) {
                            console.error('Failed to add stopper:', error);
                            toast({
                                title: 'Error',
                                description: error instanceof Error ? error.message : 'Failed to add stopper',
                                status: 'error',
                                duration: 3000,
                                isClosable: true,
                            });
                        };
                    }
                }
            } else if (deltaX !== 0 || deltaY !== 0) {
                // Handle regular movement
                if (groupDragState) {
                    const groupMoves = groupDragState.legoInstanceIds.map(instanceId => ({
                        oldLego: {
                            ...(droppedLegos.find(lego => lego.instanceId === instanceId)! as DroppedLego),
                            x: groupDragState.originalPositions[instanceId].x,
                            y: groupDragState.originalPositions[instanceId].y
                        },
                        newLego: {
                            ...(droppedLegos.find(lego => lego.instanceId === instanceId)! as DroppedLego),
                            x: groupDragState.originalPositions[instanceId].x + deltaX,
                            y: groupDragState.originalPositions[instanceId].y + deltaY
                        }
                    }));

                    operationHistory.addOperation({
                        type: 'move',
                        data: { legosToUpdate: groupMoves }
                    });
                } else if (tensorNetwork) {
                    const groupMoves = tensorNetwork.legos.map(lego => ({
                        oldLego: {
                            ...(lego),
                            x: lego.x - deltaX,
                            y: lego.y - deltaY,
                        },
                        newLego: {
                            ...(lego),
                            x: lego.x,
                            y: lego.y
                        }
                    }));

                    operationHistory.addOperation({
                        type: 'move',
                        data: { legosToUpdate: groupMoves }
                    });
                } else {
                    operationHistory.addOperation({
                        type: 'move',
                        data: {
                            legosToUpdate: [{
                                oldLego: {
                                    ...(droppedLegos[dragState.draggedLegoIndex] as DroppedLego),
                                    x: dragState.originalX,
                                    y: dragState.originalY
                                },
                                newLego: {
                                    ...(droppedLegos[dragState.draggedLegoIndex] as DroppedLego),
                                    x: newX,
                                    y: newY
                                }
                            }]
                        }
                    });
                }
            }

            encodeCanvasState(droppedLegos, connections, hideConnectedLegs);
        }

        // Handle leg connection
        if (legDragState?.isDragging) {
            const mouseX = e.clientX - rect.left;
            const mouseY = e.clientY - rect.top;

            droppedLegos.find(lego => {
                const legCount = lego.parity_check_matrix[0].length / 2;
                for (let i = 0; i < legCount; i++) {
                    const pos = calculateLegPosition(lego, i);
                    const targetPoint = {
                        x: lego.x + pos.endX,
                        y: lego.y + pos.endY
                    };

                    const distance = Math.sqrt(
                        Math.pow(mouseX - targetPoint.x, 2) +
                        Math.pow(mouseY - targetPoint.y, 2)
                    );

                    if (distance < 10) {
                        // Check if either leg is already participating in a connection
                        const isSourceLegConnected = connections.some(conn =>
                            (conn.from.legoId === legDragState.legoId && conn.from.legIndex === legDragState.legIndex) ||
                            (conn.to.legoId === legDragState.legoId && conn.to.legIndex === legDragState.legIndex)
                        );
                        const isTargetLegConnected = connections.some(conn =>
                            (conn.from.legoId === lego.instanceId && conn.from.legIndex === i) ||
                            (conn.to.legoId === lego.instanceId && conn.to.legIndex === i)
                        );

                        if (lego.instanceId === legDragState.legoId && i === legDragState.legIndex) {
                            return true;
                        }

                        if (isSourceLegConnected || isTargetLegConnected) {
                            setError('Cannot connect to a leg that is already connected');
                            return true;
                        }

                        const connectionExists = connections.some(conn =>
                            (conn.from.legoId === legDragState.legoId && conn.from.legIndex === legDragState.legIndex &&
                                conn.to.legoId === lego.instanceId && conn.to.legIndex === i) ||
                            (conn.from.legoId === lego.instanceId && conn.from.legIndex === i &&
                                conn.to.legoId === legDragState.legoId && conn.to.legIndex === legDragState.legIndex)
                        );

                        if (!connectionExists) {
                            const newConnection = new Connection(
                                {
                                    legoId: legDragState.legoId,
                                    legIndex: legDragState.legIndex
                                }, {
                                legoId: lego.instanceId,
                                legIndex: i
                            }
                            );

                            setConnections(prev => {
                                const newConnections = [...prev, newConnection];
                                encodeCanvasState(droppedLegos, newConnections, hideConnectedLegs);
                                return newConnections;
                            });

                            operationHistory.addOperation({
                                type: 'connect',
                                data: { connectionsToAdd: [newConnection] }
                            });
                            return true;
                        }
                    }
                }
                return false;
            });
        }

        setLegDragState(null);
        setHoveredConnection(null);

        setDragState(prev => ({
            ...prev,
            isDragging: false,
            draggedLegoIndex: -1,
            justFinished: dragState.isDragging
        }));

        setGroupDragState(null);
    };

    const handleCanvasMouseLeave = () => {
        setLegDragState(null);
        if (canvasDragState.isDragging) {
            setCanvasDragState({
                isDragging: false,
                startX: 0,
                startY: 0,
                currentX: 0,
                currentY: 0
            });
        }
    };


    // Handle undo
    const handleUndo = () => {
        console.log('before undo', connections, droppedLegos);
        const { connections: newConnections, droppedLegos: newDroppedLegos } = operationHistory.undo(connections, droppedLegos);
        console.log('undo result', newConnections, newDroppedLegos);
        setConnections(newConnections);
        setDroppedLegos(newDroppedLegos);
        encodeCanvasState(newDroppedLegos, newConnections, hideConnectedLegs);
    }

    // Handle redo
    const handleRedo = () => {
        console.log('before redo', connections, droppedLegos);
        const { connections: newConnections, droppedLegos: newDroppedLegos } = operationHistory.redo(connections, droppedLegos);
        console.log('redo result', newConnections, newDroppedLegos);
        setConnections(newConnections);
        setDroppedLegos(newDroppedLegos);
        encodeCanvasState(newDroppedLegos, newConnections, hideConnectedLegs);
    }

    // Helper function to generate network signature for caching
    const createNetworkSignature = (network: TensorNetwork) => {
        const sortedLegos = [...network.legos].sort((a, b) => a.instanceId.localeCompare(b.instanceId)).map(lego => lego.id + "-" + lego.instanceId + "-" + lego.parity_check_matrix[0].length / 2);
        const sortedConnections = [...network.connections].sort((a, b) => {
            const aStr = `${a.from.legoId}${a.from.legIndex}${a.to.legoId}${a.to.legIndex}`;
            const bStr = `${b.from.legoId}${b.from.legIndex}${b.to.legoId}${b.to.legIndex}`;
            return aStr.localeCompare(bStr);
        });
        const sig = JSON.stringify({ legos: sortedLegos, connections: sortedConnections })
        return sig;
    };

    // Update keyboard event listener for both Ctrl+Z, Ctrl+Y and Delete
    useEffect(() => {
        const handleKeyDown = async (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'c' && (tensorNetwork || selectedLego)) {
                e.preventDefault();
                const networkToCopy = tensorNetwork || {
                    legos: [selectedLego]
                };

                const jsonStr = JSON.stringify(networkToCopy);
                navigator.clipboard.writeText(jsonStr).then(() => {
                    toast({
                        title: "Copied to clipboard",
                        description: "Network data has been copied",
                        status: "success",
                        duration: 2000,
                        isClosable: true,
                    });
                }).catch(_ => {
                    toast({
                        title: "Copy failed",
                        description: "Failed to copy network data",
                        status: "error",
                        duration: 2000,
                        isClosable: true,
                    });
                });
            } else if ((e.ctrlKey || e.metaKey) && e.key === 'v') {
                e.preventDefault();
                try {
                    const clipText = await navigator.clipboard.readText();
                    const pastedData = JSON.parse(clipText);

                    if (pastedData.legos && Array.isArray(pastedData.legos) && pastedData.legos.length > 0) {
                        // Get canvas element and its dimensions
                        const canvasPanel = document.querySelector('#main-panel');
                        if (!canvasPanel) return;

                        const canvasRect = canvasPanel.getBoundingClientRect();

                        // Determine drop position
                        let dropX: number, dropY: number;

                        if (mousePosition) {
                            // Use current mouse position
                            dropX = mousePosition.x;
                            dropY = mousePosition.y;
                        } else {
                            // Use random position around canvas center
                            const centerX = canvasRect.width / 2;
                            const centerY = canvasRect.height / 2;
                            const randomOffset = 50; // pixels

                            dropX = centerX + (Math.random() * 2 - 1) * randomOffset;
                            dropY = centerY + (Math.random() * 2 - 1) * randomOffset;
                        }

                        // Create a mapping from old instance IDs to new ones
                        const startingId = parseInt(newInstanceId(droppedLegos));
                        const instanceIdMap = new Map<string, string>();

                        // Create new legos with new instance IDs
                        const newLegos = pastedData.legos.map((l: DroppedLego, idx: number) => {
                            const newId = String(startingId + idx);
                            instanceIdMap.set(l.instanceId, newId);
                            return {
                                ...l,
                                instanceId: newId,
                                x: l.x + dropX - pastedData.legos[0].x, // Maintain relative positions
                                y: l.y + dropY - pastedData.legos[0].y,
                                style: getLegoStyle(l.id, l.parity_check_matrix[0].length / 2)
                            };
                        });

                        // Create new connections with updated instance IDs
                        const newConnections = (pastedData.connections || []).map((conn: Connection) => {
                            return new Connection(
                                {
                                    legoId: instanceIdMap.get(conn.from.legoId)!,
                                    legIndex: conn.from.legIndex
                                },
                                {
                                    legoId: instanceIdMap.get(conn.to.legoId)!,
                                    legIndex: conn.to.legIndex
                                }
                            );
                        });

                        // Update state
                        setDroppedLegos(prev => [...prev, ...newLegos]);
                        setConnections(prev => [...prev, ...newConnections]);

                        // Add to history
                        operationHistory.addOperation({
                            type: 'add',
                            data: {
                                legosToAdd: newLegos,
                                connectionsToAdd: newConnections
                            }
                        });

                        // Update URL state
                        encodeCanvasState([...droppedLegos, ...newLegos], [...connections, ...newConnections], hideConnectedLegs);

                        toast({
                            title: "Paste successful",
                            description: `Pasted ${newLegos.length} lego${newLegos.length > 1 ? 's' : ''}`,
                            status: "success",
                            duration: 2000,
                            isClosable: true,
                        });
                    }
                } catch (err) {
                    toast({
                        title: "Paste failed",
                        description: "Invalid network data in clipboard",
                        status: "error",
                        duration: 2000,
                        isClosable: true,
                    });
                }
            } else if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
                e.preventDefault();
                handleUndo();
            } else if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.shiftKey && e.key === 'Z'))) {
                e.preventDefault();
                handleRedo();
            } else if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
                e.preventDefault();
                if (droppedLegos.length > 0) {
                    // Create a tensor network from all legos
                    const selectedLegoIds = new Set(droppedLegos.map(lego => lego.instanceId));

                    // Collect only internal connections between selected legos
                    const internalConnections = connections.filter(conn =>
                        selectedLegoIds.has(conn.from.legoId) &&
                        selectedLegoIds.has(conn.to.legoId)
                    );

                    let tensorNetwork = {
                        legos: droppedLegos,
                        connections: internalConnections
                    } as TensorNetwork;

                    tensorNetwork.signature = createNetworkSignature(tensorNetwork);

                    setSelectedLego(null);

                    setTensorNetwork(tensorNetwork);
                }
            } else if (e.key === 'Delete' || e.key === 'Backspace') {
                // Handle deletion of selected legos
                let legosToRemove: DroppedLego[] = [];

                if (tensorNetwork) {
                    legosToRemove = tensorNetwork.legos;
                } else if (selectedLego) {
                    legosToRemove = [selectedLego];
                }

                if (legosToRemove.length > 0) {
                    // Get all connections involving the legos to be removed
                    const connectionsToRemove = connections.filter(conn =>
                        legosToRemove.some(lego =>
                            conn.from.legoId === lego.instanceId || conn.to.legoId === lego.instanceId
                        )
                    );

                    // Add to history
                    operationHistory.addOperation({
                        type: 'remove',
                        data: {
                            legosToRemove: legosToRemove,
                            connectionsToRemove: connectionsToRemove
                        }
                    });

                    // Remove the connections and legos
                    setConnections(prev => prev.filter(conn =>
                        !legosToRemove.some(lego =>
                            conn.from.legoId === lego.instanceId || conn.to.legoId === lego.instanceId
                        )
                    ));
                    setDroppedLegos(prev => prev.filter(lego =>
                        !legosToRemove.some(l => l.instanceId === lego.instanceId)
                    ));

                    // Clear selection states
                    setSelectedLego(null);
                    setTensorNetwork(null);

                    // Update URL state
                    encodeCanvasState(droppedLegos.filter(lego =>
                        !legosToRemove.some(l => l.instanceId === lego.instanceId)
                    ), connections.filter(conn =>
                        !legosToRemove.some(l =>
                            conn.from.legoId === l.instanceId || conn.to.legoId === l.instanceId
                        )
                    ), hideConnectedLegs);
                }
            } else if (e.key === 'Escape') {
                // Dismiss error message when Escape is pressed
                setError('');
            } else if (e.key === 'Alt') {
                e.preventDefault();
                setAltKeyPressed(true);
            } else if (e.key === 'f') {
                e.preventDefault();
                if (tensorNetwork) {
                    fuseLegos(tensorNetwork.legos);
                }
            } else if (e.key === 'p') {
                e.preventDefault();
                if (selectedLego && (selectedLego.id === 'x_rep_code' || selectedLego.id === 'z_rep_code')) {
                    handlePullOutSameColoredLeg(selectedLego);
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [handleUndo, handleRedo, tensorNetwork, selectedLego, connections, droppedLegos, operationHistory.addOperation, encodeCanvasState, hideConnectedLegs, mousePosition]);

    useEffect(() => {
        const handleKeyUp = (e: KeyboardEvent) => {
            if (e.key === 'Alt') {
                setAltKeyPressed(false);
            }
        };
        window.addEventListener('keyup', handleKeyUp);
        return () => window.removeEventListener('keyup', handleKeyUp);
    }, []);

    useEffect(() => {
        const handleBlur = () => {
            setCanvasDragState(prev => ({
                ...prev,
                isDragging: false
            }));
            setAltKeyPressed(false);

        };
        window.addEventListener('blur', handleBlur);
        return () => window.removeEventListener('blur', handleBlur);
    }, []);


    useEffect(() => {
        const handleFocus = () => {
            setCanvasDragState(prev => ({
                ...prev,
                isDragging: false
            }));
            setAltKeyPressed(false);
        };

        window.addEventListener('focus', handleFocus);
        return () => window.removeEventListener('focus', handleFocus);
    }, []);



    const handleConnectionDoubleClick = (e: React.MouseEvent, connection: Connection) => {
        e.preventDefault();
        e.stopPropagation();

        // Add to history before removing
        operationHistory.addOperation({
            type: 'disconnect',
            data: { connectionsToRemove: [connection] }
        });

        // Remove the connection and update URL state with the new connections
        setConnections(prev => {
            const newConnections = prev.filter(conn =>
                !(conn.from.legoId === connection.from.legoId &&
                    conn.from.legIndex === connection.from.legIndex &&
                    conn.to.legoId === connection.to.legoId &&
                    conn.to.legIndex === connection.to.legIndex)
            );
            encodeCanvasState(droppedLegos, newConnections, hideConnectedLegs);
            return newConnections;
        });
    };

    const handleClearAll = () => {
        if (droppedLegos.length === 0 && connections.length === 0) return;

        // Store current state for history
        operationHistory.addOperation({
            type: 'remove',
            data: {
                legosToRemove: droppedLegos,
                connectionsToRemove: connections
            }
        });

        // Clear all state
        setDroppedLegos([]);
        setConnections([]);
        setSelectedLego(null);
        setTensorNetwork(null);

        // Update URL state
        encodeCanvasState([], [], hideConnectedLegs);

    };


    // Update the useClipboard hook when code changes
    useEffect(() => {
        if (tensorNetwork?.constructionCode) {
            onCopyCode(tensorNetwork.constructionCode);
        }
    }, [tensorNetwork?.constructionCode]);

    // Modify the existing useEffect to clear both caches
    useEffect(() => {
        // Clear caches when connections change
        parityCheckMatrixCache.clear();
        weightEnumeratorCache.clear();
    }, [connections]);

    useEffect(() => {
        // Clear caches when legos are added/removed
        parityCheckMatrixCache.clear();
        weightEnumeratorCache.clear();
    }, [droppedLegos.length]);

    const handleCssTannerSubmit = async (matrix: number[][]) => {
        try {
            const response = await axios.post(`/api/csstannernetwork`, { matrix, start_node_index: newInstanceId(droppedLegos) });
            let { legos, connections: newConnections } = response.data;
            newConnections = newConnections.map((conn: Connection) => {
                return new Connection(conn.from, conn.to);
            });

            // Calculate positions for each type of node
            const canvasWidth = 800;  // Approximate canvas width
            const nodeSpacing = 100;  // Space between nodes

            // Group legos by type
            const zNodes = legos.filter((lego: DroppedLego) => lego.shortName.startsWith('z'));
            const qNodes = legos.filter((lego: DroppedLego) => lego.shortName.startsWith('q'));
            const xNodes = legos.filter((lego: DroppedLego) => lego.shortName.startsWith('x'));

            // Calculate positions for each row
            const newLegos = legos.map((lego: DroppedLego) => {
                let nodesInRow: DroppedLego[];
                let y: number;

                if (lego.shortName.startsWith('z')) {
                    nodesInRow = zNodes;
                    y = 100;  // Top row
                } else if (lego.shortName.startsWith('q')) {
                    nodesInRow = qNodes;
                    y = 250;  // Middle row
                } else {
                    nodesInRow = xNodes;
                    y = 400;  // Bottom row
                }

                // Calculate x position based on index in row
                const indexInRow = nodesInRow.findIndex(l => l.instanceId === lego.instanceId);
                const x = (canvasWidth - (nodesInRow.length - 1) * nodeSpacing) / 2 + indexInRow * nodeSpacing;

                return {
                    ...lego,
                    x,
                    y,
                    style: getLegoStyle(lego.id, lego.parity_check_matrix[0].length / 2),
                    selectedMatrixRows: []
                };
            });

            // Add to state
            setDroppedLegos(prev => [...prev, ...newLegos]);
            setConnections(prev => [...prev, ...newConnections]);

            // Add to history
            operationHistory.addOperation({
                type: 'add',
                data: {
                    legosToAdd: newLegos,
                    connectionsToAdd: newConnections
                }
            });

            const updatedLegos = [...droppedLegos, ...newLegos];
            encodeCanvasState(updatedLegos, newConnections, hideConnectedLegs);

        } catch (error) {
            if (axios.isAxiosError(error)) {
                const message = error.response?.data?.message || error.response?.data?.detail || error.message;
                setError(`Failed to create CSS Tanner network: ${message}`);
            } else {
                setError('Failed to create CSS Tanner network');
            }
            console.error('Error:', error);
        }
    };

    const handleTannerSubmit = async (matrix: number[][]) => {
        try {
            const response = await axios.post(`/api/tannernetwork`, { matrix, start_node_index: newInstanceId(droppedLegos) });
            let { legos, connections: newConnections } = response.data;
            newConnections = newConnections.map((conn: Connection) => {
                return new Connection(conn.from, conn.to);
            });

            // Calculate positions for each type of node
            const canvasWidth = 800;  // Approximate canvas width
            const nodeSpacing = 100;  // Space between nodes

            // Group legos by type
            const checkNodes = legos.filter((lego: DroppedLego) => !lego.shortName.startsWith('q'));
            const qNodes = legos.filter((lego: DroppedLego) => lego.shortName.startsWith('q'));

            // Calculate positions for each row
            const newLegos = legos.map((lego: DroppedLego) => {
                let nodesInRow: DroppedLego[];
                let y: number;

                if (lego.shortName.startsWith('q')) {
                    nodesInRow = qNodes;
                    y = 300;  // Bottom row
                } else {
                    nodesInRow = checkNodes;
                    y = 150;  // Top row
                }

                // Calculate x position based on index in row
                const indexInRow = nodesInRow.findIndex(l => l.instanceId === lego.instanceId);
                const x = (canvasWidth - (nodesInRow.length - 1) * nodeSpacing) / 2 + indexInRow * nodeSpacing;

                return {
                    ...lego,
                    x,
                    y,
                    style: getLegoStyle(lego.id, lego.parity_check_matrix[0].length / 2),
                    selectedMatrixRows: []
                };
            });

            // Add to state
            setDroppedLegos(prev => [...prev, ...newLegos]);
            setConnections(prev => [...prev, ...newConnections]);

            // Add to history
            operationHistory.addOperation({
                type: 'add',
                data: {
                    legosToAdd: newLegos,
                    connectionsToAdd: newConnections
                }
            });

            const updatedLegos = [...droppedLegos, ...newLegos];
            encodeCanvasState(updatedLegos, newConnections, hideConnectedLegs);

        } catch (error) {
            if (axios.isAxiosError(error)) {
                const message = error.response?.data?.message || error.response?.data?.detail || error.message;
                setError(`Failed to create Tanner network: ${message}`);
            } else {
                setError('Failed to create Tanner network');
            }
            console.error('Error:', error);
        }
    };

    const handleMspSubmit = async (matrix: number[][]) => {
        try {
            const response = await axios.post(`/api/mspnetwork`, { matrix, start_node_index: newInstanceId(droppedLegos) });
            let { legos, connections: newConnections } = response.data;
            newConnections = newConnections.map((conn: Connection) => {
                return new Connection(conn.from, conn.to);
            });
            // Calculate positions using lego coordinates
            const canvasWidth = 800;  // Approximate canvas width
            const margin = 50;  // Margin from edges

            // Find min/max x and y to determine scale
            const xValues = legos.map((lego: DroppedLego) => lego.x);
            const yValues = legos.map((lego: DroppedLego) => lego.y);
            const minX = Math.min(...xValues);
            const maxX = Math.max(...xValues);
            const minY = Math.min(...yValues);

            // Calculate scale to fit width with margins
            const xScale = (canvasWidth - 2 * margin) / (maxX - minX || 1) * 1.2;

            // Position legos using their coordinates scaled to fit
            const newLegos = legos.map((lego: DroppedLego) => {
                const x = margin + (lego.x - minX) * xScale;
                const y = margin + (lego.y - minY) * xScale; // Use same scale for y to maintain proportions

                return {
                    ...lego,
                    x,
                    y,
                    style: getLegoStyle(lego.id, lego.parity_check_matrix[0].length / 2),
                    pushedLegs: [],
                    selectedMatrixRows: []
                };
            });

            // Add to state
            setDroppedLegos(prev => [...prev, ...newLegos]);
            setConnections(prev => [...prev, ...newConnections]);

            // Add to history
            operationHistory.addOperation({
                type: 'add',
                data: {
                    legosToAdd: newLegos,
                    connectionsToAdd: newConnections
                }
            });

            const updatedLegos = [...droppedLegos, ...newLegos];
            encodeCanvasState(updatedLegos, newConnections, hideConnectedLegs);

        } catch (error) {
            if (axios.isAxiosError(error)) {
                const message = error.response?.data?.message || error.response?.data?.detail || error.message;
                setError(`Failed to create measurement state preparation network: ${message}`);
            } else {
                setError('Failed to create measurement state preparation network');
            }
            console.error('Error:', error);
        }
    };


    const handleLegClick = (legoId: string, legIndex: number) => {
        // Find the lego that was clicked
        const clickedLego = droppedLegos.find(lego => lego.instanceId === legoId);
        if (!clickedLego) return;
        const numQubits = clickedLego.parity_check_matrix[0].length / 2;
        const h = clickedLego.parity_check_matrix;
        const existingPushedLeg = clickedLego.selectedMatrixRows?.find(row => h[row][legIndex] == 1 || h[row][legIndex + numQubits] == 1);
        const currentOperator = existingPushedLeg ? h[existingPushedLeg][legIndex] == 1 ? PauliOperator.X : PauliOperator.Z : PauliOperator.I;

        // Find available operators in parity check matrix for this leg
        const hasX = clickedLego.parity_check_matrix.some(row =>
            row[legIndex] === 1 && row[legIndex + numQubits] === 0
        );
        const hasZ = clickedLego.parity_check_matrix.some(row =>
            row[legIndex] === 0 && row[legIndex + numQubits] === 1
        );

        // Cycle through operators only if they exist in matrix
        let nextOperator: PauliOperator;
        switch (currentOperator) {
            case PauliOperator.I:
                nextOperator = hasX ? PauliOperator.X :
                    hasZ ? PauliOperator.Z :
                        PauliOperator.I;
                break;
            case PauliOperator.X:
                nextOperator = hasZ ? PauliOperator.Z : PauliOperator.I;
                break;
            case PauliOperator.Z:
                nextOperator = PauliOperator.I;
                break;
            default:
                nextOperator = PauliOperator.I;
        }

        // Find the first row in parity check matrix that matches currentOperator on legIndex
        const baseRepresentative = clickedLego.parity_check_matrix.find(row => {
            if (nextOperator === PauliOperator.X) {
                return row[legIndex] === 1 && row[legIndex + numQubits] === 0;
            } else if (nextOperator === PauliOperator.Z) {
                return row[legIndex] === 0 && row[legIndex + numQubits] === 1;
            }
            return false;
        }) || new Array(2 * numQubits).fill(0);


        // Find the row index that corresponds to the baseRepresentative
        const rowIndex = clickedLego.parity_check_matrix.findIndex(row =>
            row.every((val, idx) => val === baseRepresentative[idx])
        );

        // Update the selected rows based on the pushed legs
        const selectedRows = [rowIndex].filter(row => row !== -1);

        // Create a new lego instance with updated properties
        const updatedLego = {
            ...clickedLego,
            selectedMatrixRows: selectedRows
        };

        // Update the selectedLego state
        setSelectedLego(updatedLego);

        // Update droppedLegos by replacing the old lego with the new one
        const newDroppedLegos = droppedLegos.map(lego =>
            lego.instanceId === legoId ? updatedLego : lego
        );
        setDroppedLegos(newDroppedLegos);
        encodeCanvasState(newDroppedLegos, connections, hideConnectedLegs);
    };

    const fuseLegos = async (legosToFuse: DroppedLego[]) => {
        const trafo = new FuseLegos(connections, droppedLegos);
        try {
            const { connections: newConnections, droppedLegos: newDroppedLegos, operation: operation } = await trafo.apply(legosToFuse);
            operationHistory.addOperation(operation);
            setDroppedLegos(newDroppedLegos);
            setConnections(newConnections);
            setSelectedLego(null);
            setTensorNetwork(null);
            encodeCanvasState(
                newDroppedLegos,
                newConnections,
                hideConnectedLegs
            );

        } catch (error) {
            setError(`${error}`);
            return;
        }

    };

    // Helper function to push legos out of the way radially
    const makeSpace = (center: { x: number; y: number }, radius: number, skipLegos: DroppedLego[], legosToCheck: DroppedLego[]): DroppedLego[] => {
        const skipIds = new Set(skipLegos.map(l => l.instanceId));
        return legosToCheck.map(lego => {
            if (skipIds.has(lego.instanceId)) return lego;

            // Calculate distance from center
            const dx = lego.x - center.x;
            const dy = lego.y - center.y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            // If lego is within radius, push it out
            if (distance < radius + 80) {  // Increased check radius
                // Calculate angle
                const angle = Math.atan2(dy, dx);
                // Push out to radius + 100 pixels (increased buffer)
                const newX = center.x + (radius + 80) * Math.cos(angle);
                const newY = center.y + (radius + 80) * Math.sin(angle);
                return { ...lego, x: newX, y: newY };
            }

            return lego;
        });
    };

    const handleCustomLegoSubmit = (matrix: number[][], logicalLegs: number[]) => {
        const instanceId = newInstanceId(droppedLegos)
        const newLego: DroppedLego = {
            // to avoid caching collisions
            id: 'custom-' + instanceId + '-' + Math.random().toString(36).substring(2, 15),
            name: 'Custom Lego',
            shortName: 'Custom',
            description: 'Custom lego with user-defined parity check matrix',
            instanceId: newInstanceId(droppedLegos),
            x: customLegoPosition.x,
            y: customLegoPosition.y,
            parity_check_matrix: matrix,
            logical_legs: logicalLegs,
            gauge_legs: [],
            style: getLegoStyle('custom', matrix[0].length / 2),
            selectedMatrixRows: []
        };

        setDroppedLegos([...droppedLegos, newLego]);
        operationHistory.addOperation({
            type: 'add',
            data: {
                legosToAdd: [newLego],
            }
        });
        encodeCanvasState([...droppedLegos, newLego], connections, hideConnectedLegs);
    };

    const handlePullOutSameColoredLeg = async (lego: DroppedLego) => {
        // Get max instance ID
        const maxInstanceId = Math.max(...droppedLegos.map(l => parseInt(l.instanceId)));
        const numLegs = lego.parity_check_matrix[0].length / 2;

        // Find any existing connections to the original lego
        const existingConnections = connections.filter(
            conn => conn.from.legoId === lego.instanceId || conn.to.legoId === lego.instanceId
        );

        try {
            // Get the new repetition code with one more leg
            const response = await fetch(`/api/dynamiclego`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    lego_id: lego.id,
                    parameters: {
                        d: numLegs + 1
                    }
                })
            });

            if (!response.ok) {
                throw new Error('Failed to get dynamic lego');
            }

            const newLegoData = await response.json();

            // Create the new lego with updated matrix but same position
            const newLego: DroppedLego = {
                ...lego,
                style: getLegoStyle(lego.id, numLegs + 1),
                parity_check_matrix: newLegoData.parity_check_matrix
            };

            // Create a stopper based on the lego type
            const stopperLego: DroppedLego = {
                id: lego.id === 'z_rep_code' ? 'stopper_x' : 'stopper_z',
                name: lego.id === 'z_rep_code' ? 'X Stopper' : 'Z Stopper',
                shortName: lego.id === 'z_rep_code' ? 'X' : 'Z',
                description: lego.id === 'z_rep_code' ? 'X Stopper' : 'Z Stopper',
                instanceId: (maxInstanceId + 1).toString(),
                x: lego.x + 100, // Position the stopper to the right of the lego
                y: lego.y,
                parity_check_matrix: lego.id === 'z_rep_code' ? [[1, 0]] : [[0, 1]],
                logical_legs: [],
                gauge_legs: [],
                style: getLegoStyle(lego.id === 'z_rep_code' ? 'stopper_x' : 'stopper_z', 1),
                selectedMatrixRows: []
            };

            // Create new connection to the stopper
            const newConnection: Connection = new Connection(
                {
                    legoId: lego.instanceId,
                    legIndex: numLegs // The new leg will be at index numLegs
                },
                {
                    legoId: stopperLego.instanceId,
                    legIndex: 0
                }
            );

            // Update the state
            const newLegos = [...droppedLegos.filter(l => l.instanceId !== lego.instanceId), newLego, stopperLego];
            const newConnections = [...connections.filter(c =>
                c.from.legoId !== lego.instanceId && c.to.legoId !== lego.instanceId
            ), ...existingConnections, newConnection];

            setDroppedLegos(newLegos);
            setConnections(newConnections);

            // Add to operation history
            operationHistory.addOperation({
                type: 'pullOutOppositeLeg',
                data: {
                    legosToRemove: [lego],
                    connectionsToRemove: [],
                    legosToAdd: [newLego, stopperLego],
                    connectionsToAdd: [newConnection]
                }
            });

            // Update the selected lego
            setSelectedLego(null);

            // Update URL state
            encodeCanvasState(newLegos, newConnections, hideConnectedLegs);

        } catch (error) {
            setError(`Error pulling out opposite leg: ${error}`);
        }
    };

    const handleExportSvg = () => {
        // Clear any selections to have a clean view
        setSelectedLego(null);

        // Get the canvas panel element
        const canvasPanel = document.querySelector('#main-panel');
        if (!canvasPanel) {
            toast({
                title: "Export failed",
                description: "Could not find the canvas panel",
                status: "error",
                duration: 3000,
                isClosable: true,
            });
            return;
        }

        // Create a new SVG element that will contain everything
        const combinedSvg = document.createElementNS("http://www.w3.org/2000/svg", "svg");

        // First, let's calculate the total bounding box
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        // Process all SVG elements in the canvas
        const connections_svg = canvasPanel.querySelector('#connections-svg');
        const svgElements = canvasPanel.querySelectorAll('svg');
        svgElements.forEach(svg => {
            // Skip SVGs that are marked as hidden
            if (svg.style.visibility === 'hidden' || svg.getAttribute('visibility') === 'hidden') {
                return;
            }

            // Get the SVG's position relative to the canvas
            const rect = svg.getBoundingClientRect();
            const canvasRect = canvasPanel.getBoundingClientRect();
            const relativeX = rect.left - canvasRect.left;
            const relativeY = rect.top - canvasRect.top;

            // Update bounding box
            if (svg != connections_svg) {
                minX = Math.min(minX, relativeX);
                minY = Math.min(minY, relativeY);
                maxX = Math.max(maxX, relativeX + rect.width);
                maxY = Math.max(maxY, relativeY + rect.height);
            }

            // Clone the SVG content
            const clonedContent = svg.cloneNode(true) as SVGElement;

            // Remove any duplicate text elements (keep only SVG text elements)
            const textElements = clonedContent.querySelectorAll('text');
            textElements.forEach(text => {
                const parent = text.parentElement;
                if (parent && parent.querySelector('div')) {
                    // If the parent also contains a div element, this is likely a duplicate text
                    text.remove();
                }
            });

            // Create a group to maintain position
            const group = document.createElementNS("http://www.w3.org/2000/svg", "g");
            group.setAttribute('transform', `translate(${relativeX}, ${relativeY})`);

            // Move all children to the group
            while (clonedContent.firstChild) {
                group.appendChild(clonedContent.firstChild);
            }

            combinedSvg.appendChild(group);
        });


        // Add padding to bounding box
        const padding = 50;
        const width = maxX - minX + 2 * padding;
        const height = maxY - minY + 2 * padding;

        // Set the viewBox and size of the combined SVG
        combinedSvg.setAttribute('viewBox', `${minX - padding} ${minY - padding} ${width} ${height}`);
        combinedSvg.setAttribute('width', width.toString());
        combinedSvg.setAttribute('height', height.toString());
        combinedSvg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');

        // Add XML declaration and create final SVG content
        const svgContent = '<?xml version="1.0" encoding="UTF-8" standalone="no"?>\n' +
            combinedSvg.outerHTML;

        // Create and trigger download
        const blob = new Blob([svgContent], { type: 'image/svg+xml' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'quantum_lego_network.svg';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        toast({
            title: "Export successful",
            description: "SVG file has been downloaded",
            status: "success",
            duration: 3000,
            isClosable: true,
        });
    };

    return (
        <VStack spacing={0} align="stretch" h="100vh">
            {/* Menu Strip */}
            <HStack
                spacing={2}
                p={2}
                borderBottom="1px"
                borderColor={borderColor}
                bg={bgColor}
            >
                <Menu>
                    <MenuButton as={Button}
                        variant="ghost"
                        size="sm">
                        Export
                    </MenuButton>
                    <MenuList>
                        <MenuItem onClick={handleExportSvg}>
                            Export canvas as SVG...
                        </MenuItem>
                    </MenuList>
                </Menu>
                <Menu>

                    <MenuButton
                        as={Button}
                        variant="ghost"
                        size="sm"
                    >
                        Tensor Networks
                    </MenuButton>
                    <MenuList>
                        <MenuItem onClick={() => setIsCssTannerDialogOpen(true)}>
                            CSS Tanner Network
                        </MenuItem>
                        <MenuItem onClick={() => setIsTannerDialogOpen(true)}>
                            Tanner Network
                        </MenuItem>
                        <MenuItem onClick={() => setIsMspDialogOpen(true)}>
                            Measurement State Prep Network
                        </MenuItem>

                    </MenuList>
                </Menu>
                <Menu>
                    <MenuButton
                        as={Button}
                        variant="ghost"
                        size="sm"
                    >
                        View
                    </MenuButton>
                    <MenuList>
                        <MenuItemOption
                            onClick={() => {
                                setHideConnectedLegs(!hideConnectedLegs);
                                encodeCanvasState(droppedLegos, connections, !hideConnectedLegs);
                            }}
                            isChecked={hideConnectedLegs}
                        >

                            Hide connected legs
                        </MenuItemOption>
                        <MenuItemOption isChecked={isLegoPanelCollapsed} onClick={() => setIsLegoPanelCollapsed(!isLegoPanelCollapsed)}>
                            Hide lego list
                        </MenuItemOption>
                        <MenuItem

                            onClick={() => {
                                const rect = canvasRef.current?.getBoundingClientRect();
                                if (!rect) return;
                                const centerX = rect.width / 2
                                const centerY = rect.height / 2
                                const scale = 1 / zoomLevel
                                const rescaledLegos = droppedLegos.map(lego => ({
                                    ...lego,
                                    x: (lego.x - centerX) * scale + centerX,
                                    y: (lego.y - centerY) * scale + centerY
                                }));
                                setDroppedLegos(rescaledLegos);
                                setZoomLevel(1)
                                encodeCanvasState(rescaledLegos, connections, hideConnectedLegs);
                            }}
                            isDisabled={zoomLevel === 1}
                        >
                            Reset zoom
                        </MenuItem>

                    </MenuList>
                </Menu>
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleClearAll}
                >
                    Remove all
                </Button>
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                        // Clear highlights from all legos
                        const clearedLegos = droppedLegos.map(lego => ({
                            ...lego,
                            selectedMatrixRows: []
                        }));
                        setDroppedLegos(clearedLegos);
                        setSelectedLego(null);
                        encodeCanvasState(clearedLegos, connections, hideConnectedLegs);
                    }}
                    isDisabled={!droppedLegos.some(lego =>
                        (lego.selectedMatrixRows && lego.selectedMatrixRows.length > 0)
                    )}
                >
                    Clear highlights
                </Button>


            </HStack>

            {/* Main Content */}
            <Box flex={1} position="relative" overflow="hidden">
                <PanelGroup direction="horizontal">
                    {/* Left Panel */}
                    {!isLegoPanelCollapsed && (
                        <>
                            <Panel id="lego-panel" defaultSize={10} minSize={2} order={1} collapsible={true} onCollapse={() => setIsLegoPanelCollapsed(true)} onExpand={() => setIsLegoPanelCollapsed(false)}>
                                <LegoPanel
                                    legos={legos}
                                    onDragStart={handleDragStart}
                                    onLegoSelect={(_) => {
                                        // Handle lego selection if needed
                                    }}
                                />
                            </Panel>
                            <ResizeHandle id="lego-panel-resize-handle" />
                        </>
                    )}


                    {/* Main Content */}
                    <Panel id="main-panel" defaultSize={60} minSize={5} order={2}>
                        <Box h="100%" display="flex" flexDirection="column" p={4}>
                            {/* Status Bar */}
                            <Box p={2} borderWidth={1} borderRadius="lg" mb={4}>
                                <HStack spacing={2}>

                                    <Box
                                        w="8px"
                                        h="8px"
                                        borderRadius="full"
                                        bg={isBackendHealthy ? "green.400" : "red.400"}
                                    />
                                    <Text fontSize="sm">Backend Status: {message}</Text>
                                </HStack>
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
                                onDragEnd={handleDragEnd}
                                onMouseMove={handleCanvasMouseMove}
                                onWheel={handleCanvasMouseWheel}
                                onMouseUp={handleCanvasMouseUp}
                                onMouseLeave={handleCanvasMouseLeave}
                                onClick={handleCanvasClick}
                                onMouseDown={handleCanvasMouseDown}
                                style={{
                                    userSelect: 'none', overflow: 'hidden',
                                    cursor: altKeyPressed ?
                                        (canvasDragState.isDragging ? 'grabbing' : 'grab')
                                        : 'default'
                                }}
                            >
                                {/* Connection Lines */}
                                <svg
                                    id="connections-svg"
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
                                        {connections.map((conn) => {
                                            const fromLego = droppedLegos.find(l => l.instanceId === conn.from.legoId);
                                            const toLego = droppedLegos.find(l => l.instanceId === conn.to.legoId);
                                            if (!fromLego || !toLego) return null;

                                            // Create a stable key based on the connection's properties
                                            const [firstId, firstLeg, secondId, secondLeg] =
                                                conn.from.legoId < conn.to.legoId
                                                    ? [conn.from.legoId, conn.from.legIndex, conn.to.legoId, conn.to.legIndex]
                                                    : [conn.to.legoId, conn.to.legIndex, conn.from.legoId, conn.from.legIndex];
                                            const connKey = `${firstId}-${firstLeg}-${secondId}-${secondLeg}`;

                                            // Calculate positions using shared function
                                            const fromPos = calculateLegPosition(fromLego, conn.from.legIndex);
                                            const toPos = calculateLegPosition(toLego, conn.to.legIndex);

                                            // Check if legs are connected and should be hidden
                                            const fromLegConnected = connections.some(c =>
                                                (c.from.legoId === fromLego.instanceId && c.from.legIndex === conn.from.legIndex) ||
                                                (c.to.legoId === fromLego.instanceId && c.to.legIndex === conn.from.legIndex)
                                            );
                                            const toLegConnected = connections.some(c =>
                                                (c.from.legoId === toLego.instanceId && c.from.legIndex === conn.to.legIndex) ||
                                                (c.to.legoId === toLego.instanceId && c.to.legIndex === conn.to.legIndex)
                                            );

                                            // Check if legs are highlighted
                                            const fromLegStyle = fromLego.style.getLegStyle(conn.from.legIndex, fromLego);
                                            const toLegStyle = toLego.style.getLegStyle(conn.to.legIndex, toLego);
                                            const fromLegHighlighted = fromLegStyle.is_highlighted;
                                            const toLegHighlighted = toLegStyle.is_highlighted;

                                            // Determine if legs should be hidden
                                            const hideFromLeg = hideConnectedLegs && fromLegConnected && !fromLego.alwaysShowLegs && (
                                                !fromLegHighlighted ? !toLegHighlighted :
                                                    toLegHighlighted && fromLegStyle.color === toLegStyle.color
                                            );
                                            const hideToLeg = hideConnectedLegs && toLegConnected && !toLego.alwaysShowLegs && (
                                                !toLegHighlighted ? !fromLegHighlighted :
                                                    fromLegHighlighted && fromLegStyle.color === toLegStyle.color
                                            );

                                            // Final points with lego positions
                                            const fromPoint = hideFromLeg ?
                                                { x: fromLego.x, y: fromLego.y } :
                                                { x: fromLego.x + fromPos.endX, y: fromLego.y + fromPos.endY };
                                            const toPoint = hideToLeg ?
                                                { x: toLego.x, y: toLego.y } :
                                                { x: toLego.x + toPos.endX, y: toLego.y + toPos.endY };

                                            // Get the colors of the connected legs
                                            const fromLegColor = fromLego.style.getLegColor(conn.from.legIndex, fromLego);
                                            const toLegColor = toLego.style.getLegColor(conn.to.legIndex, toLego);
                                            const colorsMatch = fromLegColor === toLegColor;

                                            // Calculate control points for the curve
                                            const controlPointDistance = 30;
                                            const cp1 = {
                                                x: fromPoint.x + Math.cos(fromPos.angle) * controlPointDistance,
                                                y: fromPoint.y + Math.sin(fromPos.angle) * controlPointDistance
                                            };
                                            const cp2 = {
                                                x: toPoint.x + Math.cos(toPos.angle) * controlPointDistance,
                                                y: toPoint.y + Math.sin(toPos.angle) * controlPointDistance
                                            };

                                            // Create the path string for the cubic Bezier curve
                                            const pathString = `M ${fromPoint.x} ${fromPoint.y} C ${cp1.x} ${cp1.y}, ${cp2.x} ${cp2.y}, ${toPoint.x} ${toPoint.y}`;

                                            // Calculate midpoint for warning sign
                                            const midPoint = {
                                                x: (fromPoint.x + toPoint.x) / 2,
                                                y: (fromPoint.y + toPoint.y) / 2
                                            };

                                            function fromChakraColorToHex(color: string): string {
                                                if (color.startsWith('blue')) {
                                                    return '#0000FF';
                                                } else if (color.startsWith('red')) {
                                                    return '#FF0000';
                                                } else if (color.startsWith('purple')) {
                                                    return '#800080';
                                                } else {
                                                    return 'darkgray';
                                                }
                                            }
                                            const sharedColor = colorsMatch ? fromChakraColorToHex(fromLegColor) : 'yellow';
                                            const connectorColor = colorsMatch ? sharedColor : 'yellow';

                                            // Check if this connection is being hovered
                                            const isHovered = hoveredConnection &&
                                                hoveredConnection.from.legoId === conn.from.legoId &&
                                                hoveredConnection.from.legIndex === conn.from.legIndex &&
                                                hoveredConnection.to.legoId === conn.to.legoId &&
                                                hoveredConnection.to.legIndex === conn.to.legIndex;

                                            return (
                                                <g key={connKey}>
                                                    {/* Invisible wider path for easier clicking */}
                                                    <path
                                                        d={pathString}
                                                        stroke="transparent"
                                                        strokeWidth="10"
                                                        fill="none"
                                                        style={{
                                                            cursor: 'pointer',
                                                        }}
                                                        onDoubleClick={(e) => handleConnectionDoubleClick(e, conn)}
                                                        onMouseEnter={(e) => {
                                                            // Find and update the visible path
                                                            const visiblePath = e.currentTarget.nextSibling as SVGPathElement;
                                                            if (visiblePath) {
                                                                visiblePath.style.stroke = connectorColor;
                                                                visiblePath.style.strokeWidth = '3';
                                                                visiblePath.style.filter = 'drop-shadow(0 0 2px rgba(66, 153, 225, 0.5))';
                                                            }
                                                        }}
                                                        onMouseLeave={(e) => {
                                                            // Reset the visible path
                                                            const visiblePath = e.currentTarget.nextSibling as SVGPathElement;
                                                            if (visiblePath) {
                                                                visiblePath.style.stroke = connectorColor;
                                                                visiblePath.style.strokeWidth = '2';
                                                                visiblePath.style.filter = 'none';
                                                            }
                                                        }}
                                                    />
                                                    {/* Visible path */}
                                                    <path
                                                        d={pathString}
                                                        stroke={connectorColor}
                                                        strokeWidth={isHovered ? '4' : '2'}
                                                        fill="none"
                                                        style={{
                                                            pointerEvents: 'none',
                                                            stroke: connectorColor,
                                                            filter: isHovered ? 'drop-shadow(0 0 2px rgba(66, 153, 225, 0.5))' : 'none'
                                                        }}
                                                    />
                                                    {/* Warning sign if operators don't match */}
                                                    {!colorsMatch && (
                                                        <text
                                                            x={midPoint.x}
                                                            y={midPoint.y}
                                                            fontSize="16"
                                                            fill="#FF0000"
                                                            textAnchor="middle"
                                                            dominantBaseline="middle"
                                                            style={{ pointerEvents: 'none' }}
                                                        >
                                                            ⚠
                                                        </text>
                                                    )}
                                                </g>
                                            );
                                        })}
                                    </g>

                                    {/* Temporary line while dragging */}
                                    {legDragState?.isDragging && (() => {
                                        const fromLego = droppedLegos.find(l => l.instanceId === legDragState.legoId);
                                        if (!fromLego) return null;

                                        // Calculate position using shared function
                                        const fromPos = calculateLegPosition(fromLego, legDragState.legIndex);
                                        const fromPoint = {
                                            x: fromLego.x + fromPos.endX,
                                            y: fromLego.y + fromPos.endY
                                        };

                                        const legStyle = fromLego.style.getLegStyle(legDragState.legIndex, fromLego);
                                        const controlPointDistance = 30;
                                        const cp1 = {
                                            x: fromPoint.x + Math.cos(legStyle.angle) * controlPointDistance,
                                            y: fromPoint.y + Math.sin(legStyle.angle) * controlPointDistance
                                        };
                                        const cp2 = {
                                            x: legDragState.currentX,
                                            y: legDragState.currentY
                                        };

                                        const pathString = `M ${fromPoint.x} ${fromPoint.y} C ${cp1.x} ${cp1.y}, ${cp2.x} ${cp2.y}, ${legDragState.currentX} ${legDragState.currentY}`;

                                        return (
                                            <path
                                                d={pathString}
                                                stroke="#3182CE"
                                                strokeWidth="2"
                                                strokeDasharray="4"
                                                fill="none"
                                                opacity={0.5}
                                                style={{ pointerEvents: 'none' }}
                                            />
                                        );
                                    })()}

                                    {/* Leg Labels */}
                                    {droppedLegos.map((lego) => (
                                        isScalarLego(lego) ? null :
                                            Array(lego.parity_check_matrix[0].length / 2).fill(0).map((_, legIndex) => {
                                                // Check if leg is connected
                                                const isLegConnected = connections.some(c =>
                                                    (c.from.legoId === lego.instanceId && c.from.legIndex === legIndex) ||
                                                    (c.to.legoId === lego.instanceId && c.to.legIndex === legIndex)
                                                );

                                                // If leg is not connected, always show the label
                                                if (!isLegConnected) {
                                                    const pos = calculateLegPosition(lego, legIndex);
                                                    return (
                                                        <text
                                                            key={`${lego.instanceId}-label-${legIndex}`}
                                                            x={lego.x + pos.labelX}
                                                            y={lego.y + pos.labelY}
                                                            fontSize="12"
                                                            fill="#666666"
                                                            textAnchor="middle"
                                                            dominantBaseline="middle"
                                                            style={{ pointerEvents: 'none' }}
                                                        >
                                                            {legIndex}
                                                        </text>
                                                    );
                                                }

                                                const thisLegStyle = lego.style.getLegStyle(legIndex, lego);
                                                const isThisHighlighted = thisLegStyle.is_highlighted;

                                                // Find the connected leg's style
                                                const connection = connections.find(c =>
                                                    (c.from.legoId === lego.instanceId && c.from.legIndex === legIndex) ||
                                                    (c.to.legoId === lego.instanceId && c.to.legIndex === legIndex)
                                                );

                                                if (!connection) return null;

                                                const connectedLegInfo = connection.from.legoId === lego.instanceId
                                                    ? connection.to
                                                    : connection.from;

                                                const connectedLego = droppedLegos.find(l => l.instanceId === connectedLegInfo.legoId);
                                                if (!connectedLego) return null;

                                                const connectedStyle = connectedLego.style.getLegStyle(connectedLegInfo.legIndex, connectedLego);

                                                // Hide label if:
                                                // 1. hideConnectedLegs is true AND
                                                // 2. lego doesn't have alwaysShowLegs AND
                                                // 3. Either:
                                                //    - This leg is not highlighted and connected leg is not highlighted
                                                //    - Both legs are highlighted with the same color
                                                const shouldHideLabel = hideConnectedLegs && !lego.alwaysShowLegs && (
                                                    !isThisHighlighted
                                                        ? !connectedStyle.is_highlighted
                                                        : connectedStyle.is_highlighted && connectedStyle.color === thisLegStyle.color
                                                );

                                                if (shouldHideLabel) return null;

                                                const pos = calculateLegPosition(lego, legIndex);
                                                return (
                                                    <text
                                                        key={`${lego.instanceId}-label-${legIndex}`}
                                                        x={lego.x + pos.labelX}
                                                        y={lego.y + pos.labelY}
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

                                {/* Selection Box */}
                                {selectionBox.isSelecting && (
                                    <Box
                                        position="absolute"
                                        left={`${Math.min(selectionBox.startX, selectionBox.currentX)}px`}
                                        top={`${Math.min(selectionBox.startY, selectionBox.currentY)}px`}
                                        width={`${Math.abs(selectionBox.currentX - selectionBox.startX)}px`}
                                        height={`${Math.abs(selectionBox.currentY - selectionBox.startY)}px`}
                                        border="2px"
                                        borderColor="blue.500"
                                        bg="blue.50"
                                        opacity={0.3}
                                        pointerEvents="none"
                                    />
                                )}

                                {droppedLegos.map((lego, index) => (
                                    <DroppedLegoDisplay
                                        key={lego.instanceId}
                                        lego={lego}
                                        index={index}
                                        legDragState={legDragState}
                                        handleLegMouseDown={handleLegMouseDown}
                                        handleLegoMouseDown={handleLegoMouseDown}
                                        handleLegoClick={handleLegoClick}
                                        tensorNetwork={tensorNetwork}
                                        selectedLego={selectedLego}
                                        dragState={dragState}
                                        onLegClick={handleLegClick}
                                        hideConnectedLegs={hideConnectedLegs}
                                        connections={connections}
                                        droppedLegos={droppedLegos}
                                        demoMode={false}
                                    />
                                ))}
                            </Box>
                        </Box>
                    </Panel>

                    <ResizeHandle id="details-panel-resize-handle" />

                    {/* Right Panel */}
                    <Panel id="details-panel" defaultSize={20} minSize={5} order={3}>
                        <DetailsPanel
                            handlePullOutSameColoredLeg={handlePullOutSameColoredLeg}
                            tensorNetwork={tensorNetwork}
                            selectedLego={selectedLego}
                            droppedLegos={droppedLegos}
                            connections={connections}
                            setTensorNetwork={setTensorNetwork}
                            setError={setError}
                            setDroppedLegos={setDroppedLegos}
                            setSelectedLego={setSelectedLego}
                            fuseLegos={fuseLegos}
                            setConnections={setConnections}
                            operationHistory={operationHistory}
                            encodeCanvasState={encodeCanvasState}
                            hideConnectedLegs={hideConnectedLegs}
                            makeSpace={(center, radius, skipLegos, legosToCheck) => makeSpace(center, radius, skipLegos, legosToCheck)}
                        />
                    </Panel>
                </PanelGroup>

                {/* Error Panel */}
                <ErrorPanel error={error} onDismiss={() => setError('')} />
            </Box>
            <DynamicLegoDialog
                isOpen={isDialogOpen}
                onClose={() => {
                    setIsDialogOpen(false)
                    setSelectedDynamicLego(null)
                    setPendingDropPosition(null)
                }}
                onSubmit={handleDynamicLegoSubmit}
                legoId={selectedDynamicLego?.id || ''}
                parameters={selectedDynamicLego?.parameters || {}}
            />
            <TannerDialog
                isOpen={isCssTannerDialogOpen}
                onClose={() => setIsCssTannerDialogOpen(false)}
                onSubmit={handleCssTannerSubmit}
                title="Create CSS Tanner Network"
                cssOnly={true}
            />
            <TannerDialog
                isOpen={isTannerDialogOpen}
                onClose={() => setIsTannerDialogOpen(false)}
                onSubmit={handleTannerSubmit}
                title="Create Tanner Network"
            />
            <TannerDialog
                isOpen={isMspDialogOpen}
                onClose={() => setIsMspDialogOpen(false)}
                onSubmit={handleMspSubmit}
                title="Measurement State Prep Network"
            />
            {showCustomLegoDialog && (
                <TannerDialog
                    isOpen={showCustomLegoDialog}
                    onClose={() => setShowCustomLegoDialog(false)}
                    onSubmit={handleCustomLegoSubmit}
                    title="Create Custom Lego"
                />
            )}
        </VStack>
    )
}

export default App 