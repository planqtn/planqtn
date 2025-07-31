import {
  Box,
  VStack,
  Heading,
  Text,
  Button,
  Icon,
  useColorModeValue,
  Input,
  Checkbox,
  useDisclosure
} from "@chakra-ui/react";
import { FaTable, FaCube } from "react-icons/fa";
import {
  TaskUpdate,
  TaskUpdateIterationStatus,
  Task
} from "../../lib/types.ts";

import { ParityCheckMatrixDisplay } from "./ParityCheckMatrixDisplay.tsx";
import axios, { AxiosError } from "axios";
import { useState, useCallback, useMemo } from "react";
import * as _ from "lodash";
import { canDoBialgebra } from "@/transformations/zx/Bialgebra.ts";
import { canDoInverseBialgebra } from "@/transformations/zx/InverseBialgebra.ts";
import { canDoHopfRule } from "@/transformations/zx/Hopf.ts";
import { canDoConnectGraphNodes } from "@/transformations/graph-states/ConnectGraphNodesWithCenterLego.ts";
import { canDoCompleteGraphViaHadamards } from "@/transformations/graph-states/CompleteGraphViaHadamards.ts";
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
import TaskDetailsDisplay from "../tasks/TaskDetailsDisplay.tsx";
import TaskLogsModal from "../tasks/TaskLogsModal.tsx";
import { getAxiosErrorMessage } from "../../lib/errors.ts";
import { useCanvasStore } from "../../stores/canvasStateStore.ts";
import { usePanelConfigStore } from "../../stores/panelConfigStore";
import { useUserStore } from "@/stores/userStore.ts";
import { canDoChangeColor } from "@/transformations/zx/ChangeColor.ts";

const DetailsPanel: React.FC = () => {
  const { currentUser: user } = useUserStore();

  const fuseLegos = useCanvasStore((state) => state.fuseLegos);
  const handlePullOutSameColoredLeg = useCanvasStore(
    (state) => state.handlePullOutSameColoredLeg
  );
  const handleChangeColor = useCanvasStore((state) => state.handleChangeColor);
  const handleBialgebra = useCanvasStore((state) => state.handleBialgebra);
  const handleInverseBialgebra = useCanvasStore(
    (state) => state.handleInverseBialgebra
  );
  const handleHopfRule = useCanvasStore((state) => state.handleHopfRule);
  const handleConnectGraphNodes = useCanvasStore(
    (state) => state.handleConnectGraphNodes
  );
  const handleCompleteGraphViaHadamards = useCanvasStore(
    (state) => state.handleCompleteGraphViaHadamards
  );
  const handleUnfuseToLegs = useCanvasStore(
    (state) => state.handleUnfuseToLegs
  );
  const handleUnfuseInto2Legos = useCanvasStore(
    (state) => state.handleUnfuseInto2Legos
  );
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

  const lego =
    tensorNetwork?.legos.length == 1 ? tensorNetwork?.legos[0] : null;
  const legoSelectedRows = lego ? lego.selectedMatrixRows : [];

  const handleCalculateParityCheckMatrix = async () => {
    if (tensorNetwork?.isSingleLego) {
      // For single legos, open the PCM panel directly with the lego's matrix
      const singleLego = tensorNetwork.singleLego;
      openSingleLegoPCMPanel(
        singleLego.instance_id,
        singleLego.short_name || singleLego.name
      );
    } else {
      // For multi-lego networks, calculate the parity check matrix and open the panel
      await calculateParityCheckMatrix((networkSignature, networkName) => {
        // Open PCM panel after successful calculation
        openPCMPanel(networkSignature, networkName);
      });
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
      <VStack align="stretch" spacing={1} p={4}>
        {tensorNetwork && tensorNetwork.legos.length == 1 ? (
          <>
            <Heading size="md">Lego Instance Details</Heading>
            <VStack align="stretch" spacing={3}>
              <Text fontWeight="bold">
                {tensorNetwork.legos[0].name ||
                  tensorNetwork.legos[0].short_name}
              </Text>
              <Text fontSize="sm" color="gray.600">
                {tensorNetwork.legos[0].description}, instaceId:{" "}
                {tensorNetwork.legos[0].instance_id}, x:{" "}
                {tensorNetwork.legos[0].logicalPosition.x}, y:{" "}
                {tensorNetwork.legos[0].logicalPosition.y}
              </Text>
              <Box>
                <Text fontSize="sm" mb={1}>
                  Short Name:
                </Text>
                <Input
                  size="sm"
                  value={tensorNetwork.legos[0].short_name}
                  onChange={(e) => {
                    const newShortName = e.target.value;
                    const updatedLego = tensorNetwork.legos[0].with({
                      short_name: newShortName
                    });
                    setTimeout(() => {
                      updateDroppedLego(
                        tensorNetwork.legos[0].instance_id,
                        updatedLego
                      );
                    });
                  }}
                  onKeyDown={(e) => {
                    e.stopPropagation();
                  }}
                />
              </Box>
              <Box>
                <Checkbox
                  isChecked={tensorNetwork.legos[0].alwaysShowLegs || false}
                  onChange={(e) => {
                    const updatedLego = tensorNetwork.legos[0].with({
                      alwaysShowLegs: e.target.checked
                    });
                    updateDroppedLego(
                      tensorNetwork.legos[0].instance_id,
                      updatedLego
                    );
                  }}
                >
                  Always show legs
                </Checkbox>
              </Box>
              {canDoChangeColor(tensorNetwork.legos) && (
                <>
                  <Button
                    leftIcon={<Icon as={FaCube} />}
                    colorScheme="blue"
                    size="sm"
                    onClick={() => handleUnfuseToLegs(tensorNetwork.legos[0])}
                  >
                    Unfuse to legs
                  </Button>

                  <Button
                    leftIcon={<Icon as={FaCube} />}
                    colorScheme="blue"
                    size="sm"
                    onClick={() =>
                      handleUnfuseInto2Legos(tensorNetwork.legos[0])
                    }
                  >
                    Unfuse into 2 legos
                  </Button>

                  <Button
                    leftIcon={<Icon as={FaCube} />}
                    colorScheme="blue"
                    size="sm"
                    onClick={() => handleChangeColor(tensorNetwork.legos[0])}
                  >
                    Change color
                  </Button>

                  <Button
                    leftIcon={<Icon as={FaCube} />}
                    colorScheme="blue"
                    size="sm"
                    onClick={() =>
                      handlePullOutSameColoredLeg(tensorNetwork.legos[0])
                    }
                  >
                    Pull out a leg of same color (p)
                  </Button>
                </>
              )}
              <Box
                p={4}
                borderWidth={1}
                borderRadius="lg"
                bg={bgColor}
                w="100%"
                h="300px"
              >
                <ParityCheckMatrixDisplay
                  matrix={tensorNetwork.legos[0].parity_check_matrix}
                  legOrdering={singleLegoLegOrdering}
                  selectedRows={legoSelectedRows}
                  onRowSelectionChange={
                    handleMatrixRowSelectionForSelectedTensorNetwork
                  }
                  onMatrixChange={handleLegoMatrixChange}
                  title={
                    tensorNetwork.legos[0].name ||
                    tensorNetwork.legos[0].short_name
                  }
                  lego={tensorNetwork.legos[0]}
                  popOut={true}
                />
              </Box>
            </VStack>
          </>
        ) : tensorNetwork && tensorNetwork.legos.length > 1 ? (
          <>
            <Heading size="md">Tensor Network</Heading>
            <Text>Selected components: {tensorNetwork.legos.length} Legos</Text>
            <Box p={4} borderWidth={1} borderRadius="lg" bg={bgColor}>
              <VStack align="stretch" spacing={4}>
                <Heading size="md">Transformations</Heading>
                <VStack align="stretch" spacing={3}>
                  <Button
                    colorScheme="blue"
                    size="sm"
                    width="full"
                    onClick={() => fuseLegos(tensorNetwork.legos)}
                    leftIcon={<Icon as={FaCube} />}
                  >
                    Fuse Legos (f)
                  </Button>
                  {canDoBialgebra(tensorNetwork.legos, connections) && (
                    <Button
                      leftIcon={<Icon as={FaCube} />}
                      colorScheme="blue"
                      size="sm"
                      onClick={() => handleBialgebra(tensorNetwork.legos)}
                    >
                      Bialgebra
                    </Button>
                  )}
                  {canDoInverseBialgebra(tensorNetwork.legos, connections) && (
                    <Button
                      leftIcon={<Icon as={FaCube} />}
                      colorScheme="blue"
                      size="sm"
                      onClick={() =>
                        handleInverseBialgebra(tensorNetwork.legos)
                      }
                    >
                      Inverse bialgebra
                    </Button>
                  )}
                  {canDoHopfRule(tensorNetwork.legos, connections) && (
                    <Button
                      leftIcon={<Icon as={FaCube} />}
                      colorScheme="blue"
                      size="sm"
                      onClick={() => handleHopfRule(tensorNetwork.legos)}
                    >
                      Hopf rule
                    </Button>
                  )}
                  {canDoConnectGraphNodes(tensorNetwork.legos) && (
                    <Button
                      leftIcon={<Icon as={FaCube} />}
                      colorScheme="blue"
                      size="sm"
                      onClick={() =>
                        handleConnectGraphNodes(tensorNetwork.legos)
                      }
                    >
                      Connect Graph Nodes with center lego
                    </Button>
                  )}
                  {canDoCompleteGraphViaHadamards(tensorNetwork.legos) && (
                    <Button
                      leftIcon={<Icon as={FaCube} />}
                      colorScheme="blue"
                      size="sm"
                      onClick={() =>
                        handleCompleteGraphViaHadamards(tensorNetwork.legos)
                      }
                    >
                      Complete Graph Via Hadamards
                    </Button>
                  )}
                </VStack>
                <Heading size="md">Network Details</Heading>
                <VStack align="stretch" spacing={1}>
                  {!parityCheckMatrix && (
                    <Button
                      onClick={handleCalculateParityCheckMatrix}
                      colorScheme="blue"
                      size="sm"
                      width="full"
                      leftIcon={<Icon as={FaTable} />}
                    >
                      Calculate Parity Check Matrix
                    </Button>
                  )}
                  {parityCheckMatrix && (
                    <Box
                      p={0}
                      m={0}
                      borderWidth={1}
                      borderRadius="lg"
                      bg={bgColor}
                      w="100%"
                      h="300px"
                    >
                      <ParityCheckMatrixDisplay
                        matrix={parityCheckMatrix.matrix}
                        title={
                          cachedTensorNetwork?.name ||
                          tensorNetwork.legos.length + " legos"
                        }
                        legOrdering={parityCheckMatrix.legOrdering}
                        onMatrixChange={(newMatrix) => {
                          handleMultiLegoMatrixChange(
                            tensorNetwork.signature,
                            newMatrix
                          );
                        }}
                        onRecalculate={handleCalculateParityCheckMatrix}
                        onRowSelectionChange={
                          handleMatrixRowSelectionForSelectedTensorNetwork
                        }
                        selectedRows={
                          selectedTensorNetworkParityCheckMatrixRows[
                            tensorNetwork.signature
                          ] || []
                        }
                        signature={tensorNetwork.signature}
                        popOut={true}
                      />
                    </Box>
                  )}
                </VStack>
              </VStack>
            </Box>
          </>
        ) : (
          <>
            <Heading size="md">Canvas Overview</Heading>
            <Text color="gray.600">
              No legos are selected. There{" "}
              {droppedLegos.length === 1 ? "is" : "are"} {droppedLegos.length}{" "}
              {droppedLegos.length === 1 ? "lego" : "legos"} on the canvas.
            </Text>
          </>
        )}
        <>
          {tensorNetwork &&
          tensorNetwork.signature &&
          listWeightEnumerators(tensorNetwork.signature).length > 0 ? (
            <VStack align="stretch" spacing={3}>
              <Heading size="sm">Weight Enumerator Tasks</Heading>
              {listWeightEnumerators(tensorNetwork.signature).map(
                (enumerator, index) => {
                  const taskId = enumerator.taskId;
                  if (!taskId) return null;

                  const task = tasks.get(taskId) || null;
                  const taskIterationStatus =
                    iterationStatuses.get(taskId) || [];
                  const isWaitingForUpdate =
                    waitingForTaskUpdates.get(taskId) || false;
                  const taskChannel = taskUpdatesChannels.get(taskId) || null;

                  return (
                    <Box
                      key={taskId}
                      p={3}
                      borderWidth={1}
                      borderRadius="md"
                      bg={bgColor}
                    >
                      <VStack align="stretch" spacing={2}>
                        <Text fontSize="sm" fontWeight="medium">
                          Task #{index + 1}
                          {enumerator.truncateLength &&
                            ` (truncate: ${enumerator.truncateLength})`}
                          {enumerator.openLegs.length > 0 &&
                            ` (${enumerator.openLegs.length} open legs)`}
                        </Text>

                        {enumerator.polynomial ? (
                          <VStack align="stretch" spacing={2}>
                            {/* Display the polynomial results */}
                            <VStack align="stretch" spacing={1}>
                              <Text fontSize="sm" fontWeight="medium">
                                Stabilizer Weight Enumerator Polynomial
                              </Text>
                              <Box
                                p={2}
                                borderWidth={1}
                                borderRadius="md"
                                bg="gray.50"
                                maxH="200px"
                                overflowY="auto"
                              >
                                <Text fontFamily="mono" fontSize="xs">
                                  {enumerator.polynomial}
                                </Text>
                              </Box>

                              {enumerator.normalizerPolynomial && (
                                <>
                                  <Text fontSize="sm" fontWeight="medium">
                                    Normalizer Weight Enumerator Polynomial
                                  </Text>
                                  <Box
                                    p={2}
                                    borderWidth={1}
                                    borderRadius="md"
                                    bg="gray.50"
                                    maxH="200px"
                                    overflowY="auto"
                                  >
                                    <Text fontFamily="mono" fontSize="xs">
                                      {enumerator.normalizerPolynomial}
                                    </Text>
                                  </Box>
                                </>
                              )}
                            </VStack>
                          </VStack>
                        ) : (
                          <TaskDetailsDisplay
                            task={task}
                            taskId={taskId}
                            iterationStatus={taskIterationStatus}
                            waitingForTaskUpdate={isWaitingForUpdate}
                            taskUpdatesChannel={taskChannel}
                            onCancelTask={handleCancelTask}
                            onViewLogs={fetchTaskLogs}
                          />
                        )}
                      </VStack>
                    </Box>
                  );
                }
              )}
            </VStack>
          ) : null}
        </>
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

export default DetailsPanel;
