import { Box, Heading, List, ListItem, HStack, VStack, Icon, Text, Badge, useColorModeValue } from '@chakra-ui/react'
import { FaCube, FaCode, FaTable } from 'react-icons/fa'
import { LegoPiece } from '../types.ts'

interface LegoPanelProps {
    legos: LegoPiece[]
    onDragStart: (e: React.DragEvent, lego: LegoPiece) => void
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

const LegoPanel: React.FC<LegoPanelProps> = ({ legos, onDragStart }) => {
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
                            onDragStart={(e) => onDragStart(e, lego)}
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
    )
}

export default LegoPanel 