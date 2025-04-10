import { Box, Heading, List, ListItem, HStack, VStack, Icon, Text, Badge, useColorModeValue, useToast } from '@chakra-ui/react'
import { FaCube, FaCode, FaTable } from 'react-icons/fa'
import { LegoPiece } from '../types.ts'
import { DynamicLegoDialog } from './DynamicLegoDialog'
import { useState } from 'react'
import { config } from '../config'
import { DroppedLegoDisplay } from './DroppedLegoDisplay.tsx'
import { getLegoStyle } from '../LegoStyles.ts'

interface LegoPanelProps {
    legos: LegoPiece[]
    onLegoSelect: (lego: LegoPiece) => void
    onDragStart: (e: React.DragEvent<HTMLLIElement>, lego: LegoPiece) => void
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
            const response = await fetch(`${config.backendUrl}/dynamiclego`, {
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
                    {legos.map((lego) => {
                        const numLegs = lego.parity_check_matrix[0].length / 2;
                        return (

                            <ListItem
                                key={lego.id}
                                p={2}
                                borderWidth="1px"
                                borderRadius="md"
                                _hover={{ bg: 'gray.50' }}
                                cursor="move"
                                draggable
                                onDragStart={(e) => handleDragStart(e, lego)}
                            >
                                <HStack p={2}>
                                    <Box position="relative" w={50} h={50} >
                                        <DroppedLegoDisplay
                                            lego={{
                                                // not sure why the Box based rendered legos (num legs <=2) are not centered, and why the svg one leg==3 ones need to bump either...
                                                ...lego, x: numLegs <= 3 ? 13 : 5, y: numLegs <= 3 ? 20 : 13, instanceId: lego.id,
                                                style: getLegoStyle(lego.id, numLegs),
                                                pushedLegs: [],
                                                selectedMatrixRows: []
                                            }}
                                            connections={[]}
                                            index={0}
                                            legDragState={null}
                                            handleLegMouseDown={() => { }}
                                            handleLegoMouseDown={() => { }}
                                            handleLegoClick={() => { }}
                                            tensorNetwork={null}
                                            selectedLego={null}
                                            dragState={null}
                                            hideConnectedLegs={false}
                                            droppedLegos={[]}
                                            demoMode={true}
                                        />

                                    </Box>
                                    <VStack align="start" spacing={1}>
                                        {lego.is_dynamic && (
                                            <Badge colorScheme="green">Dynamic</Badge>
                                        )}
                                        <Text display="block" fontWeight="bold">{lego.name}</Text>
                                    </VStack>


                                </HStack>
                            </ListItem>
                        )
                    }

                    )}
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