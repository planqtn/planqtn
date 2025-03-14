import { Box, Heading, List, ListItem, HStack, VStack, Icon, Text, Badge, useColorModeValue, useToast } from '@chakra-ui/react'
import { FaCube, FaCode, FaTable } from 'react-icons/fa'
import { LegoPiece } from '../types.ts'
import { DynamicLegoDialog } from './DynamicLegoDialog'
import { useState } from 'react'

interface LegoPanelProps {
    legos: LegoPiece[]
    onLegoSelect: (lego: LegoPiece) => void
    onDragStart: (e: React.DragEvent<HTMLLIElement>, lego: LegoPiece) => void
}

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

export const LegoPanel: React.FC<LegoPanelProps> = ({ legos, onLegoSelect, onDragStart }) => {
    const toast = useToast()
    const [isDialogOpen, setIsDialogOpen] = useState(false)
    const [selectedDynamicLego, setSelectedDynamicLego] = useState<LegoPiece | null>(null)

    const handleDragStart = (e: React.DragEvent<HTMLLIElement>, lego: LegoPiece) => {
        onDragStart(e, lego)
    }

    const handleDynamicLegoSubmit = async (parameters: Record<string, any>) => {
        if (!selectedDynamicLego) return

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
            onLegoSelect(dynamicLego)
        } catch (error) {
            toast({
                title: 'Error',
                description: 'Failed to create dynamic lego',
                status: 'error',
                duration: 3000,
                isClosable: true,
            })
        }
    }

    const bgColor = useColorModeValue('white', 'gray.800')
    const borderColor = useColorModeValue('gray.200', 'gray.600')

    return (
        <Box
            h="100%"
            borderRight="1px"
            borderColor={borderColor}
            bg={bgColor}
            overflowY="auto"
        >
            <VStack align="stretch" spacing={4} p={4}>
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
                            onClick={() => !lego.is_dynamic && onLegoSelect(lego)}
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

            <DynamicLegoDialog
                isOpen={isDialogOpen}
                onClose={() => {
                    setIsDialogOpen(false)
                    setSelectedDynamicLego(null)
                }}
                onSubmit={handleDynamicLegoSubmit}
                legoId={selectedDynamicLego?.id || ''}
                parameters={selectedDynamicLego?.parameters || {}}
            />
        </Box>
    )
}

export default LegoPanel 