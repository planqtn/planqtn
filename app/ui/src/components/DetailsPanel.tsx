import {
  Box,
  VStack,
  Heading,
  Text,
  Button,
  Icon,
  HStack,
  IconButton,
  useColorModeValue,
  useClipboard,
  Input,
  Checkbox,
  Link,
  UseToastOptions,
  useDisclosure
} from "@chakra-ui/react";
import { FaTable, FaCube, FaCode, FaCopy } from "react-icons/fa";
import {
  DroppedLego,
  LegoServerPayload,
  Connection,
  Operation,
  TaskUpdate,
  TaskUpdateIterationStatus,
  Task
} from "../lib/types.ts";
import { TensorNetwork, TensorNetworkLeg } from "../lib/TensorNetwork.ts";

import { ParityCheckMatrixDisplay } from "./ParityCheckMatrixDisplay.tsx";
import axios, { AxiosError } from "axios";
import { useState } from "react";
import { getLegoStyle } from "../LegoStyles.ts";
import { LegPartitionDialog } from "./LegPartitionDialog.tsx";
import WeightEnumeratorCalculationDialog from "./WeightEnumeratorCalculationDialog.tsx";
import * as _ from "lodash";
import { OperationHistory } from "../lib/OperationHistory.ts";
import {
  canDoBialgebra,
  applyBialgebra
} from "../transformations/Bialgebra.ts";
import {
  canDoInverseBialgebra,
  applyInverseBialgebra
} from "../transformations/InverseBialgebra.ts";
import { canDoHopfRule, applyHopfRule } from "../transformations/Hopf.ts";
import {
  canDoConnectGraphNodes,
  applyConnectGraphNodes
} from "../transformations/ConnectGraphNodesWithCenterLego.ts";
import { findConnectedComponent } from "../lib/TensorNetwork.ts";
import {
  canDoCompleteGraphViaHadamards,
  applyCompleteGraphViaHadamards
} from "../transformations/CompleteGraphViaHadamards.ts";
import {
  User,
  RealtimePostgresChangesPayload,
  RealtimeChannel
} from "@supabase/supabase-js";
import {
  runtimeStoreSupabase,
  userContextSupabase
} from "../supabaseClient.ts";
import { simpleAutoFlow } from "../transformations/AutoPauliFlow.ts";
import { Legos } from "../lib/Legos.ts";
import { StabilizerCodeTensor } from "../lib/StabilizerCodeTensor.ts";
import { GF2 } from "../lib/GF2.ts";
import { config, getApiUrl } from "../config.ts";
import { getAccessToken } from "../lib/auth.ts";
import { useEffect } from "react";
import TaskDetailsDisplay from "./TaskDetailsDisplay.tsx";
import TaskLogsModal from "./TaskLogsModal.tsx";
import { getAxiosErrorMessage } from "../lib/errors.ts";

interface DetailsPanelProps {
  tensorNetwork: TensorNetwork | null;
  selectedLego: DroppedLego | null;
  droppedLegos: DroppedLego[];
  connections: Connection[];
  setTensorNetwork: (
    value:
      | TensorNetwork
      | null
      | ((prev: TensorNetwork | null) => TensorNetwork | null)
  ) => void;

  setError: (error: string) => void;
  setDroppedLegos: (value: DroppedLego[]) => void;
  setSelectedLego: (value: DroppedLego | null) => void;
  fuseLegos: (legos: DroppedLego[]) => void;
  setConnections: (value: Connection[]) => void;
  operationHistory: OperationHistory;
  encodeCanvasState: (
    pieces: DroppedLego[],
    conns: Connection[],
    hideConnectedLegs: boolean
  ) => void;
  hideConnectedLegs: boolean;
  makeSpace: (
    center: { x: number; y: number },
    radius: number,
    skipLegos: DroppedLego[],
    legosToCheck: DroppedLego[]
  ) => DroppedLego[];
  handlePullOutSameColoredLeg: (lego: DroppedLego) => Promise<void>;
  toast: (props: UseToastOptions) => void;
  user?: User | null;
}

const DetailsPanel: React.FC<DetailsPanelProps> = ({
  tensorNetwork: tensorNetwork,
  selectedLego,
  droppedLegos,
  connections,
  setTensorNetwork: setTensorNetwork,
  setError,
  setDroppedLegos,
  setSelectedLego,
  fuseLegos,
  setConnections,
  operationHistory,
  encodeCanvasState,
  hideConnectedLegs,
  makeSpace,
  handlePullOutSameColoredLeg,
  toast,
  user
}) => {
  const bgColor = useColorModeValue("white", "gray.800");
  const borderColor = useColorModeValue("gray.200", "gray.600");
  const { onCopy: onCopyCode, hasCopied: hasCopiedCode } = useClipboard(
    tensorNetwork?.constructionCode || ""
  );
  const [parityCheckMatrixCache] = useState<Map<string, StabilizerCodeTensor>>(
    new Map()
  );
  const [weightEnumeratorCache] = useState<
    Map<
      string,
      {
        taskId: string;
        polynomial: string;
        normalizerPolynomial: string;
        truncateLength: number | null;
      }
    >
  >(new Map());
  const [, setSelectedMatrixRows] = useState<number[]>([]);
  const [task, setTask] = useState<Task | null>(null);
  const [taskUpdatesChannel, setTaskUpdatesChannel] =
    useState<RealtimeChannel | null>(null);
  const [showLegPartitionDialog, setShowLegPartitionDialog] = useState(false);
  const [unfuseLego, setUnfuseLego] = useState<DroppedLego | null>(null);
  const [waitingForTaskUpdate, setWaitingForTaskUpdate] = useState(false);
  const [iterationStatus, setIterationStatus] = useState<
    Array<TaskUpdateIterationStatus>
  >([]);

  const [
    showWeightEnumeratorCalculationDialog,
    setShowWeightEnumeratorCalculationDialog
  ] = useState(false);

  const [taskLogs, setTaskLogs] = useState<string>("");
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);
  const {
    isOpen: isLogsModalOpen,
    onOpen: onLogsModalOpen,
    onClose: onLogsModalClose
  } = useDisclosure();

  const calculateParityCheckMatrix = async () => {
    if (!tensorNetwork) return;
    try {
      // Create a TensorNetwork and perform the fusion
      const network = new TensorNetwork(
        tensorNetwork.legos,
        tensorNetwork.connections
      );
      const result = network.conjoin_nodes();

      if (!result) {
        throw new Error("Cannot compute tensor network");
      }

      const legOrdering = result.legs.map((leg) => ({
        instanceId: leg.instanceId,
        legIndex: leg.legIndex
      }));

      // Update the tensor network with the new matrix and leg ordering
      setTensorNetwork(
        new TensorNetwork(
          tensorNetwork.legos,
          tensorNetwork.connections,
          result.h.getMatrix(),
          tensorNetwork.weightEnumerator,
          tensorNetwork.normalizerPolynomial,
          tensorNetwork.truncateLength,
          tensorNetwork.isCalculatingWeightEnumerator,
          tensorNetwork.taskId,
          tensorNetwork.constructionCode,
          legOrdering,
          tensorNetwork.signature
        )
      );

      parityCheckMatrixCache.set(tensorNetwork.signature!, result);
    } catch (error) {
      console.error("Error calculating parity check matrix:", error);
      setError("Failed to calculate parity check matrix");
    }
  };

  const getExternalAndDanglingLegs = () => {
    if (!tensorNetwork) return { externalLegs: [], danglingLegs: [] };
    const allLegs: TensorNetworkLeg[] = tensorNetwork.legos.flatMap((lego) => {
      const numLegs = lego.parity_check_matrix[0].length / 2;
      return Array.from({ length: numLegs }, (_, i) => ({
        instanceId: lego.instanceId,
        legIndex: i
      }));
    });
    const connectedLegs = new Set<string>();
    connections.forEach((conn) => {
      connectedLegs.add(`${conn.from.legoId}:${conn.from.legIndex}`);
      connectedLegs.add(`${conn.to.legoId}:${conn.to.legIndex}`);
    });
    // Legs in tensorNetwork but connected to something outside
    const networkInstanceIds = new Set(
      tensorNetwork.legos.map((l) => l.instanceId)
    );
    const externalLegs: TensorNetworkLeg[] = [];
    const danglingLegs: TensorNetworkLeg[] = [];
    allLegs.forEach((leg) => {
      // Find if this leg is connected
      const conn = connections.find(
        (conn) =>
          (conn.from.legoId === leg.instanceId &&
            conn.from.legIndex === leg.legIndex) ||
          (conn.to.legoId === leg.instanceId &&
            conn.to.legIndex === leg.legIndex)
      );
      if (!conn) {
        danglingLegs.push(leg);
      } else {
        // If the other side is not in the network, it's external
        const other =
          conn.from.legoId === leg.instanceId
            ? conn.to.legoId
            : conn.from.legoId;
        if (!networkInstanceIds.has(other)) {
          externalLegs.push(leg);
        }
      }
    });
    return { externalLegs, danglingLegs };
  };

  const subscribeToTaskUpdates = (taskId: string) => {
    setIterationStatus([]);
    setWaitingForTaskUpdate(false);

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
                setIterationStatus([]);
                setWaitingForTaskUpdate(false);
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
              setIterationStatus(updates.iteration_status);
              setWaitingForTaskUpdate(false);
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
    return () => {
      console.log("Unsubscribing from task updates for task:", taskId);
      channel.unsubscribe();
    };
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
            const task = data[0] as Task;
            setTask(task);
            if (task.state === 0 || task.state === 1) {
              console.log("Setting up subscription for task:", taskId);
              subscribeToTaskUpdates(taskId);
            } else {
              if (taskUpdatesChannel) {
                console.log(
                  "Unsubscribing from task updates for task:",
                  taskId
                );
                await taskUpdatesChannel.unsubscribe();
                setTaskUpdatesChannel(null);
                setIterationStatus([]);
                setWaitingForTaskUpdate(false);
              } else {
                console.log(
                  "No task updates channel found, so not unsubscribing"
                );
              }
            }
          }
        }
      });
  };

  useEffect(() => {
    if (!tensorNetwork) return;

    const signature = tensorNetwork.signature!;
    const cachedEnumerator = weightEnumeratorCache.get(signature);
    const taskId = tensorNetwork.taskId || cachedEnumerator?.taskId;
    if (taskId) {
      readAndUpdateTask(taskId);
    }
  }, [tensorNetwork, tensorNetwork?.taskId]);

  const calculateWeightEnumerator = async (
    truncateLength: number | null,
    openLegs?: TensorNetworkLeg[]
  ) => {
    if (!tensorNetwork) return;

    // Clear any existing progress bars
    setIterationStatus([]);
    setWaitingForTaskUpdate(false);

    const signature = tensorNetwork.signature!;
    const cachedEnumerator = weightEnumeratorCache.get(signature);
    if (cachedEnumerator) {
      setTensorNetwork(
        TensorNetwork.fromObj({
          ...tensorNetwork,
          taskId: cachedEnumerator.taskId,
          weightEnumerator: cachedEnumerator.polynomial,
          normalizerPolynomial: cachedEnumerator.normalizerPolynomial,
          isCalculatingWeightEnumerator: cachedEnumerator.polynomial === ""
        })
      );

      return;
    }

    try {
      setTensorNetwork((prev: TensorNetwork | null) =>
        prev
          ? TensorNetwork.fromObj({
              ...prev,
              isCalculatingWeightEnumerator: true,
              weightEnumerator: undefined,
              taskId: undefined
            })
          : null
      );
      // we kick off the job with the task store key
      const acessToken = await getAccessToken();

      const response = await axios.post(
        getApiUrl("planqtnJob"),
        {
          user_id: user?.id,
          request_time: new Date().toISOString(),
          job_type: "weightenumerator",
          task_store_url: config.userContextURL,
          task_store_anon_key: config.userContextAnonKey,
          payload: {
            legos: tensorNetwork.legos.reduce(
              (acc, lego) => {
                acc[lego.instanceId] = {
                  instanceId: lego.instanceId,
                  shortName: lego.shortName || "Generic Lego",
                  name: lego.shortName || "Generic Lego",
                  id: lego.id,
                  parity_check_matrix: lego.parity_check_matrix,
                  logical_legs: lego.logical_legs,
                  gauge_legs: lego.gauge_legs
                } as LegoServerPayload;
                return acc;
              },
              {} as Record<string, LegoServerPayload>
            ),
            connections: tensorNetwork.connections,
            truncate_length: truncateLength,
            open_legs: openLegs || []
          }
        },
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${acessToken}`
          }
        }
      );

      console.log("Response", response);

      if (response.data.status === "error") {
        throw new Error(response.data.message);
      }

      const taskId = response.data.task_id;

      console.log("Setting task ID", taskId);

      setTensorNetwork((prev: TensorNetwork | null) =>
        prev
          ? TensorNetwork.fromObj({
              ...prev,
              taskId: taskId
            })
          : null
      );

      weightEnumeratorCache.set(signature, {
        taskId: taskId,
        polynomial: "",
        normalizerPolynomial: "",
        truncateLength: null
      });

      // Show success toast with status URL
      toast({
        title: "Success starting the task!",
        description: (
          <Box>
            Check status at{" "}
            <Link href={`/tasks`} color="gray.100" isExternal>
              /tasks
            </Link>
          </Box>
        ),
        status: "success",
        duration: 5000,
        isClosable: true
      });
    } catch (err) {
      const error = err as AxiosError<{
        message: string;
        error: string;
        status: number;
      }>;
      console.error("Error calculating weight enumerator:", error);
      setError(
        `Failed to calculate weight enumerator: ${getAxiosErrorMessage(error)}`
      );

      setTensorNetwork((prev: TensorNetwork | null) =>
        prev
          ? TensorNetwork.fromObj({
              ...prev,
              isCalculatingWeightEnumerator: false
            })
          : null
      );
    }
  };

  const handleGenerateConstructionCode = () => {
    if (!tensorNetwork) return;

    try {
      console.log("tensorNetwork", tensorNetwork);
      const code = tensorNetwork.generateConstructionCode();
      setTensorNetwork((prev: TensorNetwork | null) =>
        prev
          ? TensorNetwork.fromObj({
              ...prev,
              constructionCode: code
            })
          : null
      );
    } catch (error) {
      console.error("Error generating Python code:", error);
      setError("Failed to generate Python code");
    }
  };

  const handleMatrixRowSelection = (selectedRows: number[]) => {
    setSelectedMatrixRows(selectedRows);
    if (selectedLego) {
      const updatedLego = {
        ...selectedLego,
        selectedMatrixRows: selectedRows
      };
      // Update the lego in the droppedLegos array
      const updatedDroppedLegos = droppedLegos.map((l) =>
        l.instanceId === selectedLego.instanceId ? updatedLego : l
      );
      setSelectedLego(updatedLego);
      setDroppedLegos(updatedDroppedLegos);
      encodeCanvasState(updatedDroppedLegos, connections, hideConnectedLegs);

      const selectedNetwork = findConnectedComponent(
        updatedLego,
        updatedDroppedLegos,
        connections
      );
      simpleAutoFlow(
        updatedLego,
        selectedNetwork,
        connections,
        (updateFn) => setDroppedLegos(updateFn(updatedDroppedLegos)),
        setTensorNetwork
      );
    }
  };

  const handleLegOrderingChange = (newLegOrdering: TensorNetworkLeg[]) => {
    if (tensorNetwork) {
      // Update the tensor network state
      setTensorNetwork((prev: TensorNetwork | null) =>
        prev
          ? TensorNetwork.fromObj({
              ...prev,
              legOrdering: newLegOrdering
            })
          : null
      );

      // Update the cache
      const signature = tensorNetwork.signature!;
      const cachedResponse = parityCheckMatrixCache.get(signature);
      if (cachedResponse) {
        parityCheckMatrixCache.set(
          signature,
          new StabilizerCodeTensor(
            cachedResponse.h,
            cachedResponse.idx,
            newLegOrdering
          )
        );
      }
    }
  };

  const handleChangeColor = (lego: DroppedLego) => {
    // Get max instance ID
    const maxInstanceId = Math.max(
      ...droppedLegos.map((l) => parseInt(l.instanceId))
    );
    const numLegs = lego.parity_check_matrix[0].length / 2;

    // Find any existing connections to the original lego
    const existingConnections = connections.filter(
      (conn) =>
        conn.from.legoId === lego.instanceId ||
        conn.to.legoId === lego.instanceId
    );

    // Store the old state for history
    const oldLegos = [lego];
    const oldConnections = existingConnections;
    const newParityCheckMatrix = lego.parity_check_matrix.map((row) => {
      const n = row.length / 2;
      return [...row.slice(n), ...row.slice(0, n)];
    });
    // Create new legos array starting with the modified original lego
    const newLegos: DroppedLego[] = [
      {
        ...lego,
        id: lego.id === "x_rep_code" ? "z_rep_code" : "x_rep_code",
        shortName: lego.id === "x_rep_code" ? "Z Rep Code" : "X Rep Code",
        style: getLegoStyle(
          lego.id === "x_rep_code" ? "z_rep_code" : "x_rep_code",
          numLegs
        ),
        parity_check_matrix: newParityCheckMatrix
      }
    ];

    // Create new connections array
    const newConnections: Connection[] = [];

    // Make space for Hadamard legos
    const radius = 50; // Same radius as for Hadamard placement
    const updatedLegos = makeSpace(
      { x: lego.x, y: lego.y },
      radius,
      [lego],
      droppedLegos
    );

    // Add Hadamard legos for each leg
    for (let i = 0; i < numLegs; i++) {
      // Calculate the angle for this leg
      const angle = (2 * Math.PI * i) / numLegs;
      const hadamardLego: DroppedLego = {
        id: "h",
        name: "Hadamard",
        shortName: "H",
        description: "Hadamard",
        instanceId: (maxInstanceId + 1 + i).toString(),
        x: lego.x + radius * Math.cos(angle),
        y: lego.y + radius * Math.sin(angle),
        parity_check_matrix: [
          [1, 0, 0, 1],
          [0, 1, 1, 0]
        ],
        logical_legs: [],
        gauge_legs: [],
        style: getLegoStyle("h", 2),
        selectedMatrixRows: []
      };
      newLegos.push(hadamardLego);

      // Connect Hadamard to the original lego
      newConnections.push(
        new Connection(
          { legoId: lego.instanceId, legIndex: i },
          { legoId: hadamardLego.instanceId, legIndex: 0 }
        )
      );

      // Connect Hadamard to the original connection if it exists
      const existingConnection = existingConnections.find((conn) =>
        conn.containsLeg(lego.instanceId, i)
      );

      if (existingConnection) {
        if (existingConnection.from.legoId === lego.instanceId) {
          newConnections.push(
            new Connection(
              { legoId: hadamardLego.instanceId, legIndex: 1 },
              existingConnection.to
            )
          );
        } else {
          newConnections.push(
            new Connection(existingConnection.from, {
              legoId: hadamardLego.instanceId,
              legIndex: 1
            })
          );
        }
      }
    }

    // Update state with the legos that were pushed out of the way
    const finalLegos = [
      ...updatedLegos.filter((l) => l.instanceId !== lego.instanceId),
      ...newLegos
    ];
    const updatedConnections = [
      ...connections.filter(
        (conn) =>
          !existingConnections.some(
            (existingConn) =>
              existingConn.from.legoId === conn.from.legoId &&
              existingConn.from.legIndex === conn.from.legIndex &&
              existingConn.to.legoId === conn.to.legoId &&
              existingConn.to.legIndex === conn.to.legIndex
          )
      ),
      ...newConnections
    ];
    setDroppedLegos(finalLegos);
    setConnections(updatedConnections);

    // Add to history
    const operation: Operation = {
      type: "colorChange",
      data: {
        legosToRemove: oldLegos,
        connectionsToRemove: oldConnections,
        legosToAdd: newLegos,
        connectionsToAdd: newConnections
      }
    };
    operationHistory.addOperation(operation);
    setSelectedLego(null);

    // Update URL state
    encodeCanvasState(finalLegos, updatedConnections, hideConnectedLegs);
  };

  const handleUnfuseInto2Legos = (lego: DroppedLego) => {
    // Store the original state
    const originalAlwaysShowLegs = lego.alwaysShowLegs;

    // Temporarily force legs to be shown
    const updatedLego = { ...lego, alwaysShowLegs: true };
    setDroppedLegos(
      droppedLegos.map((l) =>
        l.instanceId === lego.instanceId ? updatedLego : l
      )
    );
    setUnfuseLego(updatedLego);
    setShowLegPartitionDialog(true);

    // Add cleanup function to restore original state when dialog closes
    const cleanup = () => {
      setDroppedLegos(
        droppedLegos.map((l) =>
          l.instanceId === lego.instanceId
            ? { ...l, alwaysShowLegs: originalAlwaysShowLegs }
            : l
        )
      );
    };

    // Store cleanup function
    (
      window as Window & { __restoreLegsState?: () => void }
    ).__restoreLegsState = cleanup;
  };

  const handleUnfuseTo2LegosPartitionConfirm = async (
    legPartition: number[],
    oldConnections: Connection[]
  ) => {
    if (!unfuseLego) {
      return;
    }

    const lego = unfuseLego;

    // Get max instance ID
    const maxInstanceId = Math.max(
      ...droppedLegos.map((l) => parseInt(l.instanceId))
    );

    // Find any existing connections to the original lego
    console.log("Old connections", oldConnections);
    const connectionsInvolvingLego = oldConnections.filter((conn) =>
      conn.containsLego(lego.instanceId)
    );

    try {
      // Count legs for each new lego
      const lego1Legs = legPartition.filter((x) => !x).length;
      const lego2Legs = legPartition.filter((x) => x).length;

      // Create maps for new leg indices
      const lego1LegMap = new Map<number, number>();
      const lego2LegMap = new Map<number, number>();
      let lego1Count = 0;
      let lego2Count = 0;

      // Build the leg mapping
      legPartition.forEach((isLego2, oldIndex) => {
        if (!isLego2) {
          lego1LegMap.set(oldIndex, lego1Count++);
        } else {
          lego2LegMap.set(oldIndex, lego2Count++);
        }
      });

      // Get dynamic legos for both parts (adding 1 leg to each for the connection between them)
      const [lego1Data, lego2Data] = [
        Legos.getDynamicLego({
          lego_id: lego.id,
          parameters: { d: lego1Legs + 1 }
        }),
        Legos.getDynamicLego({
          lego_id: lego.id,
          parameters: { d: lego2Legs + 1 }
        })
      ];

      // Create the two new legos
      const lego1: DroppedLego = {
        ...lego,
        style: getLegoStyle(lego.id, lego1Legs + 1),
        instanceId: (maxInstanceId + 1).toString(),
        x: lego.x - 50, // Position slightly to the left
        parity_check_matrix: lego1Data.parity_check_matrix,
        alwaysShowLegs: false
      };

      const lego2: DroppedLego = {
        ...lego,
        style: getLegoStyle(lego.id, lego2Legs + 1),
        instanceId: (maxInstanceId + 2).toString(),
        x: lego.x + 50, // Position slightly to the right
        parity_check_matrix: lego2Data.parity_check_matrix,
        alwaysShowLegs: false
      };

      // Create connection between the new legos
      const connectionBetweenLegos: Connection = new Connection(
        {
          legoId: lego1.instanceId,
          legIndex: lego1Legs // The last leg is the connecting one
        },
        {
          legoId: lego2.instanceId,
          legIndex: lego2Legs // The last leg is the connecting one
        }
      );

      // Remap existing connections based on leg assignments
      const newConnections = connectionsInvolvingLego.map((conn) => {
        const newConn = new Connection(
          _.cloneDeep(conn.from),
          _.cloneDeep(conn.to)
        );
        if (conn.from.legoId === lego.instanceId) {
          const oldLegIndex = conn.from.legIndex;
          if (!legPartition[oldLegIndex]) {
            // Goes to lego1
            newConn.from.legoId = lego1.instanceId;
            newConn.from.legIndex = lego1LegMap.get(oldLegIndex)!;
          } else {
            // Goes to lego2
            newConn.from.legoId = lego2.instanceId;
            newConn.from.legIndex = lego2LegMap.get(oldLegIndex)!;
          }
        }
        if (conn.to.legoId === lego.instanceId) {
          const oldLegIndex = conn.to.legIndex;
          if (!legPartition[oldLegIndex]) {
            // Goes to lego1
            newConn.to.legoId = lego1.instanceId;
            newConn.to.legIndex = lego1LegMap.get(oldLegIndex)!;
          } else {
            // Goes to lego2
            newConn.to.legoId = lego2.instanceId;
            newConn.to.legIndex = lego2LegMap.get(oldLegIndex)!;
          }
        }
        return newConn;
      });

      // Update the state
      const newLegos = [
        ...droppedLegos.filter((l) => l.instanceId !== lego.instanceId),
        lego1,
        lego2
      ];

      // Only keep connections that don't involve the original lego at all
      // We need to filter from the full connections array, not just existingConnections
      const remainingConnections = oldConnections.filter(
        (c) => !c.containsLego(lego.instanceId)
      );

      // Add the remapped connections and the new connection between legos
      const updatedConnections = [
        ...remainingConnections,
        ...newConnections,
        connectionBetweenLegos
      ];

      // console.log("Remaining connections", remainingConnections);
      // console.log("New connections", newConnections);
      // console.log("Connection between legos", connectionBetweenLegos);

      // console.log("Connections involving lego", connectionsInvolvingLego);

      setDroppedLegos(newLegos);
      setConnections(updatedConnections);

      // Add to operation history
      operationHistory.addOperation({
        type: "unfuseInto2Legos",
        data: {
          legosToRemove: [lego],
          connectionsToRemove: connectionsInvolvingLego,
          legosToAdd: [lego1, lego2],
          connectionsToAdd: [...newConnections, connectionBetweenLegos]
        }
      });

      // Update URL state
      encodeCanvasState(newLegos, updatedConnections, hideConnectedLegs);
    } catch (error) {
      setError(`Error unfusing lego: ${error}`);
    }

    setShowLegPartitionDialog(false);
    setUnfuseLego(null);
    setSelectedLego(null);
  };

  const handleUnfuseToLegs = (lego: DroppedLego) => {
    // Get max instance ID
    const maxInstanceId = Math.max(
      ...droppedLegos.map((l) => parseInt(l.instanceId))
    );
    const numLegs = lego.parity_check_matrix[0].length / 2;

    // Find any existing connections to the original lego
    const existingConnections = connections.filter(
      (conn) =>
        conn.from.legoId === lego.instanceId ||
        conn.to.legoId === lego.instanceId
    );

    let newLegos: DroppedLego[] = [];
    let newConnections: Connection[] = [];

    // Store the old state for history
    const oldLegos = [lego];
    const oldConnections = existingConnections;

    const d3_x_rep = [
      [1, 1, 0, 0, 0, 0], // Z stabilizers
      [0, 1, 1, 0, 0, 0],
      [0, 0, 0, 1, 1, 1] // X logical
    ];
    const d3_z_rep = [
      [0, 0, 0, 1, 1, 0], // X stabilizers
      [0, 0, 0, 0, 1, 1],
      [1, 1, 1, 0, 0, 0] // Z logical
    ];

    const bell_pair = [
      [1, 1, 0, 0],
      [0, 0, 1, 1]
    ];

    const isXCode = lego.id === "x_rep_code";

    if (numLegs === 1) {
      // Case 1: Original lego has 1 leg -> Create 1 new lego with 2 legs
      const newLego: DroppedLego = {
        ...lego,
        instanceId: (maxInstanceId + 1).toString(),
        x: lego.x + 100,
        y: lego.y,
        selectedMatrixRows: [],
        parity_check_matrix: bell_pair
      };
      newLegos = [lego, newLego];

      // Connect the new lego to the original connections
      if (existingConnections.length > 0) {
        const firstConnection = existingConnections[0];
        if (firstConnection.from.legoId === lego.instanceId) {
          newConnections = [
            new Connection(
              { legoId: newLego.instanceId, legIndex: 0 },
              firstConnection.to
            ),
            new Connection(
              { legoId: newLego.instanceId, legIndex: 1 },
              { legoId: lego.instanceId, legIndex: 1 }
            )
          ];
        } else {
          newConnections = [
            new Connection(firstConnection.from, {
              legoId: newLego.instanceId,
              legIndex: 0
            }),
            new Connection(
              { legoId: lego.instanceId, legIndex: 1 },
              { legoId: newLego.instanceId, legIndex: 1 }
            )
          ];
        }
      }
    } else if (numLegs === 2) {
      // Case 2: Original lego has 2 legs -> Create 1 new lego with 2 legs
      const newLego: DroppedLego = {
        ...lego,
        instanceId: (maxInstanceId + 1).toString(),
        x: lego.x + 100,
        y: lego.y,
        selectedMatrixRows: [],
        parity_check_matrix: bell_pair
      };
      newLegos = [lego, newLego];

      // -- [0,lego,1]  - [0, new lego 1] --

      newConnections.push(
        new Connection(
          { legoId: newLego.instanceId, legIndex: 0 },
          { legoId: lego.instanceId, legIndex: 1 }
        )
      );

      // Connect the new lego to the original connections
      existingConnections.forEach((conn, index) => {
        const targetLego = index === 0 ? lego : newLego;
        const legIndex = index === 0 ? 0 : 1;

        newConnections.push(
          new Connection(
            conn.from.legoId === lego.instanceId
              ? { legoId: targetLego.instanceId, legIndex }
              : conn.from,
            conn.from.legoId === lego.instanceId
              ? conn.to
              : { legoId: targetLego.instanceId, legIndex }
          )
        );
      });
    } else if (numLegs >= 3) {
      // Case 3: Original lego has 3 or more legs -> Create n new legos in a circle
      const radius = 100; // Radius of the circle
      const centerX = lego.x;
      const centerY = lego.y;

      // First create all legos
      for (let i = 0; i < numLegs; i++) {
        const angle = (2 * Math.PI * i) / numLegs;
        const newLego: DroppedLego = {
          ...lego,
          instanceId: (maxInstanceId + 1 + i).toString(),
          x: centerX + radius * Math.cos(angle),
          y: centerY + radius * Math.sin(angle),
          selectedMatrixRows: [],
          parity_check_matrix: isXCode ? d3_x_rep : d3_z_rep
        };
        newLegos.push(newLego);
      }

      // Then create all connections
      for (let i = 0; i < numLegs; i++) {
        // Connect to the next lego in the circle using leg 0
        const nextIndex = (i + 1) % numLegs;
        newConnections.push(
          new Connection(
            { legoId: newLegos[i].instanceId, legIndex: 0 },
            { legoId: newLegos[nextIndex].instanceId, legIndex: 1 }
          )
        );

        // Connect the third leg (leg 2) to the original connections
        if (existingConnections[i]) {
          const conn = existingConnections[i];
          if (conn.from.legoId === lego.instanceId) {
            newConnections.push(
              new Connection(
                { legoId: newLegos[i].instanceId, legIndex: 2 },
                conn.to
              )
            );
          } else {
            newConnections.push(
              new Connection(conn.from, {
                legoId: newLegos[i].instanceId,
                legIndex: 2
              })
            );
          }
        }
      }
    }

    // Update state
    const updatedLegos = [
      ...droppedLegos.filter((l) => l.instanceId !== lego.instanceId),
      ...newLegos
    ];
    const updatedConnections = [
      ...connections.filter(
        (conn) =>
          !existingConnections.some(
            (existingConn) =>
              existingConn.from.legoId === conn.from.legoId &&
              existingConn.from.legIndex === conn.from.legIndex &&
              existingConn.to.legoId === conn.to.legoId &&
              existingConn.to.legIndex === conn.to.legIndex
          )
      ),
      ...newConnections
    ];
    setDroppedLegos(updatedLegos);
    setConnections(updatedConnections);
    encodeCanvasState(updatedLegos, updatedConnections, hideConnectedLegs);

    // Add to history
    const operation: Operation = {
      type: "unfuseToLegs",
      data: {
        legosToRemove: oldLegos,
        connectionsToRemove: oldConnections,
        legosToAdd: newLegos,
        connectionsToAdd: newConnections
      }
    };
    operationHistory.addOperation(operation);
  };

  const handleBialgebra = async () => {
    const result = await applyBialgebra(
      tensorNetwork!.legos,
      droppedLegos,
      connections
    );
    setDroppedLegos(result.droppedLegos);
    setConnections(result.connections);
    operationHistory.addOperation(result.operation);
    encodeCanvasState(
      result.droppedLegos,
      result.connections,
      hideConnectedLegs
    );
  };

  const handleInverseBialgebra = async () => {
    const result = await applyInverseBialgebra(
      tensorNetwork!.legos,
      droppedLegos,
      connections
    );
    setDroppedLegos(result.droppedLegos);
    setConnections(result.connections);
    operationHistory.addOperation(result.operation);
    encodeCanvasState(
      result.droppedLegos,
      result.connections,
      hideConnectedLegs
    );
  };

  const handleHopfRule = async () => {
    const result = await applyHopfRule(
      tensorNetwork!.legos,
      droppedLegos,
      connections
    );
    setDroppedLegos(result.droppedLegos);
    setConnections(result.connections);
    operationHistory.addOperation(result.operation);
    encodeCanvasState(
      result.droppedLegos,
      result.connections,
      hideConnectedLegs
    );
  };

  const handleConnectGraphNodes = async () => {
    const result = await applyConnectGraphNodes(
      tensorNetwork!.legos,
      droppedLegos,
      connections
    );
    setDroppedLegos(result.droppedLegos);
    setConnections(result.connections);
    operationHistory.addOperation(result.operation);
    encodeCanvasState(
      result.droppedLegos,
      result.connections,
      hideConnectedLegs
    );

    const newTensorNetwork = findConnectedComponent(
      result.operation.data.legosToAdd![0],
      droppedLegos,
      connections
    );
    setTensorNetwork(newTensorNetwork);
  };

  const handleCompleteGraphViaHadamards = async () => {
    const result = await applyCompleteGraphViaHadamards(
      tensorNetwork!.legos,
      droppedLegos,
      connections
    );
    setDroppedLegos(result.droppedLegos);
    setConnections(result.connections);
    operationHistory.addOperation(result.operation);
    encodeCanvasState(
      result.droppedLegos,
      result.connections,
      hideConnectedLegs
    );
  };

  const handleLegPartitionDialogClose = () => {
    // Call cleanup to restore original state
    const windowWithRestore = window as Window & {
      __restoreLegsState?: () => void;
    };
    windowWithRestore.__restoreLegsState?.();
    delete windowWithRestore.__restoreLegsState;
    setShowLegPartitionDialog(false);
  };

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
      if (taskUpdatesChannel) {
        console.log("Unsubscribing from task updates");
        await taskUpdatesChannel.unsubscribe();
        console.log("Task updates unsubscribed");
      }
      setTaskUpdatesChannel(null);
      setIterationStatus([]);
      setWaitingForTaskUpdate(false);
      setTask((prev) => (prev ? { ...prev, state: 4 } : null));
    } catch (err) {
      const error = err as AxiosError<{
        message: string;
        error: string;
        status: number;
      }>;
      console.error("Error cancelling task:", error);
      setError(
        `Failed to cancel task: Status: ${error.response?.status} ${error.response?.data.error} `
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

  const { externalLegs, danglingLegs } = getExternalAndDanglingLegs();

  return (
    <Box
      h="100%"
      borderLeft="1px"
      borderColor={borderColor}
      bg={bgColor}
      overflowY="auto"
    >
      <VStack align="stretch" spacing={4} p={4}>
        {tensorNetwork ? (
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
                      onClick={handleBialgebra}
                    >
                      Bialgebra
                    </Button>
                  )}
                  {canDoInverseBialgebra(tensorNetwork.legos, connections) && (
                    <Button
                      leftIcon={<Icon as={FaCube} />}
                      colorScheme="blue"
                      size="sm"
                      onClick={handleInverseBialgebra}
                    >
                      Inverse bialgebra
                    </Button>
                  )}
                  {canDoHopfRule(tensorNetwork.legos, connections) && (
                    <Button
                      leftIcon={<Icon as={FaCube} />}
                      colorScheme="blue"
                      size="sm"
                      onClick={handleHopfRule}
                    >
                      Hopf rule
                    </Button>
                  )}
                  {canDoConnectGraphNodes(tensorNetwork.legos) && (
                    <Button
                      leftIcon={<Icon as={FaCube} />}
                      colorScheme="blue"
                      size="sm"
                      onClick={handleConnectGraphNodes}
                    >
                      Connect Graph Nodes with center lego
                    </Button>
                  )}
                  {canDoCompleteGraphViaHadamards(tensorNetwork.legos) && (
                    <Button
                      leftIcon={<Icon as={FaCube} />}
                      colorScheme="blue"
                      size="sm"
                      onClick={handleCompleteGraphViaHadamards}
                    >
                      Complete Graph Via Hadamards
                    </Button>
                  )}
                </VStack>
                <Heading size="md">Network Details</Heading>
                <VStack align="stretch" spacing={3}>
                  {!tensorNetwork.parityCheckMatrix &&
                    !parityCheckMatrixCache.get(tensorNetwork.signature!) && (
                      <Button
                        onClick={calculateParityCheckMatrix}
                        colorScheme="blue"
                        size="sm"
                        width="full"
                        leftIcon={<Icon as={FaTable} />}
                      >
                        Calculate Parity Check Matrix
                      </Button>
                    )}
                  {!tensorNetwork.weightEnumerator &&
                    !weightEnumeratorCache.get(tensorNetwork.signature!) &&
                    !tensorNetwork.isCalculatingWeightEnumerator && (
                      <Button
                        onClick={() =>
                          setShowWeightEnumeratorCalculationDialog(true)
                        }
                        colorScheme="teal"
                        size="sm"
                        width="full"
                        leftIcon={<Icon as={FaCube} />}
                        disabled={!user}
                      >
                        Calculate Weight Enumerator
                      </Button>
                    )}
                  <Button
                    onClick={handleGenerateConstructionCode}
                    colorScheme="purple"
                    size="sm"
                    width="full"
                    leftIcon={<Icon as={FaCode} />}
                  >
                    Python Code
                  </Button>
                </VStack>
                {(tensorNetwork.parityCheckMatrix ||
                  (tensorNetwork &&
                    parityCheckMatrixCache.get(tensorNetwork.signature!))) && (
                  <ParityCheckMatrixDisplay
                    matrix={
                      tensorNetwork.parityCheckMatrix ||
                      parityCheckMatrixCache
                        .get(tensorNetwork.signature!)!
                        .h.getMatrix()
                    }
                    title="Parity Check Matrix"
                    legOrdering={
                      tensorNetwork.legOrdering ||
                      parityCheckMatrixCache.get(tensorNetwork.signature!)!.legs
                    }
                    onMatrixChange={(newMatrix) => {
                      // Update the tensor network state
                      setTensorNetwork((prev: TensorNetwork | null) =>
                        prev
                          ? TensorNetwork.fromObj({
                              ...prev,
                              parityCheckMatrix: newMatrix
                            })
                          : null
                      );

                      // Update the cache
                      const signature = tensorNetwork.signature!;
                      const cachedResponse =
                        parityCheckMatrixCache.get(signature);
                      if (cachedResponse) {
                        parityCheckMatrixCache.set(
                          signature,
                          new StabilizerCodeTensor(
                            new GF2(newMatrix),
                            cachedResponse.idx,
                            cachedResponse.legs
                          )
                        );
                      }
                    }}
                    onLegOrderingChange={handleLegOrderingChange}
                    onRecalculate={calculateParityCheckMatrix}
                  />
                )}
                {tensorNetwork.isCalculatingWeightEnumerator ||
                (tensorNetwork.signature &&
                  weightEnumeratorCache.get(tensorNetwork.signature)
                    ?.polynomial === "") ? (
                  <TaskDetailsDisplay
                    task={task}
                    taskId={
                      tensorNetwork.taskId ||
                      weightEnumeratorCache.get(tensorNetwork.signature!)
                        ?.taskId
                    }
                    iterationStatus={iterationStatus}
                    waitingForTaskUpdate={waitingForTaskUpdate}
                    taskUpdatesChannel={taskUpdatesChannel}
                    onCancelTask={handleCancelTask}
                    onViewLogs={fetchTaskLogs}
                  />
                ) : null}
                {tensorNetwork.constructionCode && (
                  <VStack align="stretch" spacing={2}>
                    <HStack justify="space-between">
                      <Heading size="sm">Construction Code</Heading>
                      <IconButton
                        aria-label="Copy code"
                        icon={<Icon as={FaCopy} />}
                        size="sm"
                        onClick={onCopyCode}
                        variant="ghost"
                      />
                    </HStack>
                    <Box
                      p={3}
                      borderWidth={1}
                      borderRadius="md"
                      bg="gray.50"
                      position="relative"
                      fontFamily="mono"
                      whiteSpace="pre"
                      overflowX="auto"
                    >
                      <Text>{tensorNetwork.constructionCode}</Text>
                      {hasCopiedCode && (
                        <Box
                          position="absolute"
                          top={2}
                          right={2}
                          px={2}
                          py={1}
                          bg="green.500"
                          color="white"
                          borderRadius="md"
                          fontSize="sm"
                        >
                          Copied!
                        </Box>
                      )}
                    </Box>
                  </VStack>
                )}
              </VStack>
            </Box>
          </>
        ) : selectedLego ? (
          <>
            <Heading size="md">Lego Instance Details</Heading>
            <VStack align="stretch" spacing={3}>
              <Text fontWeight="bold">
                {selectedLego.name || selectedLego.shortName}
              </Text>
              <Text fontSize="sm" color="gray.600">
                {selectedLego.description}, instaceId: {selectedLego.instanceId}
                , x: {selectedLego.x}, y: {selectedLego.y}
              </Text>
              <Box>
                <Text fontSize="sm" mb={1}>
                  Short Name:
                </Text>
                <Input
                  size="sm"
                  value={selectedLego.shortName}
                  onChange={(e) => {
                    const newShortName = e.target.value;
                    const updatedLego = {
                      ...selectedLego,
                      shortName: newShortName
                    };
                    setSelectedLego(updatedLego);
                    setDroppedLegos(
                      droppedLegos.map((l) =>
                        l.instanceId === selectedLego.instanceId
                          ? updatedLego
                          : l
                      )
                    );
                  }}
                  onKeyDown={(e) => {
                    e.stopPropagation();
                  }}
                />
              </Box>
              <Box>
                <Checkbox
                  isChecked={selectedLego.alwaysShowLegs || false}
                  onChange={(e) => {
                    const updatedLego = {
                      ...selectedLego,
                      alwaysShowLegs: e.target.checked
                    };
                    setSelectedLego(updatedLego);
                    setDroppedLegos(
                      droppedLegos.map((l) =>
                        l.instanceId === selectedLego.instanceId
                          ? updatedLego
                          : l
                      )
                    );
                    encodeCanvasState(
                      droppedLegos.map((l) =>
                        l.instanceId === selectedLego.instanceId
                          ? updatedLego
                          : l
                      ),
                      connections,
                      hideConnectedLegs
                    );
                  }}
                >
                  Always show legs
                </Checkbox>
              </Box>
              {(selectedLego.id === "x_rep_code" ||
                selectedLego.id === "z_rep_code") && (
                <>
                  <Button
                    leftIcon={<Icon as={FaCube} />}
                    colorScheme="blue"
                    size="sm"
                    onClick={() => handleUnfuseToLegs(selectedLego)}
                  >
                    Unfuse to legs
                  </Button>

                  <Button
                    leftIcon={<Icon as={FaCube} />}
                    colorScheme="blue"
                    size="sm"
                    onClick={() => handleUnfuseInto2Legos(selectedLego)}
                  >
                    Unfuse into 2 legos
                  </Button>

                  <Button
                    leftIcon={<Icon as={FaCube} />}
                    colorScheme="blue"
                    size="sm"
                    onClick={() => handleChangeColor(selectedLego)}
                  >
                    Change color
                  </Button>

                  <Button
                    leftIcon={<Icon as={FaCube} />}
                    colorScheme="blue"
                    size="sm"
                    onClick={() => handlePullOutSameColoredLeg(selectedLego)}
                  >
                    Pull out a leg of same color (p)
                  </Button>
                </>
              )}

              <ParityCheckMatrixDisplay
                matrix={selectedLego.parity_check_matrix}
                lego={selectedLego}
                selectedRows={selectedLego.selectedMatrixRows || []}
                onRowSelectionChange={handleMatrixRowSelection}
              />
            </VStack>
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
      </VStack>
      <LegPartitionDialog
        open={showLegPartitionDialog}
        onClose={() => {
          setShowLegPartitionDialog(false);
          handleLegPartitionDialogClose();
        }}
        onSubmit={(legPartition: number[]) => {
          setShowLegPartitionDialog(false);
          handleLegPartitionDialogClose();
          handleUnfuseTo2LegosPartitionConfirm(
            legPartition,
            _.cloneDeep(connections)
          );
        }}
        numLegs={unfuseLego ? unfuseLego.parity_check_matrix[0].length / 2 : 0}
      />
      <WeightEnumeratorCalculationDialog
        open={showWeightEnumeratorCalculationDialog}
        onClose={() => setShowWeightEnumeratorCalculationDialog(false)}
        externalLegs={externalLegs}
        danglingLegs={danglingLegs}
        onSubmit={(truncateLength, openLegs) => {
          setShowWeightEnumeratorCalculationDialog(false);
          calculateWeightEnumerator(truncateLength, openLegs);
        }}
      />
      <TaskLogsModal
        isOpen={isLogsModalOpen}
        onClose={onLogsModalClose}
        isLoading={isLoadingLogs}
        logs={taskLogs}
      />
    </Box>
  );
};

export default DetailsPanel;
