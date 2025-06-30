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
  UseToastOptions,
  useDisclosure
} from "@chakra-ui/react";
import { FaTable, FaCube } from "react-icons/fa";
import {
  Connection,
  TaskUpdate,
  TaskUpdateIterationStatus,
  Task,
  ParityCheckMatrix
} from "../lib/types.ts";
import { TensorNetwork, TensorNetworkLeg } from "../lib/TensorNetwork.ts";
import { DroppedLego } from "../stores/droppedLegoStore.ts";
import { Operation } from "../lib/OperationHistory.ts";

import { ParityCheckMatrixDisplay } from "./ParityCheckMatrixDisplay.tsx";
import axios, { AxiosError } from "axios";
import { useState, memo, useCallback, useMemo } from "react";
import { LegPartitionDialog } from "./LegPartitionDialog.tsx";
import * as _ from "lodash";
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
import { config, getApiUrl } from "../config.ts";
import { getAccessToken } from "../lib/auth.ts";
import { useEffect } from "react";
import TaskDetailsDisplay from "./TaskDetailsDisplay.tsx";
import TaskLogsModal from "./TaskLogsModal.tsx";
import { getAxiosErrorMessage } from "../lib/errors.ts";
import { useTensorNetworkStore } from "../stores/tensorNetworkStore.ts";
import { useCanvasStore } from "../stores/canvasStateStore.ts";

interface DetailsPanelProps {
  setError: (error: string) => void;
  fuseLegos: (legos: DroppedLego[]) => void;

  makeSpace: (
    center: { x: number; y: number },
    radius: number,
    skipLegos: DroppedLego[],
    legosToCheck: DroppedLego[]
  ) => DroppedLego[];
  handlePullOutSameColoredLeg: (lego: DroppedLego) => Promise<void>;
  toast: (props: UseToastOptions) => void;
  user?: User | null;
  parityCheckMatrixCache: Map<string, ParityCheckMatrix>;
  setParityCheckMatrixCache: React.Dispatch<
    React.SetStateAction<Map<string, ParityCheckMatrix>>
  >;
  weightEnumeratorCache: Map<
    string,
    {
      taskId: string;
      polynomial: string;
      normalizerPolynomial: string;
      truncateLength: number | null;
    }
  >;
  setWeightEnumeratorCache: React.Dispatch<
    React.SetStateAction<
      Map<
        string,
        {
          taskId: string;
          polynomial: string;
          normalizerPolynomial: string;
          truncateLength: number | null;
        }
      >
    >
  >;
}

const DetailsPanel: React.FC<DetailsPanelProps> = ({
  setError,
  fuseLegos,
  makeSpace,
  handlePullOutSameColoredLeg,
  user,
  parityCheckMatrixCache,
  setParityCheckMatrixCache,
  weightEnumeratorCache
}) => {
  const {
    connections,
    droppedLegos,
    setDroppedLegos,
    setLegosAndConnections,
    updateDroppedLego,
    addOperation
  } = useCanvasStore();
  const { tensorNetwork, setTensorNetwork } = useTensorNetworkStore();
  const bgColor = useColorModeValue("white", "gray.800");
  const borderColor = useColorModeValue("gray.200", "gray.600");
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
      const network = new TensorNetwork({
        legos: tensorNetwork.legos,
        connections: tensorNetwork.connections
      });
      const result = network.conjoin_nodes();

      if (!result) {
        throw new Error("Cannot compute tensor network parity check matrix");
      }

      const legOrdering = result.legs.map((leg) => ({
        instanceId: leg.instanceId,
        legIndex: leg.legIndex
      }));

      // Update the tensor network with the new matrix and leg ordering
      setTensorNetwork(
        tensorNetwork.with({
          parityCheckMatrix: result.h.getMatrix(),
          legOrdering: legOrdering
        })
      );
      console.log("legordergin", legOrdering);

      setParityCheckMatrixCache((prev) => {
        const newCache = new Map(prev);
        newCache.set(tensorNetwork.signature!, {
          matrix: result.h.getMatrix(),
          legOrdering: legOrdering
        });
        return newCache;
      });
    } catch (error) {
      console.error("Error calculating parity check matrix:", error);
      setError("Failed to calculate parity check matrix");
    }
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

  const handleMatrixRowSelection = useCallback(
    (selectedRows: number[]) => {
      setSelectedMatrixRows(selectedRows);
      if (tensorNetwork?.legos.length == 1) {
        const lego = tensorNetwork.legos[0];
        const updatedLego = new DroppedLego(
          lego,
          lego.x,
          lego.y,
          lego.instanceId,
          { selectedMatrixRows: selectedRows }
        );

        updateDroppedLego(updatedLego.instanceId, updatedLego);

        setTensorNetwork(
          new TensorNetwork({ legos: [updatedLego], connections: connections })
        );

        simpleAutoFlow(
          updatedLego,
          droppedLegos,
          connections,
          setDroppedLegos,
          setTensorNetwork
        );
      }
    },
    [
      tensorNetwork,
      droppedLegos,
      connections,
      setDroppedLegos,
      setTensorNetwork
    ]
  );

  const handleLegOrderingChange = useCallback(
    (newLegOrdering: TensorNetworkLeg[]) => {
      if (tensorNetwork) {
        // Update the tensor network state
        setTensorNetwork((prev: TensorNetwork | null) =>
          prev ? prev.with({ legOrdering: newLegOrdering }) : null
        );

        // Note: We don't update the cache here since we only store the matrix,
        // not the leg ordering. The leg ordering is stored in the tensor network.
      }
    },
    [tensorNetwork, setTensorNetwork]
  );

  // Memoized callbacks for ParityCheckMatrixDisplay
  const handleMultiLegoMatrixChange = useCallback(
    (newMatrix: number[][]) => {
      if (!tensorNetwork) return;

      // Update the tensor network state
      setTensorNetwork((prev: TensorNetwork | null) =>
        prev ? prev.with({ parityCheckMatrix: newMatrix }) : null
      );

      // Update the cache
      const signature = tensorNetwork.signature!;
      setParityCheckMatrixCache((prev) => {
        const newCache = new Map(prev);
        newCache.set(signature, {
          matrix: newMatrix,
          legOrdering: tensorNetwork.legOrdering || []
        });
        return newCache;
      });
    },
    [tensorNetwork, setTensorNetwork, setParityCheckMatrixCache]
  );

  // Memoized leg ordering for single lego
  const singleLegoLegOrdering = useMemo(() => {
    if (!tensorNetwork || tensorNetwork.legos.length !== 1) return [];

    return Array.from(
      {
        length: tensorNetwork.legos[0].parity_check_matrix[0].length / 2
      },
      (_, i) => ({
        instanceId: tensorNetwork.legos[0].instanceId,
        legIndex: i
      })
    );
  }, [
    tensorNetwork?.legos?.[0]?.instanceId,
    tensorNetwork?.legos?.[0]?.parity_check_matrix?.length
  ]);

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
      new DroppedLego(
        {
          ...lego,
          id: lego.id === "x_rep_code" ? "z_rep_code" : "x_rep_code",
          shortName: lego.id === "x_rep_code" ? "Z Rep Code" : "X Rep Code",
          parity_check_matrix: newParityCheckMatrix
        },
        lego.x,
        lego.y,
        lego.instanceId
      )
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
      const hadamardLego: DroppedLego = new DroppedLego(
        {
          id: "h",
          name: "Hadamard",
          shortName: "H",
          description: "Hadamard",
          parity_check_matrix: [
            [1, 0, 0, 1],
            [0, 1, 1, 0]
          ],
          logical_legs: [],
          gauge_legs: []
        },
        lego.x + radius * Math.cos(angle),
        lego.y + radius * Math.sin(angle),
        (maxInstanceId + 1 + i).toString()
      );
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
    setLegosAndConnections(finalLegos, updatedConnections);

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
    addOperation(operation);
  };

  const handleUnfuseInto2Legos = (lego: DroppedLego) => {
    // Store the original state
    const originalAlwaysShowLegs = lego.alwaysShowLegs;

    // Temporarily force legs to be shown
    const updatedLego = lego.with({ alwaysShowLegs: true });
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
            ? l.with({ alwaysShowLegs: originalAlwaysShowLegs })
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
      const lego1: DroppedLego = new DroppedLego(
        {
          ...lego,
          parity_check_matrix: lego1Data.parity_check_matrix
        },
        lego.x - 50, // Position slightly to the left
        lego.y,

        (maxInstanceId + 1).toString(),
        { alwaysShowLegs: false }
      );

      const lego2: DroppedLego = new DroppedLego(
        {
          ...lego,
          parity_check_matrix: lego2Data.parity_check_matrix
        },
        lego.x + 50, // Position slightly to the right
        lego.y,
        (maxInstanceId + 2).toString(),
        { alwaysShowLegs: false }
      );

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

      setLegosAndConnections(newLegos, updatedConnections);

      // Add to operation history
      addOperation({
        type: "unfuseInto2Legos",
        data: {
          legosToRemove: [lego],
          connectionsToRemove: connectionsInvolvingLego,
          legosToAdd: [lego1, lego2],
          connectionsToAdd: [...newConnections, connectionBetweenLegos]
        }
      });
    } catch (error) {
      setError(`Error unfusing lego: ${error}`);
    }

    setShowLegPartitionDialog(false);
    setUnfuseLego(null);
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
      const newLego: DroppedLego = lego.with({
        instanceId: (maxInstanceId + 1).toString(),
        x: lego.x + 100,
        y: lego.y,
        selectedMatrixRows: [],
        parity_check_matrix: bell_pair
      });
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
      const newLego: DroppedLego = lego.with({
        instanceId: (maxInstanceId + 1).toString(),
        x: lego.x + 100,
        y: lego.y,
        selectedMatrixRows: [],
        parity_check_matrix: bell_pair
      });
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
        const newLego: DroppedLego = lego.with({
          instanceId: (maxInstanceId + 1 + i).toString(),
          x: centerX + radius * Math.cos(angle),
          y: centerY + radius * Math.sin(angle),
          selectedMatrixRows: [],
          parity_check_matrix: isXCode ? d3_x_rep : d3_z_rep
        });
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
    setLegosAndConnections(updatedLegos, updatedConnections);

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
    addOperation(operation);
  };

  const handleBialgebra = async () => {
    const result = await applyBialgebra(
      tensorNetwork!.legos,
      droppedLegos,
      connections
    );
    setLegosAndConnections(result.droppedLegos, result.connections);
    addOperation(result.operation);
  };

  const handleInverseBialgebra = async () => {
    const result = await applyInverseBialgebra(
      tensorNetwork!.legos,
      droppedLegos,
      connections
    );
    setLegosAndConnections(result.droppedLegos, result.connections);
    addOperation(result.operation);
  };

  const handleHopfRule = async () => {
    const result = await applyHopfRule(
      tensorNetwork!.legos,
      droppedLegos,
      connections
    );
    setLegosAndConnections(result.droppedLegos, result.connections);
    addOperation(result.operation);
  };

  const handleConnectGraphNodes = async () => {
    const result = await applyConnectGraphNodes(
      tensorNetwork!.legos,
      droppedLegos,
      connections
    );
    setLegosAndConnections(result.droppedLegos, result.connections);
    addOperation(result.operation);

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
    setLegosAndConnections(result.droppedLegos, result.connections);
    addOperation(result.operation);
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

  return (
    <Box
      h="100%"
      borderLeft="1px"
      borderColor={borderColor}
      bg={bgColor}
      overflowY="auto"
    >
      <VStack align="stretch" spacing={4} p={4}>
        {tensorNetwork && tensorNetwork.legos.length == 1 ? (
          <>
            <Heading size="md">Lego Instance Details</Heading>
            <VStack align="stretch" spacing={3}>
              <Text fontWeight="bold">
                {tensorNetwork.legos[0].name ||
                  tensorNetwork.legos[0].shortName}
              </Text>
              <Text fontSize="sm" color="gray.600">
                {tensorNetwork.legos[0].description}, instaceId:{" "}
                {tensorNetwork.legos[0].instanceId}, x:{" "}
                {tensorNetwork.legos[0].x}, y: {tensorNetwork.legos[0].y}
              </Text>
              <Box>
                <Text fontSize="sm" mb={1}>
                  Short Name:
                </Text>
                <Input
                  size="sm"
                  value={tensorNetwork.legos[0].shortName}
                  onChange={(e) => {
                    const newShortName = e.target.value;
                    const updatedLego = tensorNetwork.legos[0].with({
                      shortName: newShortName
                    });
                    const updatedDroppedLegos = droppedLegos.map((l) =>
                      l.instanceId === tensorNetwork.legos[0].instanceId
                        ? updatedLego
                        : l
                    );
                    setDroppedLegos(updatedDroppedLegos);
                    setDroppedLegos(
                      droppedLegos.map((l) =>
                        l.instanceId === tensorNetwork.legos[0].instanceId
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
                  isChecked={tensorNetwork.legos[0].alwaysShowLegs || false}
                  onChange={(e) => {
                    const updatedLego = {
                      ...tensorNetwork.legos[0],
                      alwaysShowLegs: e.target.checked
                    };
                    updateDroppedLego(updatedLego.instanceId, updatedLego);
                  }}
                >
                  Always show legs
                </Checkbox>
              </Box>
              {(tensorNetwork.legos[0].id === "x_rep_code" ||
                tensorNetwork.legos[0].id === "z_rep_code") && (
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
              <ParityCheckMatrixDisplay
                matrix={tensorNetwork.legos[0].parity_check_matrix}
                legOrdering={singleLegoLegOrdering}
                selectedRows={tensorNetwork.legos[0].selectedMatrixRows || []}
                onRowSelectionChange={handleMatrixRowSelection}
              />
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
                  {(tensorNetwork.parityCheckMatrix ||
                    (tensorNetwork &&
                      parityCheckMatrixCache.get(
                        tensorNetwork.signature!
                      ))) && (
                    <ParityCheckMatrixDisplay
                      matrix={
                        tensorNetwork.parityCheckMatrix ||
                        parityCheckMatrixCache.get(tensorNetwork.signature!)!
                          .matrix
                      }
                      title="Pauli stabilizers"
                      legOrdering={
                        tensorNetwork.legOrdering ||
                        parityCheckMatrixCache.get(tensorNetwork.signature!)!
                          .legOrdering
                      }
                      onMatrixChange={handleMultiLegoMatrixChange}
                      onLegOrderingChange={handleLegOrderingChange}
                      onRecalculate={calculateParityCheckMatrix}
                    />
                  )}
                  {tensorNetwork.signature &&
                  weightEnumeratorCache.get(tensorNetwork.signature) ? (
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
      </VStack>
      {showLegPartitionDialog && (
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
          numLegs={
            unfuseLego ? unfuseLego.parity_check_matrix[0].length / 2 : 0
          }
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

export default memo(DetailsPanel);
