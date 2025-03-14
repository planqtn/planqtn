import { Box, Text, VStack, HStack, useColorModeValue, Button, Menu, MenuButton, MenuList, MenuItem, useClipboard } from '@chakra-ui/react'
import { useEffect, useState, useRef, useCallback } from 'react'
import { Panel, PanelGroup } from 'react-resizable-panels'
import axios from 'axios'
import { getLegoStyle } from './LegoStyles'
import ErrorPanel from './components/ErrorPanel'
import LegoPanel from './components/LegoPanel'
import { Connection, DroppedLego, LegoPiece, LegDragState, DragState, TensorNetwork, Operation, GroupDragState, SelectionBoxState } from './types'
import DetailsPanel from './components/DetailsPanel'
import { ResizeHandle } from './components/ResizeHandle'
import { CanvasStateSerializer } from './utils/CanvasStateSerializer'
import { DroppedLegoDisplay } from './components/DroppedLegoDisplay'
import { DynamicLegoDialog } from './components/DynamicLegoDialog'

function App() {
    const newInstanceId = (currentLegos: DroppedLego[]): string => {
        const maxInstanceId = currentLegos.length > 0 ? (Math.max(...currentLegos.map(lego => parseInt(lego.instanceId)))) : 0
        return String(maxInstanceId + 1)
    }

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
        originalY: 0,
        justFinished: false
    })
    const canvasRef = useRef<HTMLDivElement>(null)
    const stateSerializerRef = useRef<CanvasStateSerializer>(new CanvasStateSerializer([]))
    const [tensorNetwork, setTensorNetwork] = useState<TensorNetwork | null>(null)
    const [operationHistory, setOperationHistory] = useState<Operation[]>([])
    const [redoHistory, setRedoHistory] = useState<Operation[]>([])
    const [groupDragState, setGroupDragState] = useState<GroupDragState | null>(null)
    const [selectionBox, setSelectionBox] = useState<SelectionBoxState>({
        isSelecting: false,
        startX: 0,
        startY: 0,
        currentX: 0,
        currentY: 0,
        justFinished: false
    });
    const [manuallySelectedLegos, setManuallySelectedLegos] = useState<DroppedLego[]>([]);
    const [parityCheckMatrixCache] = useState<Map<string, number[][]>>(new Map())
    const [weightEnumeratorCache] = useState<Map<string, string>>(new Map())
    const { onCopy: onCopyCode, hasCopied: hasCopiedCode } = useClipboard("")
    const [isBackendHealthy, setIsBackendHealthy] = useState<boolean>(false)
    const [isDialogOpen, setIsDialogOpen] = useState(false)
    const [selectedDynamicLego, setSelectedDynamicLego] = useState<LegoPiece | null>(null)
    const [pendingDropPosition, setPendingDropPosition] = useState<{ x: number; y: number } | null>(null)

    const bgColor = useColorModeValue('white', 'gray.800')
    const borderColor = useColorModeValue('gray.200', 'gray.600')

    // Update the serializer when legos change
    useEffect(() => {
        stateSerializerRef.current.updateLegos(legos)
    }, [legos])

    const encodeCanvasState = useCallback((pieces: DroppedLego[], conns: Connection[]) => {
        console.log("encoding canvas state", pieces, conns);
        stateSerializerRef.current.encode(pieces, conns)
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
            }
        }

        // Listen for hash changes
        window.addEventListener('hashchange', handleHashChange)

        // Initial load
        handleHashChange()

        // Cleanup
        return () => window.removeEventListener('hashchange', handleHashChange)
    }, [decodeCanvasState])


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

            if (lego.is_dynamic) {
                setSelectedDynamicLego(lego)
                setPendingDropPosition({ x, y })
                setIsDialogOpen(true)
            } else {
                const instanceId = newInstanceId(droppedLegos)
                const newLego = { ...lego, x, y, instanceId, style: getLegoStyle(lego) }
                setDroppedLegos(prev => [...prev, newLego])
                addToHistory({
                    type: 'add',
                    data: { legos: [newLego] }
                })
            }
        }
    }

    const handleDynamicLegoSubmit = async (parameters: Record<string, any>) => {
        if (!selectedDynamicLego || !pendingDropPosition) return

        try {
            const response = await fetch('http://localhost:5000/dynamiclego', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    lego_id: selectedDynamicLego.id,
                    parameters,
                }),
            })

            if (!response.ok) {
                throw new Error('Failed to create dynamic lego')
            }

            const dynamicLego = await response.json()
            const instanceId = newInstanceId(droppedLegos)
            const newLego = {
                ...dynamicLego,
                x: pendingDropPosition.x,
                y: pendingDropPosition.y,
                instanceId,
                style: getLegoStyle(dynamicLego)
            }
            setDroppedLegos(prev => [...prev, newLego])
            addToHistory({
                type: 'add',
                data: { legos: [newLego] }
            })
        } catch (error) {
            setError('Failed to create dynamic lego')
        } finally {
            setIsDialogOpen(false)
            setSelectedDynamicLego(null)
            setPendingDropPosition(null)
        }
    }

    const handleLegoMouseDown = (e: React.MouseEvent, index: number) => {
        e.preventDefault();
        e.stopPropagation();
        const lego = droppedLegos[index];

        if (e.shiftKey) {
            // Check if we're cloning multiple legos
            const legosToClone = manuallySelectedLegos.length > 0 ? manuallySelectedLegos :
                tensorNetwork?.legos || [lego];

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
                    y: l.y + 20
                };
            });

            // Clone connections between the selected legos
            const newConnections = connections
                .filter(conn =>
                    legosToClone.some(l => l.instanceId === conn.from.legoId) &&
                    legosToClone.some(l => l.instanceId === conn.to.legoId)
                )
                .map(conn => ({
                    from: {
                        legoId: instanceIdMap.get(conn.from.legoId)!,
                        legIndex: conn.from.legIndex
                    },
                    to: {
                        legoId: instanceIdMap.get(conn.to.legoId)!,
                        legIndex: conn.to.legIndex
                    }
                }));

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
                startX: e.clientX,
                startY: e.clientY,
                originalX: lego.x + 20,
                originalY: lego.y + 20,
                justFinished: false
            });

            // Add to history
            addToHistory({
                type: 'add',
                data: {
                    legos: newLegos,
                    connections: newConnections
                }
            });

            // Update URL state
            encodeCanvasState(droppedLegos.concat(newLegos), connections.concat(newConnections));
        } else {
            // Original non-shift behavior
            const isPartOfSelection = manuallySelectedLegos.some(l => l.instanceId === lego.instanceId) ||
                tensorNetwork?.legos.some(l => l.instanceId === lego.instanceId);

            if (isPartOfSelection) {
                const selectedLegos = manuallySelectedLegos.length > 0 ? manuallySelectedLegos : tensorNetwork?.legos || [];
                const positions: { [instanceId: string]: { x: number; y: number } } = {};
                selectedLegos.forEach(l => {
                    positions[l.instanceId] = { x: l.x, y: l.y };
                });

                setGroupDragState({
                    legoInstanceIds: selectedLegos.map(l => l.instanceId),
                    originalPositions: positions
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
        console.log("in click", dragState, " just finished", dragState.justFinished);
        if (dragState.justFinished) {
            setDragState(prev => ({ ...prev, justFinished: false }));
            return; // Skip this click, but be ready for the next one
        }

        if (!dragState.isDragging) {  // Only handle click if not dragging
            e.stopPropagation();

            if (tensorNetwork?.legos.some(l => l.instanceId === lego.instanceId)) {
                setTensorNetwork(null);
                setSelectedLego(lego);
            } else if (selectedLego?.instanceId === lego.instanceId) {
                const network = findConnectedComponent(lego);
                console.log(network);
                setTensorNetwork(network);
                setSelectedLego(null);
            } else {
                setSelectedLego(lego);
                setTensorNetwork(null);
            }
            setManuallySelectedLegos([]);
        }
    }

    const handleCanvasClick = (e: React.MouseEvent) => {
        // Only clear selection if clicking directly on canvas (not on a Lego)
        // and not during or right after selection box usage
        if (e.target === e.currentTarget && !selectionBox.isSelecting && !dragState.isDragging && !selectionBox.justFinished) {
            setSelectedLego(null);
            setTensorNetwork(null);
            setManuallySelectedLegos([]);
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

            setSelectionBox({
                isSelecting: true,
                startX: x,
                startY: y,
                currentX: x,
                currentY: y,
                justFinished: false
            });
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
    const handleSelectionBoxUpdate = (left: number, right: number, top: number, bottom: number) => {
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
            setSelectedLego(selectedLegos[0]);
            setTensorNetwork(null);
            setManuallySelectedLegos(selectedLegos);
        } else if (selectedLegos.length > 1) {
            // Check if all selected Legos form a complete connected component
            const firstLego = selectedLegos[0];
            const connectedComponent = findConnectedComponent(firstLego);
            const isCompleteComponent =
                selectedLegos.length === connectedComponent.legos.length &&
                selectedLegos.every(lego =>
                    connectedComponent.legos.some(l => l.instanceId === lego.instanceId)
                );

            if (isCompleteComponent) {
                setSelectedLego(null);
                setTensorNetwork(connectedComponent);
                setManuallySelectedLegos([]);
            } else {
                setSelectedLego(null);
                setTensorNetwork(null);
                setManuallySelectedLegos(selectedLegos);
            }
        } else {
            setSelectedLego(null);
            setTensorNetwork(null);
            setManuallySelectedLegos([]);
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

            handleSelectionBoxUpdate(left, right, top, bottom);
            return;
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

            // Check if any part of the lego touches the canvas edges (considering 25px radius)
            const isOutsideCanvas =
                newX - 25 < 0 ||
                newX + 25 > rect.width ||
                newY - 25 < 0 ||
                newY + 25 > rect.height;

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
                } else if (manuallySelectedLegos.length > 0 &&
                    manuallySelectedLegos.some(l => l.instanceId === droppedLegos[dragState.draggedLegoIndex].instanceId)) {
                    // If dragging a manually selected lego, move all manually selected legos
                    if (manuallySelectedLegos.some(l => l.instanceId === lego.instanceId)) {
                        return {
                            ...lego,
                            x: lego.x + (e.movementX || 0),
                            y: lego.y + (e.movementY || 0)
                        };
                    }
                    return lego;
                } else if (index === dragState.draggedLegoIndex) {
                    return {
                        ...lego,
                        x: newX,
                        y: newY
                    };
                }
                return lego;
            });

            // Update all legos at once to prevent lag
            setDroppedLegos(updatedLegos);

            // Add visual feedback when touching edges
            const canvas = canvasRef.current;
            if (canvas) {
                canvas.style.boxShadow = isOutsideCanvas ? 'inset 0 0 0 4px #FC8181' : 'inset 0 0 6px rgba(0, 0, 0, 0.1)';
            }
        }

        // Handle leg dragging
        if (legDragState?.isDragging) {
            const mouseX = e.clientX - rect.left;
            const mouseY = e.clientY - rect.top;

            // Update the current position in legDragState
            setLegDragState(prev => ({
                ...prev!,
                currentX: mouseX,
                currentY: mouseY
            }));
        }
    };

    const handleCanvasMouseUp = (e: React.MouseEvent) => {
        const rect = canvasRef.current?.getBoundingClientRect();
        if (!rect) {
            setLegDragState(null);
            return;
        }

        // Handle selection box end
        if (selectionBox.isSelecting) {
            // Calculate final selection box bounds
            const left = Math.min(selectionBox.startX, selectionBox.currentX);
            const right = Math.max(selectionBox.startX, selectionBox.currentX);
            const top = Math.min(selectionBox.startY, selectionBox.currentY);
            const bottom = Math.max(selectionBox.startY, selectionBox.currentY);

            handleSelectionBoxUpdate(left, right, top, bottom);

            setSelectionBox(prev => ({
                ...prev,
                isSelecting: false,
                justFinished: true  // Set the flag when selection box operation ends
            }));
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
                // Determine which legos to remove based on selection state
                let legosToRemove: DroppedLego[] = [];
                if (groupDragState) {
                    // Remove all selected legos
                    legosToRemove = droppedLegos.filter(lego =>
                        groupDragState.legoInstanceIds.includes(lego.instanceId)
                    );
                } else if (manuallySelectedLegos.length > 0 && manuallySelectedLegos.some(l => l.instanceId === droppedLegos[dragState.draggedLegoIndex].instanceId)) {
                    // If dragged lego is part of manual selection, remove all manually selected legos
                    legosToRemove = manuallySelectedLegos;
                } else {
                    // Remove just the dragged lego
                    legosToRemove = [droppedLegos[dragState.draggedLegoIndex]];
                }

                // Get all connections involving the legos to be removed
                const connectionsToRemove = connections.filter(conn =>
                    legosToRemove.some(lego =>
                        conn.from.legoId === lego.instanceId || conn.to.legoId === lego.instanceId
                    )
                );

                // Store original positions for all legos
                const legosWithOriginalPos = legosToRemove.map(lego => ({
                    ...lego,
                    x: groupDragState?.originalPositions[lego.instanceId]?.x || dragState.originalX,
                    y: groupDragState?.originalPositions[lego.instanceId]?.y || dragState.originalY
                }));

                addToHistory({
                    type: 'remove',
                    data: {
                        legos: legosWithOriginalPos,
                        connections: connectionsToRemove
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
                setManuallySelectedLegos([]);
            } else if (deltaX !== 0 || deltaY !== 0) {
                if (groupDragState) {
                    // Record a single group move operation
                    const groupMoves = groupDragState.legoInstanceIds.map(instanceId => ({
                        legoInstanceId: instanceId,
                        oldX: groupDragState.originalPositions[instanceId].x,
                        oldY: groupDragState.originalPositions[instanceId].y,
                        newX: groupDragState.originalPositions[instanceId].x + deltaX,
                        newY: groupDragState.originalPositions[instanceId].y + deltaY
                    }));

                    addToHistory({
                        type: 'move',
                        data: { groupMoves }
                    });
                } else if (manuallySelectedLegos.length > 0 && manuallySelectedLegos.some(l => l.instanceId === droppedLegos[dragState.draggedLegoIndex].instanceId)) {
                    // Record a single group move operation for manually selected legos
                    const groupMoves = manuallySelectedLegos.map(lego => ({
                        legoInstanceId: lego.instanceId,
                        oldX: lego.x - deltaX,
                        oldY: lego.y - deltaY,
                        newX: lego.x,
                        newY: lego.y
                    }));

                    addToHistory({
                        type: 'move',
                        data: { groupMoves }
                    });
                } else {
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
            }

            // Reset canvas visual feedback
            const canvas = canvasRef.current;
            if (canvas) {
                canvas.style.boxShadow = 'inset 0 0 6px rgba(0, 0, 0, 0.1)';
            }

            // Update URL state after the drag operation is complete
            encodeCanvasState(droppedLegos, connections);
        }

        // Handle leg connection
        if (legDragState?.isDragging) {
            const mouseX = e.clientX - rect.left;
            const mouseY = e.clientY - rect.top;

            // Find if we're over another leg
            droppedLegos.find(lego => {
                // Remove the self-connection check to allow connecting to the same lego
                const legCount = lego.parity_check_matrix[0].length / 2;
                for (let i = 0; i < legCount; i++) {
                    const legEndpoint = getLegEndpoint(lego, i);

                    const distance = Math.sqrt(
                        Math.pow(mouseX - legEndpoint.x, 2) +
                        Math.pow(mouseY - legEndpoint.y, 2)
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

                        // Prevent connecting a leg to itself
                        if (lego.instanceId === legDragState.legoId && i === legDragState.legIndex) {
                            setError('Cannot connect a leg to itself');
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



                            setConnections(prev => {
                                const newConnections = [...prev, newConnection];

                                console.log("newConnections", newConnections);
                                encodeCanvasState(droppedLegos, newConnections);

                                return newConnections;
                            });

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
            draggedLegoIndex: -1,
            justFinished: dragState.isDragging
        }));

        setGroupDragState(null);

    };

    const handleCanvasMouseLeave = () => {
        setLegDragState(null);
        // Don't reset drag state here anymore, let it continue until mouse up
    };

    const getLegEndpoint = (lego: DroppedLego, legIndex: number) => {
        const legStyle = lego.style.getLegStyle(legIndex);
        const startX = legStyle.from === "center" ? lego.x :
            legStyle.from === "bottom" ? lego.x + legStyle.startOffset * Math.cos(legStyle.angle) : lego.x;
        const startY = legStyle.from === "center" ? lego.y :
            legStyle.from === "bottom" ? lego.y + legStyle.startOffset * Math.sin(legStyle.angle) : lego.y;
        return {
            x: startX + legStyle.length * Math.cos(legStyle.angle),
            y: startY + legStyle.length * Math.sin(legStyle.angle)
        };
    };

    // Add this new function to find connected components
    const findConnectedComponent = (startLego: DroppedLego) => {
        const visited = new Set<string>();
        const component: DroppedLego[] = [];
        const componentConnections: Connection[] = [];
        const queue: string[] = [startLego.instanceId];
        visited.add(startLego.instanceId);

        // First pass: collect all connected legos using BFS
        while (queue.length > 0) {
            const currentLegoId = queue.shift()!;
            const currentLego = droppedLegos.find(l => l.instanceId === currentLegoId);
            if (!currentLego) continue;
            component.push(currentLego);

            // Find all directly connected legos and add them to queue if not visited
            connections.forEach(conn => {
                if (conn.from.legoId === currentLegoId && !visited.has(conn.to.legoId)) {
                    visited.add(conn.to.legoId);
                    queue.push(conn.to.legoId);
                } else if (conn.to.legoId === currentLegoId && !visited.has(conn.from.legoId)) {
                    visited.add(conn.from.legoId);
                    queue.push(conn.from.legoId);
                }
            });
        }

        // Second pass: collect all connections between the legos in the component
        connections.forEach(conn => {
            if (visited.has(conn.from.legoId) && visited.has(conn.to.legoId)) {
                componentConnections.push(conn);
            }
        });

        return { legos: component, connections: componentConnections };
    };

    // Update addToHistory to clear redo stack when new operations are added
    const addToHistory = (operation: Operation) => {
        setOperationHistory(prev => [...prev, operation]);
        setRedoHistory([]); // Clear redo stack when new operation is performed
    };

    // Add window-level mouse up handler
    useEffect(() => {
        const handleWindowMouseUp = (e: MouseEvent) => {
            if (dragState.isDragging) {
                const canvas = canvasRef.current;
                if (!canvas) return;

                const rect = canvas.getBoundingClientRect();

                // Always remove the Lego if the mouse is released outside the canvas bounds
                const isOutsideCanvas =
                    e.clientX < rect.left ||
                    e.clientX > rect.right ||
                    e.clientY < rect.top ||
                    e.clientY > rect.bottom;

                if (isOutsideCanvas) {
                    if (groupDragState) {
                        // Remove all selected legos and their connections
                        const legosToRemove = droppedLegos.filter(lego =>
                            groupDragState.legoInstanceIds.includes(lego.instanceId)
                        );
                        const connectionsToRemove = connections.filter(conn =>
                            groupDragState.legoInstanceIds.includes(conn.from.legoId) ||
                            groupDragState.legoInstanceIds.includes(conn.to.legoId)
                        );

                        // Store original positions for all legos
                        const legosWithOriginalPos = legosToRemove.map(lego => ({
                            ...lego,
                            x: groupDragState.originalPositions[lego.instanceId].x,
                            y: groupDragState.originalPositions[lego.instanceId].y
                        }));

                        addToHistory({
                            type: 'remove',
                            data: {
                                legos: legosWithOriginalPos,
                                connections: connectionsToRemove
                            }
                        });

                        setConnections(prev => prev.filter(conn =>
                            !groupDragState.legoInstanceIds.includes(conn.from.legoId) &&
                            !groupDragState.legoInstanceIds.includes(conn.to.legoId)
                        ));
                        setDroppedLegos(prev => prev.filter(lego =>
                            !groupDragState.legoInstanceIds.includes(lego.instanceId)
                        ));
                    } else {
                        const legoToRemove = droppedLegos[dragState.draggedLegoIndex];
                        const connectionsToRemove = connections.filter(conn =>
                            conn.from.legoId === legoToRemove.instanceId || conn.to.legoId === legoToRemove.instanceId
                        );

                        // Store the original position instead of the final position
                        const legoWithOriginalPos = {
                            ...legoToRemove,
                            x: dragState.originalX,
                            y: dragState.originalY
                        };
                        addToHistory({
                            type: 'remove',
                            data: {
                                legos: [legoWithOriginalPos],
                                connections: connectionsToRemove
                            }
                        });

                        setConnections(prev => prev.filter(conn =>
                            conn.from.legoId !== legoToRemove.instanceId && conn.to.legoId !== legoToRemove.instanceId
                        ));
                        setDroppedLegos(prev => prev.filter((_, index) => index !== dragState.draggedLegoIndex));
                    }

                    // Reset drag state
                    setDragState(prev => ({
                        ...prev,
                        isDragging: false,
                        draggedLegoIndex: -1
                    }));

                    // Reset canvas visual feedback
                    canvas.style.boxShadow = 'inset 0 0 6px rgba(0, 0, 0, 0.1)';

                    // Update URL state after the drag operation is complete
                    encodeCanvasState(droppedLegos, connections);
                }
            }
        };

        window.addEventListener('mouseup', handleWindowMouseUp);
        return () => window.removeEventListener('mouseup', handleWindowMouseUp);
    }, [dragState, droppedLegos, connections, selectedLego, tensorNetwork, addToHistory, encodeCanvasState, canvasRef]);

    // Handle undo
    const handleUndo = useCallback(() => {
        if (operationHistory.length === 0) return;

        const lastOperation = operationHistory[operationHistory.length - 1];

        // Move the operation to redo history before undoing
        setRedoHistory(prev => [...prev, lastOperation]);

        switch (lastOperation.type) {
            case 'add':
                const addedLegos = lastOperation.data?.legos;
                const addedConnections = lastOperation.data?.connections;
                if (addedLegos) {
                    // Remove all legos that were added in this operation
                    setDroppedLegos(prev => prev.filter(lego =>
                        !addedLegos.some(l => l.instanceId === lego.instanceId)
                    ));
                    // Remove all connections that were added with these legos
                    if (addedConnections) {
                        setConnections(prev => prev.filter(conn =>
                            !addedConnections.some(c =>
                                c.from.legoId === conn.from.legoId &&
                                c.from.legIndex === conn.from.legIndex &&
                                c.to.legoId === conn.to.legoId &&
                                c.to.legIndex === conn.to.legIndex
                            )
                        ));
                    }
                }
                break;
            case 'remove':
                if (lastOperation.data.legos && lastOperation.data.connections) {
                    setDroppedLegos(prev => [...prev, ...(lastOperation.data.legos || [])]);
                    setConnections(prev => [...prev, ...(lastOperation.data.connections || [])]);
                }
                break;
            case 'move':
                if (lastOperation.data.groupMoves) {
                    // Handle group move undo
                    setDroppedLegos(prev => prev.map(lego => {
                        const move = lastOperation.data.groupMoves?.find(m => m.legoInstanceId === lego.instanceId);
                        if (move) {
                            return { ...lego, x: move.oldX, y: move.oldY };
                        }
                        return lego;
                    }));
                } else if (lastOperation.data.legoInstanceId && lastOperation.data.oldX !== undefined && lastOperation.data.oldY !== undefined) {
                    // Handle single lego move undo
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
                const addedLegos = nextOperation.data?.legos;
                const addedConnections = nextOperation.data?.connections;
                if (addedLegos) {
                    // Add all legos from this operation
                    setDroppedLegos(prev => [...prev, ...addedLegos]);
                    // Add all connections that were added with these legos
                    if (addedConnections) {
                        setConnections(prev => [...prev, ...addedConnections]);
                    }
                }
                break;
            case 'remove':
                if (nextOperation.data.legos) {
                    // Handle removal of multiple legos for group deletions
                    const legosToRemove = nextOperation.data.legos;
                    setDroppedLegos(prev => prev.filter(lego =>
                        !legosToRemove.some(removeMe => removeMe.instanceId === lego.instanceId)
                    ));
                    setConnections(prev => prev.filter(conn =>
                        !legosToRemove.some(lego =>
                            conn.from.legoId === lego.instanceId || conn.to.legoId === lego.instanceId
                        )
                    ));
                }
                break;
            case 'move':
                if (nextOperation.data.groupMoves) {
                    // Handle group move redo
                    setDroppedLegos(prev => prev.map(lego => {
                        const move = nextOperation.data.groupMoves?.find(m => m.legoInstanceId === lego.instanceId);
                        if (move) {
                            return { ...lego, x: move.newX, y: move.newY };
                        }
                        return lego;
                    }));
                } else if (nextOperation.data.legoInstanceId && nextOperation.data.newX !== undefined && nextOperation.data.newY !== undefined) {
                    // Handle single lego move redo
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

    // Update keyboard event listener for both Ctrl+Z, Ctrl+Y and Delete
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
                e.preventDefault();
                handleUndo();
            } else if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.shiftKey && e.key === 'Z'))) {
                e.preventDefault();
                handleRedo();
            } else if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
                e.preventDefault();
                if (droppedLegos.length > 0) {
                    // Check if all legos form a connected component
                    const network = findConnectedComponent(droppedLegos[0]);
                    if (network.legos.length === droppedLegos.length) {
                        // All legos are connected - show as network
                        setSelectedLego(null);
                        setTensorNetwork(network);
                        setManuallySelectedLegos([]);
                    } else {
                        // Not all connected - show as manual selection
                        setSelectedLego(null);
                        setTensorNetwork(null);
                        setManuallySelectedLegos(droppedLegos);
                    }
                }
            } else if (e.key === 'Delete') {
                // Handle deletion of selected legos
                let legosToRemove: DroppedLego[] = [];

                if (tensorNetwork) {
                    legosToRemove = tensorNetwork.legos;
                } else if (manuallySelectedLegos.length > 0) {
                    legosToRemove = manuallySelectedLegos;
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
                    addToHistory({
                        type: 'remove',
                        data: {
                            legos: legosToRemove,
                            connections: connectionsToRemove
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
                    setManuallySelectedLegos([]);

                    // Update URL state
                    encodeCanvasState(droppedLegos, connections);
                }
            } else if (e.key === 'Escape') {
                // Dismiss error message when Escape is pressed
                setError('');
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [handleUndo, handleRedo, tensorNetwork, selectedLego, manuallySelectedLegos, connections, droppedLegos, addToHistory, encodeCanvasState]);

    const handleConnectionDoubleClick = (e: React.MouseEvent, connection: Connection) => {
        e.preventDefault();
        e.stopPropagation();

        // Add to history before removing
        addToHistory({
            type: 'disconnect',
            data: { connections: [connection] }
        });

        // Remove the connection and update URL state with the new connections
        setConnections(prev => {
            const newConnections = prev.filter(conn =>
                !(conn.from.legoId === connection.from.legoId &&
                    conn.from.legIndex === connection.from.legIndex &&
                    conn.to.legoId === connection.to.legoId &&
                    conn.to.legIndex === connection.to.legIndex)
            );
            encodeCanvasState(droppedLegos, newConnections);
            return newConnections;
        });
    };

    const handleClearAll = () => {
        if (droppedLegos.length === 0 && connections.length === 0) return;

        // Store current state for history
        addToHistory({
            type: 'remove',
            data: {
                legos: droppedLegos,
                connections: connections
            }
        });

        // Clear all state
        setDroppedLegos([]);
        setConnections([]);
        setSelectedLego(null);
        setTensorNetwork(null);
        setManuallySelectedLegos([]);

        // Update URL state
        encodeCanvasState([], []);
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
                    <MenuButton
                        as={Button}
                        variant="ghost"
                        size="sm"
                    >
                        Examples
                    </MenuButton>
                    <MenuList>
                        <MenuItem>Surface code from [[5,1,2]] legos</MenuItem>
                        <MenuItem>Bacon-Shor code</MenuItem>
                        <MenuItem>Steane code from [[6,0,2]] legos</MenuItem>
                    </MenuList>
                </Menu>
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleClearAll}
                >
                    Remove all
                </Button>
            </HStack>

            {/* Main Content */}
            <Box flex={1} position="relative" overflow="hidden">
                <PanelGroup direction="horizontal">
                    {/* Left Panel */}
                    <Panel defaultSize={20} minSize={15}>
                        <LegoPanel
                            legos={legos}
                            onDragStart={handleDragStart}
                            onLegoSelect={(lego) => {
                                // Handle lego selection if needed
                                console.log('Selected lego:', lego)
                            }}
                        />
                    </Panel>

                    <ResizeHandle position="right" />

                    {/* Main Content */}
                    <Panel defaultSize={60} minSize={30}>
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
                                onMouseMove={handleCanvasMouseMove}
                                onMouseUp={handleCanvasMouseUp}
                                onMouseLeave={handleCanvasMouseLeave}
                                onClick={handleCanvasClick}
                                onMouseDown={handleCanvasMouseDown}
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

                                            // Calculate control points for the curve
                                            const fromLegStyle = fromLego.style.getLegStyle(conn.from.legIndex);
                                            const toLegStyle = toLego.style.getLegStyle(conn.to.legIndex);

                                            // Get vectors pointing in the direction of the legs
                                            const fromVector = {
                                                x: Math.cos(fromLegStyle.angle),
                                                y: Math.sin(fromLegStyle.angle)
                                            };
                                            const toVector = {
                                                x: Math.cos(toLegStyle.angle),
                                                y: Math.sin(toLegStyle.angle)
                                            };

                                            // Calculate control points by extending the leg directions
                                            const controlPointDistance = 30; // Distance of control points from endpoints
                                            const cp1 = {
                                                x: fromPoint.x + fromVector.x * controlPointDistance,
                                                y: fromPoint.y + fromVector.y * controlPointDistance
                                            };
                                            const cp2 = {
                                                x: toPoint.x + toVector.x * controlPointDistance,
                                                y: toPoint.y + toVector.y * controlPointDistance
                                            };

                                            // Create the path string for the cubic Bezier curve
                                            const pathString = `M ${fromPoint.x} ${fromPoint.y} C ${cp1.x} ${cp1.y}, ${cp2.x} ${cp2.y}, ${toPoint.x} ${toPoint.y}`;

                                            return (
                                                <g key={`conn-${index}`}>
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
                                                                visiblePath.style.stroke = '#4299E1';
                                                                visiblePath.style.strokeWidth = '3';
                                                                visiblePath.style.filter = 'drop-shadow(0 0 2px rgba(66, 153, 225, 0.5))';
                                                            }
                                                        }}
                                                        onMouseLeave={(e) => {
                                                            // Reset the visible path
                                                            const visiblePath = e.currentTarget.nextSibling as SVGPathElement;
                                                            if (visiblePath) {
                                                                visiblePath.style.stroke = '#3182CE';
                                                                visiblePath.style.strokeWidth = '2';
                                                                visiblePath.style.filter = 'none';
                                                            }
                                                        }}
                                                    />
                                                    {/* Visible path */}
                                                    <path
                                                        d={pathString}
                                                        stroke="#3182CE"
                                                        strokeWidth="2"
                                                        fill="none"
                                                        style={{
                                                            pointerEvents: 'none',
                                                            transition: 'all 0.2s ease'
                                                        }}
                                                    />
                                                </g>
                                            );
                                        })}
                                    </g>

                                    {/* Temporary line while dragging */}
                                    {legDragState?.isDragging && (() => {
                                        const fromLego = droppedLegos.find(l => l.instanceId === legDragState.legoId);
                                        if (!fromLego) return null;

                                        const legStyle = fromLego.style.getLegStyle(legDragState.legIndex);
                                        const startX = legStyle.from === "center" ? fromLego.x :
                                            legStyle.from === "bottom" ? fromLego.x + legStyle.startOffset * Math.cos(legStyle.angle) : fromLego.x;
                                        const startY = legStyle.from === "center" ? fromLego.y :
                                            legStyle.from === "bottom" ? fromLego.y + legStyle.startOffset * Math.sin(legStyle.angle) : fromLego.y;
                                        const fromPoint = {
                                            x: startX + legStyle.length * Math.cos(legStyle.angle),
                                            y: startY + legStyle.length * Math.sin(legStyle.angle)
                                        };

                                        // Calculate control point for the temporary curve
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
                                        Array(lego.parity_check_matrix[0].length / 2).fill(0).map((_, legIndex) => {
                                            const legStyle = lego.style.getLegStyle(legIndex);
                                            const labelX = lego.x + (legStyle.length + 10) * Math.cos(legStyle.angle);
                                            const labelY = lego.y + (legStyle.length + 10) * Math.sin(legStyle.angle);

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
                                        manuallySelectedLegos={manuallySelectedLegos}
                                        dragState={dragState}
                                    />
                                ))}
                            </Box>
                        </Box>
                    </Panel>

                    <ResizeHandle position="left" />

                    {/* Right Panel */}
                    <Panel defaultSize={20} minSize={20}>
                        <DetailsPanel
                            tensorNetwork={tensorNetwork}
                            selectedLego={selectedLego}
                            manuallySelectedLegos={manuallySelectedLegos}
                            droppedLegos={droppedLegos}
                            setTensorNetwork={setTensorNetwork}
                            setError={setError}
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
        </VStack >
    )
}

export default App 