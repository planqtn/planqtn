import { Box, Container, Heading, Text, VStack, HStack, List, ListItem, Icon, Badge, useColorModeValue } from '@chakra-ui/react'
import { useEffect, useState } from 'react'
import axios from 'axios'
import { FaCube, FaCode, FaTable } from 'react-icons/fa'

interface LegoPiece {
    id: string
    name: string
    type: string
    description: string
    is_dynamic?: boolean
    parameters?: Record<string, any>
}

function App() {
    const [message, setMessage] = useState<string>('Loading...')
    const [legos, setLegos] = useState<LegoPiece[]>([])
    const [error, setError] = useState<string>('')

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
                                cursor="pointer"
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
            <Box flex={1} p={8}>
                <VStack spacing={8}>
                    <Heading>TNQEC UI</Heading>
                    <Box p={6} borderWidth={1} borderRadius="lg">
                        <Text>Backend Status: {message}</Text>
                    </Box>
                </VStack>
            </Box>
        </HStack>
    )
}

export default App 