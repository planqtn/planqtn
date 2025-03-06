import { Box, Container, Heading, Text, VStack, HStack, List, ListItem, Icon, Badge, useColorModeValue } from '@chakra-ui/react'
import { useEffect, useState, useRef } from 'react'
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
}

interface DroppedLego extends LegoPiece {
    x: number
    y: number
}

interface DragState {
    isDragging: boolean
    draggedLegoIndex: number
    startX: number
    startY: number
    originalX: number
    originalY: number
}

function App() {
    const [message, setMessage] = useState<string>('Loading...')
    const [legos, setLegos] = useState<LegoPiece[]>([])
    const [droppedLegos, setDroppedLegos] = useState<DroppedLego[]>([])
    const [error, setError] = useState<string>('')
    const [dragState, setDragState] = useState<DragState>({
        isDragging: false,
        draggedLegoIndex: -1,
        startX: 0,
        startY: 0,
        originalX: 0,
        originalY: 0
    })
    const canvasRef = useRef<HTMLDivElement>(null)

    const bgColor = useColorModeValue('white', 'gray.800')
    const borderColor = useColorModeValue('gray.200', 'gray.600')

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
            setDroppedLegos(prev => [...prev, { ...lego, x, y }])
        }
    }

    const handleLegoMouseDown = (e: React.MouseEvent, index: number) => {
        e.stopPropagation()
        const lego = droppedLegos[index]
        setDragState({
            isDragging: true,
            draggedLegoIndex: index,
            startX: e.clientX,
            startY: e.clientY,
            originalX: lego.x,
            originalY: lego.y
        })
    }

    const handleCanvasMouseMove = (e: React.MouseEvent) => {
        if (!dragState.isDragging) return

        const deltaX = e.clientX - dragState.startX
        const deltaY = e.clientY - dragState.startY

        setDroppedLegos(prev => prev.map((lego, index) => {
            if (index === dragState.draggedLegoIndex) {
                return {
                    ...lego,
                    x: dragState.originalX + deltaX,
                    y: dragState.originalY + deltaY
                }
            }
            return lego
        }))
    }

    const handleCanvasMouseUp = () => {
        setDragState(prev => ({
            ...prev,
            isDragging: false,
            draggedLegoIndex: -1
        }))
    }

    const handleCanvasMouseLeave = () => {
        if (dragState.isDragging) {
            handleCanvasMouseUp()
        }
    }

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
                >
                    {droppedLegos.map((lego, index) => (
                        <Box
                            key={`${lego.id}-${index}`}
                            position="absolute"
                            left={`${lego.x - 25}px`}
                            top={`${lego.y - 25}px`}
                            w="50px"
                            h="50px"
                            borderRadius="full"
                            bg="white"
                            border="2px"
                            borderColor="blue.500"
                            display="flex"
                            alignItems="center"
                            justifyContent="center"
                            cursor={dragState.isDragging && dragState.draggedLegoIndex === index ? "grabbing" : "grab"}
                            title={lego.name}
                            boxShadow="md"
                            _hover={{ boxShadow: "lg" }}
                            onMouseDown={(e) => handleLegoMouseDown(e, index)}
                            style={{
                                transform: dragState.isDragging && dragState.draggedLegoIndex === index
                                    ? 'scale(1.05)'
                                    : 'scale(1)',
                                transition: 'transform 0.1s',
                                userSelect: 'none'
                            }}
                        >
                            <Text fontSize="xs" fontWeight="bold" noOfLines={1}>
                                {lego.shortName}
                            </Text>
                        </Box>
                    ))}
                </Box>
            </Box>
        </HStack>
    )
}

export default App 