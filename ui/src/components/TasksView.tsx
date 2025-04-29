import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
    Box,
    VStack,
    HStack,
    Text,
    Divider,
    useColorModeValue,
    Spinner,
    Badge,
    Code,
    useToast,
} from '@chakra-ui/react';
import axios from 'axios';
import { Panel, PanelGroup } from 'react-resizable-panels';
import { ResizeHandle } from './ResizeHandle';

interface Task {
    id: string;
    name: string;
    state: string;
    start_time: string | null;
    worker: string;
    args: any[];
    kwargs: Record<string, any>;
    info: Record<string, any>;
    status: 'active' | 'reserved' | 'scheduled';
}

interface WebSocketMessage {
    type: 'task_added' | 'task_updated' | 'task_removed';
    task?: Task;
    taskId?: string;
}

const TasksView: React.FC = () => {
    // State hooks
    const [tasks, setTasks] = useState<Task[]>([]);
    const [selectedTask, setSelectedTask] = useState<Task | null>(null);
    const [loading, setLoading] = useState(true);
    const [isConnected, setIsConnected] = useState(false);

    // Refs
    const ws = useRef<WebSocket | null>(null);
    const selectedTaskRef = useRef<Task | null>(null);

    // Update the ref whenever selectedTask changes
    useEffect(() => {
        selectedTaskRef.current = selectedTask;
    }, [selectedTask]);

    // Theme hooks
    const bgColor = useColorModeValue('white', 'gray.800');
    const borderColor = useColorModeValue('gray.200', 'gray.600');
    const hoverBgColor = useColorModeValue('gray.50', 'gray.600');
    const selectedBgColor = useColorModeValue('gray.100', 'gray.700');

    // Other hooks
    const toast = useToast();

    // WebSocket connection and message handling
    const connectWebSocket = useCallback(() => {
        // Don't create a new connection if one already exists
        if (ws.current && ws.current.readyState === WebSocket.OPEN) {
            console.log('WebSocket already connected');
            return;
        }

        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//localhost:5005/ws/tasks`;

        ws.current = new WebSocket(wsUrl);

        ws.current.onopen = () => {
            setIsConnected(true);
            console.log('WebSocket connected');
        };

        ws.current.onclose = () => {
            setIsConnected(false);
            console.log('WebSocket disconnected');
            // Attempt to reconnect after a delay
            setTimeout(connectWebSocket, 5000);
        };

        ws.current.onerror = (error) => {
            console.error('WebSocket error:', error);
            toast({
                title: 'WebSocket Error',
                description: 'Connection to task updates lost',
                status: 'error',
                duration: 5000,
                isClosable: true,
            });
        };

        ws.current.onmessage = (event) => {
            const message: WebSocketMessage = JSON.parse(event.data);
            console.log('Received WebSocket message:', message);

            if (!message || !message.type) {
                console.warn('Invalid WebSocket message format:', message);
                return;
            }

            switch (message.type) {
                case 'task_added':
                    if (!message.task) {
                        console.warn('Missing task data in task_added message');
                        return;
                    }
                    const newTask = message.task;
                    console.log('Adding new task:', newTask);
                    setTasks(prevTasks => {
                        // Check if task already exists
                        if (prevTasks.some(task => task.id === newTask.id)) {
                            console.log('Task already exists, skipping:', newTask.id);
                            return prevTasks;
                        }
                        const newTasks = [...prevTasks, newTask];
                        console.log('Updated tasks list:', newTasks);
                        return newTasks;
                    });
                    break;
                case 'task_updated':
                    if (!message.task) {
                        console.warn('Missing task data in task_updated message');
                        return;
                    }
                    const updatedTask = message.task;
                    console.log('Updating task:', updatedTask);
                    setTasks(prevTasks => {
                        const newTasks = prevTasks.map(task =>
                            task.id === updatedTask.id ? { ...task, ...updatedTask } : task
                        );
                        console.log('Updated tasks list:', newTasks);
                        return newTasks;
                    });
                    // Update selected task if it's the one being updated
                    if (selectedTaskRef.current?.id === updatedTask.id) {
                        setSelectedTask(prev => prev ? { ...prev, ...updatedTask } : null);
                    }
                    break;
                case 'task_removed':
                    if (!message.taskId) {
                        console.warn('Missing taskId in task_removed message');
                        return;
                    }
                    setTasks(prevTasks => prevTasks.filter(task => task.id !== message.taskId));
                    if (selectedTaskRef.current?.id === message.taskId) {
                        setSelectedTask(null);
                    }
                    break;
                default:
                    console.warn('Unknown message type:', message.type);
            }
        };
    }, [toast]);

    // Initial data fetch and WebSocket connection
    useEffect(() => {
        let mounted = true;

        const initialize = async () => {
            try {
                setLoading(true);
                // Load first page of tasks
                const response = await axios.get('/api/list_tasks', {
                    params: {
                        limit: 50,
                        offset: 0
                    }
                });
                if (mounted) {
                    setTasks(response.data);
                    // Only connect WebSocket after successful initial load
                    connectWebSocket();
                }
            } catch (error) {
                console.error('Error fetching tasks:', error);
                if (mounted) {
                    toast({
                        title: 'Error fetching tasks',
                        description: 'Failed to load task list',
                        status: 'error',
                        duration: 5000,
                        isClosable: true,
                    });
                }
            } finally {
                if (mounted) {
                    setLoading(false);
                }
            }
        };

        initialize();

        // Cleanup function
        return () => {
            mounted = false;
            if (ws.current) {
                console.log('Closing WebSocket connection');
                ws.current.close();
                ws.current = null;
            }
        };
    }, [connectWebSocket, toast]);

    // Helper functions
    const getStateColor = (state: string) => {
        switch (state) {
            case 'SUCCESS':
                return 'green';
            case 'FAILURE':
                return 'red';
            case 'PENDING':
                return 'yellow';
            case 'PROGRESS':
                return 'blue';
            default:
                return 'gray';
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'active':
                return 'green';
            case 'reserved':
                return 'yellow';
            case 'scheduled':
                return 'blue';
            default:
                return 'gray';
        }
    };

    const formatDate = (dateString: string | null) => {
        if (!dateString) return 'Not started';
        const date = new Date(dateString);
        return date.toLocaleString();
    };

    if (loading) {
        return (
            <Box p={4}>
                <Spinner />
            </Box>
        );
    }

    return (
        <PanelGroup direction="horizontal">
            {/* Task List Panel */}
            <Panel id="task-list-panel" defaultSize={40} minSize={20} order={1}>
                <Box
                    height="100%"
                    overflowY="auto"
                    bg={bgColor}
                    borderRadius="md"
                    boxShadow="md"
                    p={4}
                >
                    <HStack mb={4} justify="space-between">
                        <Text fontWeight="bold">Tasks</Text>
                        <Badge colorScheme={isConnected ? "green" : "red"}>
                            {isConnected ? "Connected" : "Disconnected"}
                        </Badge>
                    </HStack>
                    <VStack align="stretch" spacing={2}>
                        {tasks.map((task) => (
                            <Box
                                key={task.id}
                                p={3}
                                borderRadius="md"
                                bg={selectedTask?.id === task.id ? selectedBgColor : 'transparent'}
                                cursor="pointer"
                                onClick={() => setSelectedTask(task)}
                                _hover={{ bg: hoverBgColor }}
                            >
                                <HStack justify="space-between">
                                    <Text fontWeight="bold">{task.name}</Text>
                                    <Badge colorScheme={getStateColor(task.state)}>{task.state}</Badge>
                                </HStack>
                                <Text fontSize="sm" color="gray.500">
                                    {formatDate(task.start_time)}
                                </Text>
                                <Badge colorScheme={getStatusColor(task.status)}>{task.status}</Badge>
                            </Box>
                        ))}
                    </VStack>
                </Box>
            </Panel>

            <ResizeHandle id="task-details-resize-handle" />

            {/* Task Details Panel */}
            <Panel id="task-details-panel" defaultSize={60} minSize={30} order={2}>
                <Box
                    height="100%"
                    overflowY="auto"
                    bg={bgColor}
                    borderRadius="md"
                    boxShadow="md"
                    p={4}
                >
                    {selectedTask ? (
                        <VStack align="stretch" spacing={4}>
                            <Text fontSize="xl" fontWeight="bold">
                                Task Details
                            </Text>
                            <Divider />
                            <Box>
                                <Text fontWeight="bold">ID:</Text>
                                <Code p={2} display="block" whiteSpace="pre-wrap">
                                    {selectedTask.id}
                                </Code>
                            </Box>
                            <Box>
                                <Text fontWeight="bold">State:</Text>
                                <Badge colorScheme={getStateColor(selectedTask.state)}>
                                    {selectedTask.state}
                                </Badge>
                            </Box>
                            <Box>
                                <Text fontWeight="bold">Status:</Text>
                                <Badge colorScheme={getStatusColor(selectedTask.status)}>
                                    {selectedTask.status}
                                </Badge>
                            </Box>
                            <Box>
                                <Text fontWeight="bold">Worker:</Text>
                                <Text>{selectedTask.worker}</Text>
                            </Box>
                            <Box>
                                <Text fontWeight="bold">Start Time:</Text>
                                <Text>{formatDate(selectedTask.start_time)}</Text>
                            </Box>
                            {/* <Box>
                                <Text fontWeight="bold">Arguments:</Text>
                                <Code p={2} display="block" whiteSpace="pre-wrap">
                                    {JSON.stringify(selectedTask.args, null, 2)}
                                </Code>
                            </Box> */}
                            <Box>
                                <Text fontWeight="bold">Info:</Text>
                                <Code p={2} display="block" whiteSpace="pre-wrap">
                                    {JSON.stringify(selectedTask.info, null, 2)}
                                </Code>
                            </Box>
                        </VStack>
                    ) : (
                        <Text>Select a task to view details</Text>
                    )}
                </Box>
            </Panel>
        </PanelGroup>
    );
};

export default TasksView; 