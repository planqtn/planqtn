import React, { useState, useEffect } from "react";
import {
  Box,
  VStack,
  Heading,
  Text,
  HStack,
  IconButton,
  Spinner,
  Icon,
  Button,
  useColorModeValue,
  Accordion,
  AccordionItem,
  AccordionButton,
  AccordionPanel,
  AccordionIcon
} from "@chakra-ui/react";
import { CloseIcon } from "@chakra-ui/icons";
import { Task, TaskUpdateIterationStatus } from "../../lib/types.ts";
import TaskStateLabel from "./TaskStateLabel.tsx";
import ProgressBars from "./ProgressBars.tsx";
import { formatDuration, intervalToDuration } from "date-fns";
import {
  RealtimeChannel,
  RealtimePostgresChangesPayload
} from "@supabase/supabase-js";
import { FaFileAlt, FaTrash } from "react-icons/fa";
import { userContextSupabase } from "../../config/supabaseClient.ts";
import { getAccessToken } from "../../lib/auth.ts";
import { getApiUrl } from "../../config/config.ts";
import { getAxiosErrorMessage } from "../../lib/errors.ts";
import axios, { AxiosError } from "axios";

interface TaskPanelProps {
  user?: { id: string } | null;
  onError: (error: string) => void;
  floatingMode?: boolean;
}

// Helper to format seconds using date-fns
function formatSecondsToDuration(seconds: number) {
  const duration = intervalToDuration({
    start: 0,
    end: Math.round(seconds * 1000)
  });

  return (
    formatDuration(duration, {
      format: ["hours", "minutes", "seconds"],
      zero: true,
      delimiter: " "
    }) || `${seconds.toFixed(2)}s`
  );
}

const TaskPanel: React.FC<TaskPanelProps> = ({
  user,
  onError,
  floatingMode = false
}) => {
  const bgColor = useColorModeValue("white", "gray.800");
  const borderColor = useColorModeValue("gray.200", "gray.600");

  const [tasks, setTasks] = useState<Task[]>([]);
  const [taskUpdatesChannels, setTaskUpdatesChannels] = useState<
    Map<string, RealtimeChannel>
  >(new Map());
  const [iterationStatuses, setIterationStatuses] = useState<
    Map<string, TaskUpdateIterationStatus[]>
  >(new Map());
  const [waitingForTaskUpdates, setWaitingForTaskUpdates] = useState<
    Map<string, boolean>
  >(new Map());
  const [taskLogs, setTaskLogs] = useState<Map<string, string>>(new Map());
  const [isLoadingLogs, setIsLoadingLogs] = useState<Map<string, boolean>>(
    new Map()
  );

  // Fetch all tasks for the user
  const fetchTasks = async () => {
    if (!userContextSupabase || !user) return;

    try {
      const { data, error } = await userContextSupabase
        .from("tasks")
        .select("*")
        .eq("user_id", user.id)
        .order("sent_at", { ascending: false });

      if (error) {
        console.error("Error fetching tasks:", error);
        onError("Error fetching tasks: " + error.message);
        return;
      }

      setTasks(data || []);

      // Set up subscriptions for running tasks
      data?.forEach((task) => {
        if (task.state === 0 || task.state === 1) {
          subscribeToTaskUpdates(task.uuid);
        }
      });
    } catch (error) {
      console.error("Error fetching tasks:", error);
      onError("Error fetching tasks");
    }
  };

  // Subscribe to task updates
  const subscribeToTaskUpdates = (taskId: string) => {
    if (!userContextSupabase || !user) return;

    // Unsubscribe from existing channel if it exists
    const existingChannel = taskUpdatesChannels.get(taskId);
    if (existingChannel) {
      existingChannel.unsubscribe();
    }

    const channel = userContextSupabase
      .channel(`task_${taskId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "task_updates",
          filter: `uuid=eq.${taskId}`
        },
        async (
          payload: RealtimePostgresChangesPayload<{
            updates: {
              state?: number;
              iteration_status?: TaskUpdateIterationStatus[];
            };
          }>
        ) => {
          if (payload.new && "updates" in payload.new) {
            const updates = payload.new.updates;

            // Handle cancelled state
            if (updates?.state === 4) {
              const channel = taskUpdatesChannels.get(taskId);
              if (channel) {
                await channel.unsubscribe();
                taskUpdatesChannels.delete(taskId);
                setTaskUpdatesChannels(new Map(taskUpdatesChannels));
              }
              setTasks((prev) =>
                prev.map((task) =>
                  task.uuid === taskId ? { ...task, state: 4 } : task
                )
              );
              return;
            }

            // Update iteration status
            if (updates?.iteration_status) {
              setIterationStatuses(
                (prev) => new Map(prev.set(taskId, updates.iteration_status!))
              );
              setWaitingForTaskUpdates(
                (prev) => new Map(prev.set(taskId, false))
              );
            }

            // Update task state
            if (updates?.state !== undefined) {
              setTasks((prev) =>
                prev.map((task) =>
                  task.uuid === taskId
                    ? { ...task, state: updates.state! }
                    : task
                )
              );

              // If task is finished, unsubscribe and fetch final result
              if (updates.state !== 0 && updates.state !== 1) {
                const channel = taskUpdatesChannels.get(taskId);
                if (channel) {
                  await channel.unsubscribe();
                  taskUpdatesChannels.delete(taskId);
                  setTaskUpdatesChannels(new Map(taskUpdatesChannels));
                }
                fetchTasks(); // Refresh to get final result
              }
            }
          }
        }
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          setTaskUpdatesChannels((prev) => new Map(prev.set(taskId, channel)));
        }
      });
  };

  // Cancel a task
  const handleCancelTask = async (taskId: string) => {
    try {
      const accessToken = await getAccessToken();

      await axios.post(
        getApiUrl("cancelJob"),
        {
          task_uuid: taskId,
          task_store_url: process.env.REACT_APP_USER_CONTEXT_URL,
          task_store_anon_key: process.env.REACT_APP_USER_CONTEXT_ANON_KEY
        },
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`
          }
        }
      );

      console.log("Task cancellation requested:", taskId);
    } catch (err) {
      const error = err as AxiosError<{
        message: string;
        error: string;
        status: number;
      }>;
      console.error("Error cancelling task:", error);
      onError(`Failed to cancel task: ${getAxiosErrorMessage(error)}`);
    }
  };

  // Fetch task logs
  const fetchTaskLogs = async (taskId: string) => {
    try {
      setIsLoadingLogs((prev) => new Map(prev.set(taskId, true)));

      const accessToken = await getAccessToken();
      const key = !accessToken
        ? process.env.REACT_APP_RUNTIME_STORE_ANON_KEY
        : accessToken;

      const { data: task, error: taskError } = await userContextSupabase!
        .from("tasks")
        .select("*")
        .eq("uuid", taskId)
        .single();

      if (taskError) {
        throw new Error(taskError.message);
      }

      const response = await axios.post(
        getApiUrl("planqtnJobLogs"),
        {
          execution_id: task.execution_id
        },
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${key}`
          }
        }
      );

      if (response.data.status === "error") {
        throw new Error(response.data.message);
      }

      setTaskLogs(
        (prev) =>
          new Map(prev.set(taskId, response.data.logs || "No logs available"))
      );
    } catch (err) {
      const error = err as AxiosError<{
        message: string;
        error: string;
        status: number;
      }>;
      console.error("Error fetching task logs:", error);
      onError(`Failed to fetch task logs: ${getAxiosErrorMessage(error)}`);
      setTaskLogs(
        (prev) =>
          new Map(
            prev.set(
              taskId,
              "Error fetching logs. Please try again.\nError details: " +
                getAxiosErrorMessage(error)
            )
          )
      );
    } finally {
      setIsLoadingLogs((prev) => new Map(prev.set(taskId, false)));
    }
  };

  // Delete a task
  const handleDeleteTask = async (taskId: string) => {
    if (!userContextSupabase) return;

    try {
      const { error } = await userContextSupabase
        .from("tasks")
        .delete()
        .eq("uuid", taskId);

      if (error) {
        throw error;
      }

      // Remove from local state
      setTasks((prev) => prev.filter((task) => task.uuid !== taskId));

      // Unsubscribe from updates if needed
      const channel = taskUpdatesChannels.get(taskId);
      if (channel) {
        await channel.unsubscribe();
        taskUpdatesChannels.delete(taskId);
        setTaskUpdatesChannels(new Map(taskUpdatesChannels));
      }
    } catch (error) {
      console.error("Error deleting task:", error);
      onError("Error deleting task");
    }
  };

  // Fetch tasks on mount and when user changes
  useEffect(() => {
    fetchTasks();
  }, [user]);

  // Cleanup subscriptions on unmount
  useEffect(() => {
    return () => {
      taskUpdatesChannels.forEach((channel) => {
        channel.unsubscribe();
      });
    };
  }, []);

  if (!user) {
    return (
      <Box
        p={4}
        borderWidth={1}
        borderRadius="lg"
        bg={bgColor}
        borderColor={borderColor}
      >
        <Text>Please log in to view tasks</Text>
      </Box>
    );
  }

  return (
    <Box
      p={4}
      borderWidth={floatingMode ? 0 : 1}
      borderRadius={floatingMode ? 0 : "lg"}
      bg={floatingMode ? "transparent" : bgColor}
      borderColor={borderColor}
      maxH={floatingMode ? "none" : "400px"}
      overflowY={floatingMode ? "visible" : "auto"}
      h={floatingMode ? "100%" : "auto"}
    >
      <VStack spacing={4} align="stretch">
        <HStack justify="space-between">
          <Heading size="md">Calculations</Heading>
          <Button size="sm" onClick={fetchTasks}>
            Refresh
          </Button>
        </HStack>

        {tasks.length === 0 ? (
          <Text color="gray.500">No tasks found</Text>
        ) : (
          <Accordion allowMultiple>
            {tasks.map((task) => (
              <AccordionItem key={task.uuid}>
                <AccordionButton>
                  <Box flex="1" textAlign="left">
                    <HStack justify="space-between" w="full">
                      <VStack align="start" spacing={1}>
                        <Text fontWeight="bold">
                          {task.job_type === "weightenumerator"
                            ? "Weight Enumerator"
                            : task.job_type}
                        </Text>
                        <Text fontSize="sm" color="gray.500">
                          {new Date(task.sent_at).toLocaleString()}
                        </Text>
                      </VStack>
                      <HStack spacing={2}>
                        <TaskStateLabel state={task.state} />
                        {task.state === 0 || task.state === 1 ? (
                          <Spinner size="sm" color="blue.500" />
                        ) : null}
                      </HStack>
                    </HStack>
                  </Box>
                  <AccordionIcon />
                </AccordionButton>

                <AccordionPanel>
                  <VStack spacing={3} align="stretch">
                    <HStack justify="space-between">
                      <Text fontSize="sm">Task ID: {task.uuid}</Text>
                      <HStack spacing={2}>
                        {(task.state === 0 || task.state === 1) && (
                          <IconButton
                            aria-label="Cancel task"
                            icon={<CloseIcon />}
                            size="xs"
                            colorScheme="red"
                            onClick={() => handleCancelTask(task.uuid)}
                          />
                        )}
                        <IconButton
                          aria-label="Delete task"
                          icon={<Icon as={FaTrash} />}
                          size="xs"
                          colorScheme="gray"
                          onClick={() => handleDeleteTask(task.uuid)}
                        />
                      </HStack>
                    </HStack>

                    {task.state === 2 && task.result && (
                      <VStack align="stretch" spacing={2}>
                        <Text fontSize="sm">
                          Execution time:{" "}
                          {(() => {
                            const time = JSON.parse(task.result!).time;
                            return formatSecondsToDuration(time);
                          })()}
                        </Text>

                        {task.job_type === "weightenumerator" && (
                          <VStack align="stretch" spacing={2}>
                            <Heading size="sm">
                              Stabilizer Weight Enumerator Polynomial
                            </Heading>
                            <Box
                              p={3}
                              borderWidth={1}
                              borderRadius="md"
                              bg="gray.50"
                            >
                              <Text fontFamily="mono" fontSize="sm">
                                {(() => {
                                  const parsedResult = JSON.parse(task.result!);
                                  return (
                                    parsedResult.stabilizer_polynomial ||
                                    "No polynomial available"
                                  );
                                })()}
                              </Text>
                            </Box>
                            <Heading size="sm">
                              Normalizer Weight Enumerator Polynomial
                            </Heading>
                            <Box
                              p={3}
                              borderWidth={1}
                              borderRadius="md"
                              bg="gray.50"
                            >
                              <Text fontFamily="mono" fontSize="sm">
                                {JSON.parse(task.result!)
                                  .normalizer_polynomial ||
                                  "No polynomial available"}
                              </Text>
                            </Box>
                          </VStack>
                        )}
                      </VStack>
                    )}

                    {task.state === 3 && (
                      <VStack align="stretch" spacing={3}>
                        <Text color="red.500">Task failed: {task.result}</Text>
                        <Button
                          leftIcon={<Icon as={FaFileAlt} />}
                          size="sm"
                          colorScheme="blue"
                          onClick={() => fetchTaskLogs(task.uuid)}
                          isLoading={isLoadingLogs.get(task.uuid)}
                        >
                          View Logs
                        </Button>
                        {taskLogs.get(task.uuid) && (
                          <Box
                            p={3}
                            borderWidth={1}
                            borderRadius="md"
                            bg="gray.50"
                            maxH="200px"
                            overflowY="auto"
                          >
                            <Text
                              fontFamily="mono"
                              fontSize="xs"
                              whiteSpace="pre-wrap"
                            >
                              {taskLogs.get(task.uuid)}
                            </Text>
                          </Box>
                        )}
                      </VStack>
                    )}

                    {(task.state === 0 || task.state === 1) && (
                      <ProgressBars
                        iterationStatus={iterationStatuses.get(task.uuid) || []}
                        waiting={waitingForTaskUpdates.get(task.uuid) || false}
                      />
                    )}
                  </VStack>
                </AccordionPanel>
              </AccordionItem>
            ))}
          </Accordion>
        )}
      </VStack>
    </Box>
  );
};

export default TaskPanel;
