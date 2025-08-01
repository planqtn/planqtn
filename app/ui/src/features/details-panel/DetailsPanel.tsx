import {
  Box,
  VStack,
  useColorModeValue,
  useDisclosure
} from "@chakra-ui/react";
import {
  TaskUpdate,
  TaskUpdateIterationStatus,
  Task
} from "../../lib/types.ts";

import axios, { AxiosError } from "axios";
import { useState, useCallback, useMemo } from "react";

import {
  RealtimePostgresChangesPayload,
  RealtimeChannel
} from "@supabase/supabase-js";
import {
  runtimeStoreSupabase,
  userContextSupabase
} from "../../config/supabaseClient.ts";
import { config, getApiUrl } from "../../config/config.ts";
import { getAccessToken } from "../auth/auth.ts";
import { useEffect } from "react";
import TaskLogsModal from "../tasks/TaskLogsModal.tsx";
import { getAxiosErrorMessage } from "../../lib/errors.ts";
import { useCanvasStore } from "../../stores/canvasStateStore.ts";
import { usePanelConfigStore } from "../../stores/panelConfigStore";
import { useUserStore } from "@/stores/userStore.ts";
import { SubnetToolbar } from "../lego/SubnetToolbar";
import DetailsHeader from "./DetailsHeader";
import Calculations from "./Calculations";

const DetailsPanel: React.FC = () => {
  const { currentUser: user, isUserLoggedIn } = useUserStore();

  const connections = useCanvasStore((state) => state.connections);
  const droppedLegos = useCanvasStore((state) => state.droppedLegos);

  const updateDroppedLego = useCanvasStore((state) => state.updateDroppedLego);
  const tensorNetwork = useCanvasStore((state) => state.tensorNetwork);
  const selectedTensorNetworkParityCheckMatrixRows = useCanvasStore(
    (state) => state.selectedTensorNetworkParityCheckMatrixRows
  );

  const listWeightEnumerators = useCanvasStore(
    (state) => state.listWeightEnumerators
  );

  const parityCheckMatrix = useCanvasStore((state) => {
    if (!state.tensorNetwork) return null;
    return state.parityCheckMatrices[state.tensorNetwork.signature] || null;
  });

  const parityCheckMatrices = useCanvasStore(
    (state) => state.parityCheckMatrices
  );
  const handleSingleLegoMatrixRowSelection = useCanvasStore(
    (state) => state.handleSingleLegoMatrixRowSelection
  );

  const isSingleLego = tensorNetwork && tensorNetwork.legos.length == 1;
  const lego = isSingleLego ? tensorNetwork?.legos[0] : null;
  const setError = useCanvasStore((state) => state.setError);
  const handleMatrixRowSelectionForSelectedTensorNetwork = useCanvasStore(
    (state) => state.handleMatrixRowSelectionForSelectedTensorNetwork
  );

  const weightEnumerators = useCanvasStore((state) => state.weightEnumerators);
  const setWeightEnumerator = useCanvasStore(
    (state) => state.setWeightEnumerator
  );
  const calculateParityCheckMatrix = useCanvasStore(
    (state) => state.calculateParityCheckMatrix
  );
  const openPCMPanel = usePanelConfigStore((state) => state.openPCMPanel);
  const openSingleLegoPCMPanel = usePanelConfigStore(
    (state) => state.openSingleLegoPCMPanel
  );
  const bgColor = useColorModeValue("white", "gray.800");
  const borderColor = useColorModeValue("gray.200", "gray.600");
  const cachedTensorNetworks = useCanvasStore(
    (state) => state.cachedTensorNetworks
  );
  const cachedTensorNetwork = tensorNetwork?.signature
    ? cachedTensorNetworks[tensorNetwork.signature]
    : null;

  const [taskLogs, setTaskLogs] = useState<string>("");
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);
  const {
    isOpen: isLogsModalOpen,
    onOpen: onLogsModalOpen,
    onClose: onLogsModalClose
  } = useDisclosure();

  // State for tracking multiple tasks
  const [tasks, setTasks] = useState<Map<string, Task>>(new Map());
  const [taskUpdatesChannels, setTaskUpdatesChannels] = useState<
    Map<string, RealtimeChannel>
  >(new Map());
  const [waitingForTaskUpdates, setWaitingForTaskUpdates] = useState<
    Map<string, boolean>
  >(new Map());
  const [iterationStatuses, setIterationStatuses] = useState<
    Map<string, Array<TaskUpdateIterationStatus>>
  >(new Map());

  const legoSelectedRows = lego ? lego.selectedMatrixRows : [];

  const handleCalculateParityCheckMatrix = async () => {
    if (!tensorNetwork?.isSingleLego) {
      await calculateParityCheckMatrix(() => {});
    }
  };

  const subscribeToTaskUpdates = (taskId: string) => {
    setIterationStatuses((prev) => new Map(prev.set(taskId, [])));
    setWaitingForTaskUpdates((prev) => new Map(prev.set(taskId, false)));

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
                setTasks((prev) => {
                  const newTasks = new Map(prev);
                  const task = newTasks.get(taskId);
                  if (task) {
                    newTasks.set(taskId, { ...task, state: 4 });
                  }
                  return newTasks;
                });
                setTaskUpdatesChannels((prev) => {
                  const newChannels = new Map(prev);
                  newChannels.delete(taskId);
                  return newChannels;
                });
                setIterationStatuses((prev) => {
                  const newStatuses = new Map(prev);
                  newStatuses.delete(taskId);
                  return newStatuses;
                });
                setWaitingForTaskUpdates((prev) => {
                  const newWaiting = new Map(prev);
                  newWaiting.delete(taskId);
                  return newWaiting;
                });
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
              setIterationStatuses(
                (prev) => new Map(prev.set(taskId, updates.iteration_status))
              );
              setWaitingForTaskUpdates(
                (prev) => new Map(prev.set(taskId, false))
              );
            }
            if (updates?.state !== undefined) {
              console.log("Setting task state:", updates.state);
              setTasks((prev) => {
                const newTasks = new Map(prev);
                const task = newTasks.get(taskId);
                if (task) {
                  newTasks.set(taskId, { ...task, state: updates.state });
                }
                return newTasks;
              });

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
          setTaskUpdatesChannels((prev) => new Map(prev.set(taskId, channel)));
        }
      });
    return () => {
      console.log("Unsubscribing from task updates for task:", taskId);
      channel.unsubscribe();
    };
  };

  const readAndUpdateTask = async (taskId: string) => {
    if (!userContextSupabase || !tensorNetwork) {
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
            const task = data[0] as Task;
            setTasks((prev) => new Map(prev.set(taskId, task)));

            if (task.state === 0 || task.state === 1) {
              console.log("Setting up subscription for task:", taskId);
              subscribeToTaskUpdates(taskId);
            } else {
              const existingChannel = taskUpdatesChannels.get(taskId);
              if (existingChannel) {
                console.log(
                  "Unsubscribing from task updates for task:",
                  taskId
                );
                await existingChannel.unsubscribe();
                setTaskUpdatesChannels((prev) => {
                  const newChannels = new Map(prev);
                  newChannels.delete(taskId);
                  return newChannels;
                });
                setIterationStatuses((prev) => {
                  const newStatuses = new Map(prev);
                  newStatuses.delete(taskId);
                  return newStatuses;
                });
                setWaitingForTaskUpdates((prev) => {
                  const newWaiting = new Map(prev);
                  newWaiting.delete(taskId);
                  return newWaiting;
                });
              } else {
                console.log(
                  "No task updates channel found, so not unsubscribing"
                );
              }

              // If task succeeded and has a result, cache it in the weight enumerator
              if (
                task.state === 2 &&
                task.result &&
                task.job_type === "weightenumerator"
              ) {
                try {
                  const result = JSON.parse(task.result);
                  const currentEnumerator = weightEnumerators[
                    tensorNetwork.signature
                  ]?.find((enumerator) => enumerator.taskId === taskId);

                  console.log("Task result for", taskId, ":", result);
                  console.log("Current enumerator:", currentEnumerator);
                  console.log(
                    "Has polynomial:",
                    !!currentEnumerator?.polynomial
                  );
                  console.log(
                    "Result has stabilizer_polynomial:",
                    !!result.stabilizer_polynomial
                  );

                  if (
                    currentEnumerator &&
                    !currentEnumerator.polynomial &&
                    result.stabilizer_polynomial
                  ) {
                    // Update the weight enumerator with the result using the store method
                    setWeightEnumerator(
                      tensorNetwork.signature,
                      taskId,
                      currentEnumerator.with({
                        polynomial: result.stabilizer_polynomial,
                        normalizerPolynomial: result.normalizer_polynomial
                      })
                    );

                    console.log(
                      "Cached weight enumerator result for task:",
                      taskId
                    );
                  } else {
                    console.log(
                      "Skipping update for task",
                      taskId,
                      "because:",
                      {
                        hasCurrentEnumerator: !!currentEnumerator,
                        hasPolynomial: !!currentEnumerator?.polynomial,
                        hasResultStabilizerPolynomial:
                          !!result.stabilizer_polynomial
                      }
                    );
                  }
                } catch (parseError) {
                  console.error("Error parsing task result:", parseError);
                }
              }
            }
          }
        }
      });
  };

  // Handle all weight enumerators for the current tensor network
  useEffect(() => {
    if (!tensorNetwork?.signature) return;

    const allEnumerators = weightEnumerators[tensorNetwork.signature] || [];

    allEnumerators.forEach((enumerator) => {
      if (enumerator.taskId) {
        // Only fetch task details if we don't already have the result cached
        if (!enumerator.polynomial) {
          readAndUpdateTask(enumerator.taskId);
        }
      }
    });
  }, [
    tensorNetwork?.signature,
    JSON.stringify(
      weightEnumerators[tensorNetwork?.signature || ""]?.map((e) => e.taskId) ||
        []
    )
  ]);

  const handleSingleLegoMatrixChange = useCanvasStore(
    (state) => state.handleSingleLegoMatrixChange
  );

  const handleMultiLegoMatrixChange = useCanvasStore(
    (state) => state.handleMultiLegoMatrixChange
  );

  const handleRemoveHighlights = () => {
    if (tensorNetwork && tensorNetwork.legos.length == 1) {
      handleMatrixRowSelectionForSelectedTensorNetwork([]);
      return;
    }
    // otherwise we'll have to go through all selected legos and clear their highlights
    if (tensorNetwork) {
      if (parityCheckMatrices[tensorNetwork.signature]) {
        handleMatrixRowSelectionForSelectedTensorNetwork([]);
      }

      tensorNetwork.legos.forEach((lego) => {
        handleSingleLegoMatrixRowSelection(lego, []);
      });
    }
  };

  const handleLegoMatrixChange = useCallback(
    (newMatrix: number[][]) => {
      if (!tensorNetwork) return;
      const lego = tensorNetwork.legos[0];
      handleSingleLegoMatrixChange(lego, newMatrix);
    },
    [tensorNetwork, handleSingleLegoMatrixChange]
  );

  // Memoized leg ordering for single lego
  const singleLegoLegOrdering = useMemo(() => {
    if (!tensorNetwork || tensorNetwork.legos.length !== 1) return [];

    return Array.from(
      {
        length: tensorNetwork.legos[0].numberOfLegs
      },
      (_, i) => ({
        instance_id: tensorNetwork.legos[0].instance_id,
        leg_index: i
      })
    );
  }, [
    tensorNetwork?.legos?.[0]?.instance_id,
    tensorNetwork?.legos?.[0]?.parity_check_matrix?.length
  ]);

  const handleCancelTask = async (taskId: string) => {
    try {
      const acessToken = await getAccessToken();

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
            Authorization: `Bearer ${acessToken}`
          }
        }
      );
      console.log("Task cancellation requested:", taskId);
      const taskChannel = taskUpdatesChannels.get(taskId);
      if (taskChannel) {
        console.log("Unsubscribing from task updates");
        await taskChannel.unsubscribe();
        console.log("Task updates unsubscribed");
      }
      setTaskUpdatesChannels((prev) => {
        const newChannels = new Map(prev);
        newChannels.delete(taskId);
        return newChannels;
      });
      setIterationStatuses((prev) => {
        const newStatuses = new Map(prev);
        newStatuses.delete(taskId);
        return newStatuses;
      });
      setWaitingForTaskUpdates((prev) => {
        const newWaiting = new Map(prev);
        newWaiting.delete(taskId);
        return newWaiting;
      });
      setTasks((prev) => {
        const newTasks = new Map(prev);
        const task = newTasks.get(taskId);
        if (task) {
          newTasks.set(taskId, { ...task, state: 4 });
        }
        return newTasks;
      });
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

  const fetchTaskLogs = async (taskId: string) => {
    try {
      setIsLoadingLogs(true);
      onLogsModalOpen();

      const acessToken = await getAccessToken();
      const key = !acessToken ? config.runtimeStoreAnonKey : acessToken;
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
    <Box
      h="100%"
      borderLeft="1px"
      borderColor={borderColor}
      bg={bgColor}
      overflowY="auto"
      p={0}
    >
      <SubnetToolbar
        responsive={true}
        onRemoveHighlights={handleRemoveHighlights}
        isUserLoggedIn={isUserLoggedIn}
      />

      <DetailsHeader
        tensorNetwork={tensorNetwork}
        lego={lego}
        isSingleLego={!!isSingleLego}
        droppedLegosCount={droppedLegos.length}
        cachedTensorNetwork={cachedTensorNetwork}
        onShortNameChange={(newShortName) => {
          if (lego) {
            const updatedLego = lego.with({
              short_name: newShortName
            });
            setTimeout(() => {
              updateDroppedLego(lego.instance_id, updatedLego);
            });
          }
        }}
        onAlwaysShowLegsChange={(alwaysShow) => {
          if (lego) {
            const updatedLego = lego.with({
              alwaysShowLegs: alwaysShow
            });
            updateDroppedLego(lego.instance_id, updatedLego);
          }
        }}
      />

      {tensorNetwork && (
        <Calculations
          tensorNetwork={tensorNetwork}
          lego={lego}
          isSingleLego={!!isSingleLego}
          parityCheckMatrix={parityCheckMatrix}
          selectedRows={
            isSingleLego
              ? legoSelectedRows
              : selectedTensorNetworkParityCheckMatrixRows[
                  tensorNetwork.signature
                ] || []
          }
          singleLegoLegOrdering={singleLegoLegOrdering}
          weightEnumerators={
            tensorNetwork.signature
              ? listWeightEnumerators(tensorNetwork.signature)
              : []
          }
          tasks={tasks}
          iterationStatuses={iterationStatuses}
          waitingForTaskUpdates={waitingForTaskUpdates}
          taskUpdatesChannels={taskUpdatesChannels}
          onCalculatePCM={handleCalculateParityCheckMatrix}
          onRowSelectionChange={
            handleMatrixRowSelectionForSelectedTensorNetwork
          }
          onMatrixChange={
            isSingleLego
              ? handleLegoMatrixChange
              : (newMatrix) => {
                  handleMultiLegoMatrixChange(
                    tensorNetwork.signature,
                    newMatrix
                  );
                }
          }
          onRecalculate={handleCalculateParityCheckMatrix}
          onCancelTask={handleCancelTask}
          onViewLogs={fetchTaskLogs}
          signature={tensorNetwork.signature}
        />
      )}

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

export default DetailsPanel;
