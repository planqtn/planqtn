import {
  Box,
  useColorModeValue,
  VStack,
  Text,
  Badge,
  HStack
} from "@chakra-ui/react";
import { WeightEnumerator } from "../../stores/tensorNetworkStore";
import { TensorNetworkLeg } from "@/lib/TensorNetwork";
import { useCanvasStore } from "../../stores/canvasStateStore.ts";
import { useUserStore } from "@/stores/userStore.ts";
import TaskDetailsDisplay from "../tasks/TaskDetailsDisplay";
import TaskStateLabel from "../tasks/TaskStateLabel";
import { useState, useEffect } from "react";
import { Task } from "../../lib/types.ts";
import { RealtimeChannel } from "@supabase/supabase-js";
import {
  runtimeStoreSupabase,
  userContextSupabase
} from "../../config/supabaseClient.ts";
import { TaskUpdate, TaskUpdateIterationStatus } from "../../lib/types.ts";
import { RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import { config, getApiUrl } from "../../config/config.ts";
import { getAccessToken } from "../auth/auth.ts";
import axios, { AxiosError } from "axios";
import { getAxiosErrorMessage } from "../../lib/errors.ts";
import { useDisclosure } from "@chakra-ui/react";
import TaskLogsModal from "../tasks/TaskLogsModal.tsx";

interface SingleWeightEnumDetailsPanelProps {
  taskId: string;
  weightEnumerator: WeightEnumerator;
  tensorNetworkSignature: string;
}

const SingleWeightEnumDetailsPanel: React.FC<
  SingleWeightEnumDetailsPanelProps
> = ({ taskId, weightEnumerator, tensorNetworkSignature }) => {
  const { currentUser: user } = useUserStore();
  const setError = useCanvasStore((state) => state.setError);
  const updateWeightEnumeratorStatus = useCanvasStore(
    (state) => state.updateWeightEnumeratorStatus
  );
  const setWeightEnumerator = useCanvasStore(
    (state) => state.setWeightEnumerator
  );
  const cachedTensorNetworks = useCanvasStore(
    (state) => state.cachedTensorNetworks
  );
  const refreshAndSetCachedTensorNetworkFromCanvas = useCanvasStore(
    (state) => state.refreshAndSetCachedTensorNetworkFromCanvas
  );
  const focusOnTensorNetwork = useCanvasStore(
    (state) => state.focusOnTensorNetwork
  );

  const bgColor = useColorModeValue("white", "gray.800");
  const borderColor = useColorModeValue("gray.200", "gray.600");

  // State for tracking the task
  const [task, setTask] = useState<Task | null>(null);
  const [taskUpdatesChannel, setTaskUpdatesChannel] =
    useState<RealtimeChannel | null>(null);
  const [waitingForTaskUpdates, setWaitingForTaskUpdates] =
    useState<boolean>(false);
  const [iterationStatuses, setIterationStatuses] = useState<
    Array<TaskUpdateIterationStatus>
  >([]);

  // State for task logs
  const [taskLogs, setTaskLogs] = useState<string>("");
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);
  const {
    isOpen: isLogsModalOpen,
    onOpen: onLogsModalOpen,
    onClose: onLogsModalClose
  } = useDisclosure();

  const subscribeToTaskUpdates = (taskId: string) => {
    setIterationStatuses([]);
    setWaitingForTaskUpdates(false);

    console.log("Subscribing to task updates", taskId, "and user", user?.id);
    if (!user) {
      console.error("No user found, so not setting task updates");
      return;
    }

    // Create a channel for task updates
    const channel = runtimeStoreSupabase!
      .channel(`task_${taskId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "task_updates",
          filter: `uuid=eq.${taskId}`
        },
        async (payload: RealtimePostgresChangesPayload<TaskUpdate>) => {
          if (payload.new) {
            const updates = (payload.new as TaskUpdate).updates;
            console.log("Processing updates:", updates);

            // If we get state 4 (CANCELLED), unsubscribe and ignore all further updates
            if (updates?.state === 4) {
              console.log("Task cancelled, unsubscribing from updates");
              try {
                await channel.unsubscribe();
                setTask((prev) => (prev ? { ...prev, state: 4 } : null));
                setTaskUpdatesChannel(null);
                setIterationStatuses([]);
                setWaitingForTaskUpdates(false);
              } catch (error) {
                console.error("Error unsubscribing from channel:", error);
              }
              return;
            }

            // Only process other updates if we haven't received state 4 yet
            if (updates?.iteration_status) {
              console.log(
                "Setting iteration status:",
                updates.iteration_status
              );
              setIterationStatuses(updates.iteration_status);
              setWaitingForTaskUpdates(false);
            }
            if (updates?.state !== undefined) {
              console.log("Setting task state:", updates.state);
              setTask((prev) =>
                prev ? { ...prev, state: updates.state } : null
              );

              if (updates.state !== 0 && updates.state !== 1) {
                readAndUpdateTask(taskId);
              }
            }
          }
        }
      )
      .subscribe((status) => {
        console.log("Subscription status:", status);
        if (status === "SUBSCRIBED") {
          console.log("Task updates subscribed");
          setTaskUpdatesChannel(channel);
        }
      });
  };

  const readAndUpdateTask = async (taskId: string) => {
    if (!userContextSupabase) {
      return;
    }

    userContextSupabase
      .from("tasks")
      .select("*")
      .eq("uuid", taskId)
      .then(async ({ data, error }) => {
        if (error) {
          console.error("Error fetching task:", error);
          setError("Error fetching task: " + error.message);
        } else {
          console.log("Task:", data);
          if (data.length > 0) {
            const taskData = data[0] as Task;
            setTask(taskData);

            if (taskData.state === 0 || taskData.state === 1) {
              console.log("Setting up subscription for task:", taskId);
              subscribeToTaskUpdates(taskId);

              // Update weight enumerator status to running if task is running
              if (
                taskData.state === 1 &&
                taskData.job_type === "weightenumerator"
              ) {
                updateWeightEnumeratorStatus(
                  tensorNetworkSignature,
                  taskId,
                  "running"
                );
              }
            } else {
              const existingChannel = taskUpdatesChannel;
              if (existingChannel) {
                console.log(
                  "Unsubscribing from task updates for task:",
                  taskId
                );
                await existingChannel.unsubscribe();
                setTaskUpdatesChannel(null);
                setIterationStatuses([]);
                setWaitingForTaskUpdates(false);
              }

              // If task succeeded and has a result, cache it in the weight enumerator
              if (
                taskData.state === 2 &&
                taskData.result &&
                taskData.job_type === "weightenumerator"
              ) {
                try {
                  const result = JSON.parse(taskData.result);

                  if (
                    !weightEnumerator.polynomial &&
                    result.stabilizer_polynomial
                  ) {
                    // Update the weight enumerator with the result using the store method
                    setWeightEnumerator(
                      tensorNetworkSignature,
                      taskId,
                      weightEnumerator.with({
                        polynomial: result.stabilizer_polynomial,
                        normalizerPolynomial: result.normalizer_polynomial,
                        status: "completed"
                      })
                    );

                    console.log(
                      "Cached weight enumerator result for task:",
                      taskId
                    );
                  }
                } catch (parseError) {
                  console.error("Error parsing task result:", parseError);
                }
              }

              // If task failed, update the weight enumerator status
              if (
                taskData.state === 3 &&
                taskData.job_type === "weightenumerator"
              ) {
                updateWeightEnumeratorStatus(
                  tensorNetworkSignature,
                  taskId,
                  "failed",
                  "Task failed"
                );
              }
            }
          }
        }
      });
  };

  // Initialize task data when component mounts
  useEffect(() => {
    if (taskId) {
      readAndUpdateTask(taskId);
    }
  }, [taskId]);

  const handleCancelTask = async (taskId: string) => {
    try {
      const accessToken = await getAccessToken();

      await axios.post(
        getApiUrl("cancelJob"),
        {
          task_uuid: taskId,
          task_store_url: config.userContextURL,
          task_store_anon_key: config.userContextAnonKey
        },
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${accessToken}`
          }
        }
      );
      console.log("Task cancellation requested:", taskId);

      if (taskUpdatesChannel) {
        console.log("Unsubscribing from task updates");
        await taskUpdatesChannel.unsubscribe();
        console.log("Task updates unsubscribed");
      }
      setTaskUpdatesChannel(null);
      setIterationStatuses([]);
      setWaitingForTaskUpdates(false);
      setTask((prev) => (prev ? { ...prev, state: 4 } : null));
    } catch (err) {
      const error = err as AxiosError<{
        message: string;
        error: string;
        status: number;
      }>;
      console.error("Error cancelling task:", error);
      setError(
        `Failed to cancel task: Status: ${error.response?.status} ${typeof error.response?.data.error === "string" ? error.response?.data.error : JSON.stringify(error.response?.data.error)} `
      );
    }
  };

  const handleSubnetClick = () => {
    refreshAndSetCachedTensorNetworkFromCanvas(tensorNetworkSignature);
    focusOnTensorNetwork();
  };

  const fetchTaskLogs = async (taskId: string) => {
    try {
      setIsLoadingLogs(true);
      onLogsModalOpen();

      const accessToken = await getAccessToken();
      const key = !accessToken ? config.runtimeStoreAnonKey : accessToken;
      const { data: taskData, error: taskError } = await userContextSupabase!
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
          execution_id: taskData.execution_id
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

      setTaskLogs(response.data.logs || "No logs available");
    } catch (err) {
      const error = err as AxiosError<{
        message: string;
        error: string;
        status: number;
      }>;
      console.error("Error fetching task logs:", error);
      setError(`Failed to fetch task logs: ${getAxiosErrorMessage(error)}`);
      setTaskLogs(
        "Error fetching logs. Please try again.\nError details: " +
          getAxiosErrorMessage(error)
      );
    } finally {
      setIsLoadingLogs(false);
    }
  };

  return (
    <Box h="100%" bg={bgColor} overflowY="auto" p={4}>
      <VStack align="stretch" spacing={4}>
        {/* Header */}
        <Box>
          <Text fontSize="lg" fontWeight="bold" mb={2}>
            Weight Enumerator Task
          </Text>
          <Text fontSize="sm" color="gray.500" fontFamily="mono" mb={2}>
            ID: {taskId}
          </Text>
          <Text fontSize="sm" color="gray.600">
            Subnet:{" "}
            <Text
              as="span"
              color="blue.500"
              cursor="pointer"
              _hover={{ textDecoration: "underline" }}
              onClick={handleSubnetClick}
            >
              {cachedTensorNetworks[tensorNetworkSignature]?.name ||
                "Unknown Network"}
            </Text>
          </Text>
        </Box>

        {/* Status and badges */}
        <HStack spacing={2} wrap="wrap">
          {task && <TaskStateLabel state={task.state} />}
          {weightEnumerator.status === "failed" && (
            <Badge size="sm" colorScheme="red">
              Failed
            </Badge>
          )}
          {weightEnumerator.truncateLength && (
            <Badge size="sm" colorScheme="purple">
              T{weightEnumerator.truncateLength}
            </Badge>
          )}
          {weightEnumerator.openLegs.length > 0 ? (
            <Badge size="sm" colorScheme="orange">
              {weightEnumerator.openLegs.length} open legs
            </Badge>
          ) : (
            <Badge size="sm" colorScheme="gray">
              SCALAR
            </Badge>
          )}
        </HStack>

        {/* Task details */}
        {task && (task.state === 0 || task.state === 1) && (
          <TaskDetailsDisplay
            task={task}
            taskId={taskId}
            iterationStatus={iterationStatuses}
            waitingForTaskUpdate={waitingForTaskUpdates}
            taskUpdatesChannel={taskUpdatesChannel}
            onCancelTask={handleCancelTask}
            onViewLogs={fetchTaskLogs}
          />
        )}

        {/* Polynomial results */}
        {weightEnumerator.polynomial && (
          <VStack align="stretch" spacing={2}>
            <Text fontSize="sm" fontWeight="medium">
              Stabilizer Weight Enumerator Polynomial
              {weightEnumerator.polynomial.includes("\n") && (
                <Text as="span" color="gray.500" fontWeight="normal">
                  {" "}
                  ({weightEnumerator.polynomial.split("\n").length} elements)
                </Text>
              )}
            </Text>
            <Box
              p={2}
              borderWidth={1}
              borderColor={borderColor}
              borderRadius="md"
              bg="gray.50"
              maxH="200px"
              overflowY="auto"
            >
              {weightEnumerator.polynomial.includes("\n") ? (
                <VStack align="stretch" spacing={0}>
                  {weightEnumerator.polynomial
                    .split("\n")
                    .map((line: string, lineIndex: number) => (
                      <Text key={lineIndex} fontFamily="mono" fontSize="xs">
                        {line}
                      </Text>
                    ))}
                </VStack>
              ) : (
                <Text fontFamily="mono" fontSize="xs">
                  {weightEnumerator.polynomial}
                </Text>
              )}
            </Box>

            {weightEnumerator.normalizerPolynomial && (
              <>
                <Text fontSize="sm" fontWeight="medium">
                  Normalizer Weight Enumerator Polynomial
                  {weightEnumerator.normalizerPolynomial.includes("\n") && (
                    <Text as="span" color="gray.500" fontWeight="normal">
                      {" "}
                      (
                      {
                        weightEnumerator.normalizerPolynomial.split("\n").length
                      }{" "}
                      elements)
                    </Text>
                  )}
                </Text>
                <Box
                  p={2}
                  borderWidth={1}
                  borderColor={borderColor}
                  borderRadius="md"
                  bg="gray.50"
                  maxH="200px"
                  overflowY="auto"
                >
                  <Text fontFamily="mono" fontSize="xs">
                    {weightEnumerator.normalizerPolynomial}
                  </Text>
                </Box>
              </>
            )}
          </VStack>
        )}

        {/* Open legs display */}
        {weightEnumerator.openLegs.length > 0 && (
          <VStack align="stretch" spacing={2}>
            <Text fontSize="sm" fontWeight="medium">
              Open Legs:
            </Text>
            <Box
              p={2}
              borderWidth={1}
              borderColor={borderColor}
              borderRadius="md"
              bg="gray.50"
              maxH="100px"
              overflowY="auto"
            >
              <VStack align="stretch" spacing={1}>
                {weightEnumerator.openLegs.map(
                  (leg: TensorNetworkLeg, legIndex: number) => (
                    <Text key={legIndex} fontSize="xs" fontFamily="mono">
                      {leg.instance_id}:{leg.leg_index}
                    </Text>
                  )
                )}
              </VStack>
            </Box>
          </VStack>
        )}
      </VStack>

      {isLogsModalOpen && (
        <TaskLogsModal
          isOpen={isLogsModalOpen}
          onClose={onLogsModalClose}
          isLoading={isLoadingLogs}
          logs={taskLogs}
        />
      )}
    </Box>
  );
};

export default SingleWeightEnumDetailsPanel;
