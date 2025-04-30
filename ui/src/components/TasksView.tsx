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
    IconButton,
} from '@chakra-ui/react';
import { CloseIcon } from '@chakra-ui/icons';
import axios from 'axios';
import { Panel, PanelGroup } from 'react-resizable-panels';
import { ResizeHandle } from './ResizeHandle';
import ProgressBars from './ProgressBars';

interface CeleryEvent {
    hostname: string;
    utcoffset: number;
    pid: number;
    clock: number;
    uuid: string;
    name: string;
    args: string;
    kwargs: string;
    root_id: string;
    parent_id: string | null;
    retries: number;
    eta: string | null;
    expires: string | null;
    timestamp: number;
    type: string;
    local_received: number;
    result?: string;
    runtime?: number;
}

interface Task {
    uuid: string;
    name: string;
    title: string;
    state: string;
    received: number;
    started: number | null;
    succeeded: number | null;
    runtime: number | null;
    worker: string;
    result: string | null;
    exception: string | null;
    traceback: string | null;
    args: string;
    kwargs: string;
    revoked: number | null;
}

interface WebSocketMessage {
    type: 'task_added' | 'task_updated' | 'task_removed';
    task?: Task;
    taskId?: string;
}

interface TaskUpdateMessage {
    type: string;
    message: {
        updates: {
            status: string;
            iteration_status: Array<{
                desc: string;
                total_size: number;
                current_item: number;
                start_time: number;
                end_time: number | null;
                duration: number;
                avg_time_per_item: number;
            }>;
        };
    };
}

const TasksView: React.FC = () => {
    // State hooks
    const [tasks, setTasks] = useState<Task[]>([]);
    const [selectedTask, setSelectedTask] = useState<Task | null>(null);
    const [loading, setLoading] = useState(true);
    const [isConnected, setIsConnected] = useState(false);
    const [iterationStatus, setIterationStatus] = useState<Array<{
        desc: string;
        total_size: number;
        current_item: number;
        start_time: number;
        end_time: number | null;
        duration: number;
        avg_time_per_item: number;
    }>>([]);

    // Refs
    const ws = useRef<WebSocket | null>(null);
    const selectedTaskRef = useRef<Task | null>(null);
    const taskWebSocket = useRef<WebSocket | null>(null);

    // Update the ref whenever selectedTask changes
    useEffect(() => {
        selectedTaskRef.current = selectedTask;
    }, [selectedTask]);

    // Theme hooks
    const bgColor = useColorModeValue('white', 'gray.800');
    const hoverBgColor = useColorModeValue('gray.50', 'gray.600');
    const selectedBgColor = useColorModeValue('gray.100', 'gray.700');

    // Other hooks
    const toast = useToast();

    const processCeleryEvent = (event: CeleryEvent) => {
        setTasks(prevTasks => {
            const taskIndex = prevTasks.findIndex(t => t.uuid === event.uuid);
            const newTask = taskIndex >= 0 ? { ...prevTasks[taskIndex] } : {
                uuid: event.uuid,
                name: event.name,
                title: event.uuid,
                state: 'PENDING',
                received: event.timestamp,
                started: null,
                succeeded: null,
                runtime: null,
                worker: event.hostname,
                result: null,
                exception: null,
                traceback: null,
                args: event.args,
                kwargs: event.kwargs,
                revoked: null
            };

            switch (event.type) {
                case 'task-received':
                    newTask.state = 'PENDING';
                    newTask.received = event.timestamp;
                    break;
                case 'task-started':
                    newTask.state = 'STARTED';
                    newTask.started = event.timestamp;
                    newTask.args = event.args;

                    break;
                case 'task-succeeded':
                    newTask.state = 'SUCCESS';
                    newTask.succeeded = event.timestamp;
                    if (event.args) {
                        newTask.title = event.uuid + " " + parseTaskTitleFromArgs(JSON.parse(event.args));
                    }
                    console.log('Args:', newTask.args);
                    newTask.runtime = event.runtime || null;
                    newTask.result = event.result || null;
                    break;
                case 'task-failed':
                    newTask.state = 'FAILURE';
                    newTask.succeeded = event.timestamp;
                    newTask.runtime = event.runtime || null;
                    newTask.exception = event.result || null;
                    break;
                case 'task-revoked':
                    newTask.state = 'REVOKED';
                    newTask.revoked = event.timestamp;
                    break;
            }

            const newTasks = taskIndex >= 0
                ? [...prevTasks.slice(0, taskIndex), newTask, ...prevTasks.slice(taskIndex + 1)]
                : [...prevTasks, newTask];

            // Sort tasks by received time in descending order
            return newTasks.sort((a, b) => (b.received || 0) - (a.received || 0));
        });
    };

    // WebSocket connection and message handling
    const connectWebSocket = useCallback(() => {
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
            try {
                const eventData: CeleryEvent = JSON.parse(event.data);
                console.log('Received Celery event:', eventData);
                processCeleryEvent(eventData);
            } catch (error) {
                console.error('Error processing WebSocket message:', error);
            }
        };
    }, [toast]);

    // Add WebSocket connection for selected task
    useEffect(() => {
        if (selectedTask) {
            // Close any existing WebSocket connection
            if (taskWebSocket.current) {
                taskWebSocket.current.close();
            }

            // Create new WebSocket connection for specific task
            const ws = new WebSocket(`ws://localhost:5005/ws/task/${selectedTask.uuid}`);

            ws.onopen = () => {
                console.log("Task update WebSocket opened for task:", selectedTask.uuid);
                taskWebSocket.current = ws;
            };

            ws.onmessage = (event) => {
                const message: TaskUpdateMessage = JSON.parse(event.data);
                if (message.type === 'task_updated' && message.message.updates.iteration_status) {
                    setIterationStatus(message.message.updates.iteration_status);
                }
            };

            ws.onclose = () => {
                console.log("Task update WebSocket closed for task:", selectedTask.uuid);
                taskWebSocket.current = null;
            };

            ws.onerror = (event) => {
                console.error("Task update WebSocket error for task:", selectedTask.uuid, event);
            };

            // Cleanup function
            return () => {
                if (ws.readyState === WebSocket.OPEN) {
                    ws.close();
                }
            };
        } else {
            // Clear iteration status when no task is selected
            setIterationStatus([]);
        }
    }, [selectedTask]);

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
                    console.log('Initial tasks:', response.data);
                    for (const task of response.data) {
                        task.title = parseTaskTitleFromArgs(task.args);
                    }
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
            case 'STARTED':
                return 'blue';
            case 'REVOKED':
                return 'orange';
            default:
                return 'gray';
        }
    };


    const formatDate = (timestamp: number | null) => {
        if (!timestamp) return 'Not started';
        const date = new Date(timestamp * 1000); // Convert from seconds to milliseconds
        return date.toLocaleString();
    };

    const formatRuntime = (runtime: number | null) => {
        if (!runtime) return 'N/A';
        return `${runtime.toFixed(2)}s`;
    };

    const parseTaskTitleFromArgs = (args: Array<any>) => {
        try {
            if (args.length > 0) {
                const firstArg = args[0];
                if (firstArg.legos) {
                    return `${Object.keys(firstArg.legos).length} legos`;
                }
            }
            return 'Unknown task';
        } catch (e) {
            console.error('Error parsing task args:', e);
            return 'Invalid task data:' + e;
        }
    };

    const handleCancelTask = async (taskId: string) => {
        try {
            await axios.post('/api/cancel_task', { task_id: taskId });
            toast({
                title: 'Task cancelled',
                description: `Task ${taskId} has been cancelled`,
                status: 'success',
                duration: 3000,
                isClosable: true,
            });
        } catch (error) {
            console.error('Error cancelling task:', error);
            toast({
                title: 'Error cancelling task',
                description: 'Failed to cancel the task',
                status: 'error',
                duration: 3000,
                isClosable: true,
            });
        }
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
                                key={task.uuid}
                                p={3}
                                borderRadius="md"
                                bg={selectedTask?.uuid === task.uuid ? selectedBgColor : 'transparent'}
                                cursor="pointer"
                                onClick={() => setSelectedTask(task)}
                                _hover={{ bg: hoverBgColor }}
                            >
                                <HStack justify="space-between">
                                    <Text fontWeight="bold">{task.title}</Text>
                                    <HStack>
                                        <Badge colorScheme={getStateColor(task.state)}>{task.state}</Badge>
                                        {(task.state === 'STARTED' || task.state === 'PENDING') && (
                                            <IconButton
                                                aria-label="Cancel task"
                                                icon={<CloseIcon />}
                                                size="xs"
                                                colorScheme="red"
                                                variant="ghost"
                                                title="Cancel task"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleCancelTask(task.uuid);
                                                }}
                                            />
                                        )}
                                    </HStack>
                                </HStack>
                                <Text fontSize="sm" color="gray.500">
                                    Started: {formatDate(task.started)}
                                </Text>
                                <HStack justify="space-between">
                                    <Text fontSize="sm">Runtime: {formatRuntime(task.runtime)}</Text>
                                    <Badge>{task.worker}</Badge>
                                </HStack>
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
                                    {selectedTask.uuid}
                                </Code>
                            </Box>
                            <Box>
                                <Text fontWeight="bold">State:</Text>
                                <HStack>
                                    <Badge colorScheme={getStateColor(selectedTask.state)}>
                                        {selectedTask.state}
                                    </Badge>
                                    {(selectedTask.state === 'STARTED' || selectedTask.state === 'PENDING') && (
                                        <IconButton
                                            aria-label="Cancel task"
                                            icon={<CloseIcon />}
                                            size="xs"
                                            colorScheme="red"
                                            variant="ghost"
                                            title="Cancel task"
                                            onClick={() => handleCancelTask(selectedTask.uuid)}
                                        />
                                    )}
                                </HStack>
                            </Box>
                            <Box>
                                <Text fontWeight="bold">Worker:</Text>
                                <Text>{selectedTask.worker}</Text>
                            </Box>
                            <Box>
                                <Text fontWeight="bold">Timing:</Text>
                                <VStack align="start" spacing={1}>
                                    <Text>Received: {formatDate(selectedTask.received)}</Text>
                                    <Text>Started: {formatDate(selectedTask.started)}</Text>
                                    <Text>Completed: {formatDate(selectedTask.succeeded)}</Text>
                                    <Text>Runtime: {formatRuntime(selectedTask.runtime)}</Text>
                                </VStack>
                            </Box>
                            {selectedTask.state === 'STARTED' && iterationStatus.length > 0 && (
                                <Box>
                                    <Text fontWeight="bold">Progress:</Text>
                                    <ProgressBars iterationStatus={iterationStatus} />
                                </Box>
                            )}
                            {selectedTask.result && (
                                <Box>
                                    <Text fontWeight="bold">Result:</Text>
                                    <Code p={2} display="block" whiteSpace="pre-wrap">
                                        {selectedTask.result}
                                    </Code>
                                </Box>
                            )}
                            {selectedTask.exception && (
                                <Box>
                                    <Text fontWeight="bold">Error:</Text>
                                    <Code p={2} display="block" whiteSpace="pre-wrap" colorScheme="red">
                                        {selectedTask.exception}
                                    </Code>
                                </Box>
                            )}
                            {selectedTask.traceback && (
                                <Box>
                                    <Text fontWeight="bold">Traceback:</Text>
                                    <Code p={2} display="block" whiteSpace="pre-wrap" colorScheme="red">
                                        {selectedTask.traceback}
                                    </Code>
                                </Box>
                            )}
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