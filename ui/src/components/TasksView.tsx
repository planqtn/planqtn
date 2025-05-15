import React, { useEffect, useState, useRef } from "react";
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
  useDisclosure,
  Flex,
} from "@chakra-ui/react";
import { CloseIcon } from "@chakra-ui/icons";
import axios from "axios";
import { Panel, PanelGroup } from "react-resizable-panels";
import { ResizeHandle } from "./ResizeHandle";
import ProgressBars from "./ProgressBars";
import { useLocation } from "react-router-dom";
import { io, Socket } from "socket.io-client";
import { supabase } from "../supabaseClient.ts";
import {
  AuthChangeEvent,
  User,
  Session as SupabaseSession,
  RealtimePostgresChangesPayload,
} from "@supabase/supabase-js";
import { UserMenu } from "./UserMenu";
import AuthDialog from "./AuthDialog";

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
  updates: {
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
}

// interface TaskUpdateMessage {
//     type: string;
//     message: {
//         updates: {
//             status: string;
//             iteration_status: Array<{
//                 desc: string;
//                 total_size: number;
//                 current_item: number;
//                 start_time: number;
//                 end_time: number | null;
//                 duration: number;
//                 avg_time_per_item: number;
//             }>;
//         };
//     };
// }

const TasksView: React.FC = () => {
  const location = useLocation();

  // Add title effect
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const title = params.get("title");
    if (title) {
      document.title = `${decodeURIComponent(title)} - tasks`;
    } else {
      document.title = "PlanqTN Task list";
    }
  }, [location]);

  const { onOpen, onClose } = useDisclosure();
  const [currentUser, setCurrentUser] = useState<User | null>(null);

  // State hooks
  const [tasks, setTasks] = useState<Task[]>([]);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [loading, setLoading] = useState(true);
  const [isConnected, setIsConnected] = useState(false);
  const [iterationStatus, setIterationStatus] = useState<
    Array<{
      desc: string;
      total_size: number;
      current_item: number;
      start_time: number;
      end_time: number | null;
      duration: number;
      avg_time_per_item: number;
    }>
  >([]);
  const [waitingForTaskUpdate, setWaitingForTaskUpdate] = useState(false);

  // Refs
  const socketAllTasksRef = useRef<Socket | null>(null);
  // const socketSingleTaskRef = useRef<Socket | null>(null);
  const selectedTaskRef = useRef<Task | null>(null);

  // Update the ref whenever selectedTask changes
  useEffect(() => {
    selectedTaskRef.current = selectedTask;
  }, [selectedTask]);

  // Theme hooks
  const bgColor = useColorModeValue("white", "gray.800");
  const hoverBgColor = useColorModeValue("gray.50", "gray.600");
  const selectedBgColor = useColorModeValue("gray.100", "gray.700");
  const borderColor = useColorModeValue("gray.200", "gray.700");

  // Update the ref whenever selectedTask changes
  useEffect(() => {
    selectedTaskRef.current = selectedTask;
  }, [selectedTask]);

  // Add authentication effect
  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      (_event: AuthChangeEvent, session: SupabaseSession | null) => {
        setCurrentUser(session?.user ?? null);
        if (!session?.user) {
          onOpen(); // Open auth modal if user is not authenticated
        }
      },
    );

    return () => subscription.unsubscribe();
  }, [onOpen]);

  // Add title effect
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const title = params.get("title");
    if (title) {
      document.title = `${decodeURIComponent(title)} - tasks`;
    } else {
      document.title = "PlanqTN Task list";
    }
  }, [location]);

  // Other hooks
  const toast = useToast();

  const processCeleryEvent = (event: CeleryEvent) => {
    setTasks((prevTasks) => {
      const taskIndex = prevTasks.findIndex((t) => t.uuid === event.uuid);
      const newTask =
        taskIndex >= 0
          ? { ...prevTasks[taskIndex] }
          : {
              uuid: event.uuid,
              name: event.name,
              title: event.uuid,
              state: "PENDING",
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
              revoked: null,
              updates: {
                iteration_status: [],
              },
            };

      switch (event.type) {
        case "task-received":
          newTask.state = "PENDING";
          newTask.received = event.timestamp;
          break;
        case "task-started":
          newTask.state = "STARTED";
          newTask.started = event.timestamp;
          newTask.args = event.args;

          break;
        case "task-succeeded":
          newTask.state = "SUCCESS";
          newTask.succeeded = event.timestamp;
          if (event.args) {
            newTask.title =
              event.uuid + " " + parseTaskTitleFromArgs(JSON.parse(event.args));
          }
          newTask.runtime = event.runtime || null;
          newTask.result = event.result || null;
          break;
        case "task-failed":
          newTask.state = "FAILURE";
          newTask.succeeded = event.timestamp;
          newTask.runtime = event.runtime || null;
          newTask.exception = event.result || null;
          break;
        case "task-revoked":
          newTask.state = "CANCELLED";
          newTask.revoked = event.timestamp;
          break;
      }

      const newTasks =
        taskIndex >= 0
          ? [
              ...prevTasks.slice(0, taskIndex),
              newTask,
              ...prevTasks.slice(taskIndex + 1),
            ]
          : [...prevTasks, newTask];

      // Sort tasks by received time in descending order
      return newTasks.sort((a, b) => (b.received || 0) - (a.received || 0));
    });
  };

  // Socket.IO connection for all tasks
  useEffect(() => {
    if (!currentUser) {
      setLoading(false);
      socketAllTasksRef.current?.disconnect();

      return;
    }
    setLoading(true);
    let mounted = true;
    // Initial fetch
    axios
      .get("/api/list_tasks", {
        params: { limit: 50, offset: 0 },
      })
      .then((response) => {
        if (mounted) {
          for (const task of response.data) {
            task.title = parseTaskTitleFromArgs(task.args);
            task.state = task.state === "REVOKED" ? "CANCELLED" : task.state;
          }
          setTasks(response.data);
          setLoading(false);
        }
      })
      .catch((error) => {
        if (mounted) {
          setLoading(false);
          toast({
            title: "Error fetching tasks error: " + error.message,
            description: "Failed to load task list",
            status: "error",
            duration: 5000,
            isClosable: true,
          });
        }
      });

    // Connect to /ws/tasks namespace
    const socket = io("/ws/tasks", { transports: ["websocket"] });
    socketAllTasksRef.current = socket;
    socket.on("connect", () => setIsConnected(true));
    socket.on("disconnect", () => setIsConnected(false));
    socket.emit("join_room", { room_id: "tasks" });
    socket.on("celery_event", (event: CeleryEvent) => {
      processCeleryEvent(event);
    });
    return () => {
      mounted = false;
      socket.disconnect();
    };
  }, [currentUser]);

  // // Socket.IO connection for selected task
  // useEffect(() => {
  //     if (!currentUser) {
  //         return;
  //     }
  //     if (!selectedTask) {
  //         setIterationStatus([]);
  //         setWaitingForTaskUpdate(false);
  //         if (socketSingleTaskRef.current) {
  //             socketSingleTaskRef.current.disconnect();
  //             socketSingleTaskRef.current = null;
  //         }
  //         return;
  //     }
  //     setWaitingForTaskUpdate(true);
  //     if (socketSingleTaskRef.current) {
  //         socketSingleTaskRef.current.disconnect();
  //     }
  //     const socket = io("/ws/task", { transports: ["websocket"] });
  //     socketSingleTaskRef.current = socket;
  //     socket.emit("join_room", { room_id: `task_${selectedTask.uuid}` });
  //     socket.on("task_updated", (data: TaskUpdateMessage) => {
  //         setWaitingForTaskUpdate(false);
  //         if (data.type === "task_updated" && data.message.updates.iteration_status) {
  //             setIterationStatus(data.message.updates.iteration_status);
  //         }
  //     });
  //     return () => {
  //         socket.disconnect();
  //     };
  // }, [selectedTask, currentUser]);

  // Supabase realtime connection for selected task
  useEffect(() => {
    if (!currentUser) {
      return;
    }
    if (!selectedTask) {
      setIterationStatus([]);
      setWaitingForTaskUpdate(false);
      return;
    }

    setWaitingForTaskUpdate(true);

    // Create a channel for task updates
    const channel = supabase
      .channel(`task_${selectedTask.uuid}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "tasks",
          filter: `uuid=eq.${selectedTask.uuid}`,
        },
        (payload: RealtimePostgresChangesPayload<Task>) => {
          console.log("Task updated", payload);
          if (payload.new) {
            const updates = (payload.new as Task).updates;
            if (updates?.iteration_status) {
              setIterationStatus(updates.iteration_status);
              setWaitingForTaskUpdate(false);
            }
          }
        },
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [selectedTask, currentUser]);

  // Helper functions
  const getStateColor = (state: string) => {
    switch (state) {
      case "SUCCESS":
        return "green";
      case "FAILURE":
        return "red";
      case "PENDING":
        return "yellow";
      case "STARTED":
        return "blue";
      case "CANCELLED":
        return "orange";
      default:
        return "gray";
    }
  };

  const formatDate = (timestamp: number | null) => {
    if (!timestamp) return "Not started";
    const date = new Date(timestamp * 1000); // Convert from seconds to milliseconds
    return date.toLocaleString();
  };

  const formatRuntime = (runtime: number | null) => {
    if (!runtime) return "N/A";
    return `${runtime.toFixed(2)}s`;
  };

  const parseTaskTitleFromArgs = (
    args: Array<{ legos: Record<string, unknown> }>,
  ) => {
    try {
      if (args.length > 0) {
        const firstArg = args[0];
        if (firstArg.legos) {
          return `${Object.keys(firstArg.legos).length} legos`;
        }
      }
      return "Unknown task";
    } catch (e) {
      console.error("Error parsing task args:", e);
      return "Invalid task data:" + e;
    }
  };

  const handleCancelTask = async (taskId: string) => {
    try {
      await axios.post("/api/cancel_task", { task_id: taskId });
      toast({
        title: "Task cancelled",
        description: `Task ${taskId} has been cancelled`,
        status: "success",
        duration: 3000,
        isClosable: true,
      });
    } catch (error) {
      console.error("Error cancelling task:", error);
      toast({
        title: "Error cancelling task",
        description: "Failed to cancel the task",
        status: "error",
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

  if (!currentUser) {
    return <AuthDialog isOpen={true} onClose={onClose} />;
  }

  // Header height
  const HEADER_HEIGHT = 56;

  return (
    <>
      {/* Header Bar */}
      <Box
        as="header"
        w="100%"
        h={`${HEADER_HEIGHT}px`}
        px={6}
        py={2}
        bg={bgColor}
        borderBottom="1px"
        borderColor={borderColor}
        position="relative"
        zIndex={2}
      >
        <Flex align="center" justify="flex-end" h="100%">
          <UserMenu user={currentUser} />
        </Flex>
      </Box>
      {/* Main Content */}
      <Box pt={`${HEADER_HEIGHT}px`}>
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
                <HStack spacing={4}>
                  <Badge colorScheme={isConnected ? "green" : "red"}>
                    {isConnected ? "Connected" : "Disconnected"}
                  </Badge>
                </HStack>
              </HStack>
              <VStack align="stretch" spacing={2}>
                {tasks.map((task) => (
                  <Box
                    key={task.uuid}
                    p={3}
                    borderRadius="md"
                    bg={
                      selectedTask?.uuid === task.uuid
                        ? selectedBgColor
                        : "transparent"
                    }
                    cursor="pointer"
                    onClick={() => setSelectedTask(task)}
                    _hover={{ bg: hoverBgColor }}
                  >
                    <HStack justify="space-between">
                      <Text fontWeight="bold">{task.title}</Text>
                      <HStack>
                        <Badge colorScheme={getStateColor(task.state)}>
                          {task.state}
                        </Badge>
                        {(task.state === "STARTED" ||
                          task.state === "PENDING") && (
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
                      <Text fontSize="sm">
                        Runtime: {formatRuntime(task.runtime)}
                      </Text>
                      <Badge>{task.worker}</Badge>
                    </HStack>
                  </Box>
                ))}
              </VStack>
            </Box>
          </Panel>

          <ResizeHandle id="task-details-resize-handle" />

          {/* Task Details Panel */}
          <Panel
            id="task-details-panel"
            defaultSize={60}
            minSize={30}
            order={2}
          >
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
                      {(selectedTask.state === "STARTED" ||
                        selectedTask.state === "PENDING") && (
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
                      <Text>
                        Completed: {formatDate(selectedTask.succeeded)}
                      </Text>
                      <Text>
                        Runtime: {formatRuntime(selectedTask.runtime)}
                      </Text>
                    </VStack>
                  </Box>
                  {(selectedTask.state === "STARTED" ||
                    selectedTask.state === "PENDING") && (
                    <Box>
                      <Text fontWeight="bold">Progress:</Text>
                      <ProgressBars
                        iterationStatus={iterationStatus}
                        waiting={waitingForTaskUpdate}
                      />
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
                      <Code
                        p={2}
                        display="block"
                        whiteSpace="pre-wrap"
                        colorScheme="red"
                      >
                        {selectedTask.exception}
                      </Code>
                    </Box>
                  )}
                  {selectedTask.traceback && (
                    <Box>
                      <Text fontWeight="bold">Traceback:</Text>
                      <Code
                        p={2}
                        display="block"
                        whiteSpace="pre-wrap"
                        colorScheme="red"
                      >
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
      </Box>
    </>
  );
};

export default TasksView;
