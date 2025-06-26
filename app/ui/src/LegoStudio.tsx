import {
  Box,
  Button,
  Editable,
  EditableInput,
  EditablePreview,
  Icon,
  Menu,
  MenuButton,
  MenuItem,
  MenuItemOption,
  MenuList,
  useColorModeValue,
  useToast,
  Text,
  VStack,
  MenuDivider,
  HStack
} from "@chakra-ui/react";
import { useCallback, useEffect, useRef, useState, memo, useMemo } from "react";
import {
  Panel,
  PanelGroup,
  ImperativePanelHandle
} from "react-resizable-panels";

import { getLegoStyle } from "./LegoStyles";
import ErrorPanel from "./components/ErrorPanel";
import BuildingBlocksPanel from "./components/BuildingBlocksPanel.tsx";
import { KeyboardHandler } from "./components/KeyboardHandler";
import { ConnectionsLayer } from "./components/ConnectionsLayer";
import { LegosLayer } from "./components/LegosLayer";
import {
  SelectionManager,
  SelectionManagerRef
} from "./components/SelectionManager";
import { useLegoStore } from "./stores/legoStore";
import {
  CanvasDragState,
  Connection,
  DragState,
  DroppedLego,
  GroupDragState,
  LegDragState,
  LegoPiece,
  ParityCheckMatrix,
  PauliOperator,
  SelectionBoxState
} from "./lib/types";
import { TensorNetwork } from "./lib/TensorNetwork";

import DetailsPanel from "./components/DetailsPanel";
import { ResizeHandle } from "./components/ResizeHandle";
import { CanvasStateSerializer } from "./lib/CanvasStateSerializer";
import { calculateLegPosition } from "./components/DroppedLegoDisplay";
import { DynamicLegoDialog } from "./components/DynamicLegoDialog";
import { OperationHistory } from "./lib/OperationHistory";
import { FuseLegos } from "./transformations/FuseLegos";
import { InjectTwoLegged } from "./transformations/InjectTwoLegged";
import { AddStopper } from "./transformations/AddStopper";
import { findConnectedComponent } from "./lib/TensorNetwork";
import { randomPlankterName } from "./lib/RandomPlankterNames";
import { useLocation, useNavigate } from "react-router-dom";
import { UserMenu } from "./components/UserMenu";

import { userContextSupabase } from "./supabaseClient";
import { User } from "@supabase/supabase-js";
import { simpleAutoFlow } from "./transformations/AutoPauliFlow";
import { Legos } from "./lib/Legos";
import { TbPlugConnected } from "react-icons/tb";
import { checkSupabaseStatus } from "./lib/errors.ts";
import { FiMoreVertical } from "react-icons/fi";
// import WeightEnumeratorCalculationDialog from "./components/WeightEnumeratorCalculationDialog";

import FloatingTaskPanel from "./components/FloatingTaskPanel";

import PythonCodeModal from "./components/PythonCodeModal.tsx";
import { useConnectionStore } from "./stores/connectionStore.ts";
import { useModalStore } from "./stores/modalStore";
import { RuntimeConfigService } from "./lib/runtimeConfigService";
import { ModalRoot } from "./components/ModalRoot";
// import PythonCodeModal from "./components/PythonCodeModal";

// Add these helper functions near the top of the file
const pointToLineDistance = (
  x: number,
  y: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number
) => {
  const A = x - x1;
  const B = y - y1;
  const C = x2 - x1;
  const D = y2 - y1;

  const dot = A * C + B * D;
  const len_sq = C * C + D * D;
  let param = -1;
  if (len_sq !== 0) {
    param = dot / len_sq;
  }

  let xx, yy;

  if (param < 0) {
    xx = x1;
    yy = y1;
  } else if (param > 1) {
    xx = x2;
    yy = y2;
  } else {
    xx = x1 + param * C;
    yy = y1 + param * D;
  }

  const dx = x - xx;
  const dy = y - yy;
  return Math.sqrt(dx * dx + dy * dy);
};

// Add this before the App component
function findClosestDanglingLeg(
  dropPosition: { x: number; y: number },
  droppedLegos: DroppedLego[],
  connections: Connection[]
): { lego: DroppedLego; legIndex: number } | null {
  let closestLego: DroppedLego | null = null;
  let closestLegIndex: number = -1;
  let minDistance = Infinity;

  droppedLegos.forEach((lego) => {
    const totalLegs = lego.parity_check_matrix[0].length / 2;
    for (let legIndex = 0; legIndex < totalLegs; legIndex++) {
      // Skip if leg is already connected
      const isConnected = connections.some(
        (conn) =>
          (conn.from.legoId === lego.instanceId &&
            conn.from.legIndex === legIndex) ||
          (conn.to.legoId === lego.instanceId && conn.to.legIndex === legIndex)
      );
      if (isConnected) continue;

      const pos = calculateLegPosition(lego, legIndex);
      const legX = lego.x + pos.endX;
      const legY = lego.y + pos.endY;
      const distance = Math.sqrt(
        Math.pow(dropPosition.x - legX, 2) + Math.pow(dropPosition.y - legY, 2)
      );

      if (distance < minDistance && distance < 20) {
        // 20 pixels threshold
        minDistance = distance;
        closestLego = lego;
        closestLegIndex = legIndex;
      }
    }
  });

  return closestLego && closestLegIndex !== -1
    ? { lego: closestLego, legIndex: closestLegIndex }
    : null;
}

// Memoized Left Panel Component
const LeftPanel = memo<{
  leftPanelRef: React.RefObject<ImperativePanelHandle>;
  legoPanelSizes: { defaultSize: number; minSize: number };
  isLegoPanelCollapsed: boolean;
  setIsLegoPanelCollapsed: (collapsed: boolean) => void;
  handleDragStart: (e: React.DragEvent<HTMLElement>, lego: LegoPiece) => void;
  isUserLoggedIn: boolean;
}>(
  ({
    leftPanelRef,
    legoPanelSizes,
    isLegoPanelCollapsed,
    setIsLegoPanelCollapsed,
    handleDragStart,
    isUserLoggedIn
  }) => {
    return (
      <Panel
        ref={leftPanelRef as React.RefObject<ImperativePanelHandle>}
        id="lego-panel"
        defaultSize={legoPanelSizes.defaultSize}
        minSize={legoPanelSizes.minSize}
        maxSize={legoPanelSizes.defaultSize}
        order={1}
        collapsible={true}
        onCollapse={() => setIsLegoPanelCollapsed(true)}
        onExpand={() => setIsLegoPanelCollapsed(false)}
      >
        {!isLegoPanelCollapsed && (
          <BuildingBlocksPanel
            onDragStart={handleDragStart}
            isUserLoggedIn={isUserLoggedIn}
          />
        )}
      </Panel>
    );
  }
);

LeftPanel.displayName = "LeftPanel";

const LegoStudioView: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [currentTitle, setCurrentTitle] = useState<string>("");
  const [fatalError, setFatalError] = useState<Error | null>(null);

  const [altKeyPressed, setAltKeyPressed] = useState(false);
  // const [message, setMessage] = useState<string>("Loading...");
  const {
    droppedLegos,
    setDroppedLegos,
    addDroppedLego,
    addDroppedLegos,
    // removeDroppedLego,
    // updateDroppedLego,
    // updateDroppedLegos,
    clearDroppedLegos
  } = useLegoStore();
  const { connections, setConnections, addConnections, removeConnections } =
    useConnectionStore();
  const [error, setError] = useState<string>("");
  const [legDragState, setLegDragState] = useState<LegDragState | null>(null);
  const [canvasDragState, setCanvasDragState] = useState<CanvasDragState>({
    isDragging: false,
    startX: 0,
    startY: 0,
    currentX: 0,
    currentY: 0
  });
  const [dragState, setDragState] = useState<DragState>({
    isDragging: false,
    draggedLegoIndex: -1,
    startX: 0,
    startY: 0,
    originalX: 0,
    originalY: 0,
    justFinished: false
  });
  const [zoomLevel, setZoomLevel] = useState(1);
  const canvasRef = useRef<HTMLDivElement>(null);
  const selectionManagerRef = useRef<SelectionManagerRef>(null);
  const stateSerializerRef = useRef<CanvasStateSerializer>(
    new CanvasStateSerializer()
  );
  const [tensorNetwork, setTensorNetwork] = useState<TensorNetwork | null>(
    null
  );
  const [operationHistory] = useState<OperationHistory>(
    new OperationHistory([])
  );

  const [groupDragState, setGroupDragState] = useState<GroupDragState | null>(
    null
  );
  const [selectionBox, setSelectionBox] = useState<SelectionBoxState>({
    isSelecting: false,
    startX: 0,
    startY: 0,
    currentX: 0,
    currentY: 0,
    justFinished: false
  });
  const [canvasId, setCanvasId] = useState<string>("");
  const [parityCheckMatrixCache, setParityCheckMatrixCache] = useState<
    Map<string, ParityCheckMatrix>
  >(new Map());
  const [weightEnumeratorCache, setWeightEnumeratorCache] = useState<
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
  const [isDynamicLegoDialogOpen, setIsDynamicLegoDialogOpen] = useState(false);
  const [selectedDynamicLego, setSelectedDynamicLego] =
    useState<LegoPiece | null>(null);
  const [pendingDropPosition, setPendingDropPosition] = useState<{
    x: number;
    y: number;
  } | null>(null);
  // Use modal store for network dialogs
  const {
    openCustomLegoDialog,
    openLoadingModal,
    closeLoadingModal,
    openAuthDialog,
    openRuntimeConfigDialog,
    openWeightEnumeratorDialog
  } = useModalStore();

  const handleSetLegoPanelCollapsed = useCallback((collapsed: boolean) => {
    setIsLegoPanelCollapsed(collapsed);
  }, []);

  const [hideConnectedLegs, setHideConnectedLegs] = useState(true);
  const [isLegoPanelCollapsed, setIsLegoPanelCollapsed] = useState(false);
  const [hoveredConnection, setHoveredConnection] = useState<Connection | null>(
    null
  );
  const [draggedLego, setDraggedLego] = useState<LegoPiece | null>(null);

  const panelGroupContainerRef = useRef<HTMLDivElement>(null);
  const leftPanelRef = useRef<ImperativePanelHandle>(null);
  const [legoPanelSizes, setLegoPanelSizes] = useState({
    defaultSize: 15,
    minSize: 8
  });
  const [isTaskPanelCollapsed, setIsTaskPanelCollapsed] = useState(true);

  const [currentUser, setCurrentUser] = useState<User | null>(null);

  // Memoize isUserLoggedIn to prevent BuildingBlocksPanel re-renders
  const isUserLoggedIn = useMemo(() => !!currentUser, [currentUser]);

  const [supabaseStatus, setSupabaseStatus] = useState<{
    isHealthy: boolean;
    message: string;
  } | null>(null);

  const [showPythonCodeModal, setShowPythonCodeModal] = useState(false);
  const [pythonCode, setPythonCode] = useState("");

  // Inside the App component, add this line near the other hooks
  const toast = useToast();

  // Add title effect at the top
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    let title = params.get("title");

    if (!title) {
      // Generate a new random title if none exists
      title = `PlanqTN - ${randomPlankterName()}`;
      // Update URL with the new title
      const newParams = new URLSearchParams(params);
      newParams.set("title", title);
      navigate(`${location.pathname}?${newParams.toString()}${location.hash}`, {
        replace: true
      });
    }

    document.title = title;
    setCurrentTitle(title);
  }, [location, navigate]);

  const handleTitleChange = (newTitle: string) => {
    if (newTitle.trim()) {
      const params = new URLSearchParams(location.search);
      params.set("title", newTitle);
      navigate(`${location.pathname}?${params.toString()}${location.hash}`, {
        replace: true
      });
      document.title = newTitle;
      setCurrentTitle(newTitle);
    }
  };

  // Use a ref to track max instance ID instead of recalculating from droppedLegos
  const maxInstanceIdRef = useRef(0);

  // Update max instance ID when droppedLegos changes
  useEffect(() => {
    if (droppedLegos.length > 0) {
      const currentMax = Math.max(
        ...droppedLegos.map((lego) => parseInt(lego.instanceId))
      );
      maxInstanceIdRef.current = Math.max(maxInstanceIdRef.current, currentMax);
    }
  }, [droppedLegos.length]); // Only depend on length, not content

  const newInstanceId = useCallback((): string => {
    maxInstanceIdRef.current += 1;
    return String(maxInstanceIdRef.current);
  }, []);

  const encodeCanvasState = useCallback(
    (
      pieces: DroppedLego[],
      conns: Connection[],
      hideConnectedLegs: boolean
    ) => {
      // console.log("Encoding droppedLegos", pieces, "connections", conns);
      // console.log(new Error().stack);
      // // Print call stack for debugging
      // console.log(
      //   "Canvas state encoding call stack:",
      //   new Error("just debugging").stack
      // );
      stateSerializerRef.current.encode(pieces, conns, hideConnectedLegs);
    },
    []
  );

  // Helper functions for localStorage cache management
  const getCacheKey = useCallback((canvasId: string, cacheType: string) => {
    return `planqtn_cache_${cacheType}_${canvasId}`;
  }, []);

  const loadCachesFromLocalStorage = useCallback(
    (canvasId: string) => {
      try {
        // Load parity check matrix cache
        const parityCacheKey = getCacheKey(canvasId, "parity");
        const parityCacheData = localStorage.getItem(parityCacheKey);
        if (parityCacheData) {
          const parityCache = new Map<string, ParityCheckMatrix>(
            JSON.parse(parityCacheData)
          );
          setParityCheckMatrixCache(parityCache);
          console.log(
            "Loaded parity check matrix cache for canvasId:",
            canvasId,
            "key",
            parityCacheKey,
            "value",
            parityCacheData
          );
          console.log("parityCheckMatrixCache", parityCheckMatrixCache);
        } else {
          console.log(
            "No parity check matrix cache found for canvasId:",
            canvasId
          );
        }

        // Load weight enumerator cache
        const weightCacheKey = getCacheKey(canvasId, "weight");
        const weightCacheData = localStorage.getItem(weightCacheKey);
        if (weightCacheData) {
          const weightCache = new Map<
            string,
            {
              taskId: string;
              polynomial: string;
              normalizerPolynomial: string;
              truncateLength: number | null;
            }
          >(JSON.parse(weightCacheData));
          setWeightEnumeratorCache(weightCache);
        }
      } catch (error) {
        console.error("Failed to load caches from localStorage:", error);
      }
    },
    [getCacheKey]
  );

  const decodeCanvasState = useCallback(
    async (encoded: string) => {
      try {
        const result = await stateSerializerRef.current.decode(encoded);
        // Set the canvas ID from the decoded state
        setCanvasId(result.canvasId);
        console.log("Decoded canvas state for canvasId:", result.canvasId);
        console.log(new Error().stack);
        loadCachesFromLocalStorage(result.canvasId);
        return result;
      } catch (error) {
        console.error("Failed to decode canvas state:", error);
        if (error instanceof Error) console.log(error.stack);
        // Create a new error with a user-friendly message
        throw error;
      }
    },
    [loadCachesFromLocalStorage]
  );

  const saveCachesToLocalStorage = useCallback(
    (canvasId: string) => {
      try {
        // Save parity check matrix cache
        const parityCacheKey = getCacheKey(canvasId, "parity");
        const parityCacheData = JSON.stringify(
          Array.from(parityCheckMatrixCache.entries())
        );
        localStorage.setItem(parityCacheKey, parityCacheData);

        // Save weight enumerator cache
        const weightCacheKey = getCacheKey(canvasId, "weight");
        const weightCacheData = JSON.stringify(
          Array.from(weightEnumeratorCache.entries())
        );
        localStorage.setItem(weightCacheKey, weightCacheData);
      } catch (error) {
        console.error("Failed to save caches to localStorage:", error);
      }
    },
    [getCacheKey, parityCheckMatrixCache, weightEnumeratorCache]
  );

  // Add a new effect to handle initial URL state
  useEffect(() => {
    const handleHashChange = async () => {
      const hashParams = new URLSearchParams(window.location.hash.slice(1));
      const stateParam = hashParams.get("state");
      if (stateParam) {
        try {
          const decodedState = await decodeCanvasState(stateParam);
          setDroppedLegos(decodedState.pieces);
          setConnections(decodedState.connections);
          setHideConnectedLegs(decodedState.hideConnectedLegs);
        } catch (error) {
          // Clear the invalid state from the URL
          // window.history.replaceState(null, '', window.location.pathname + window.location.search)
          // Ensure error is an Error object
          setFatalError(
            error instanceof Error ? error : new Error(String(error))
          );
        }
      } else {
        // No state in URL, generate a new canvas ID and load empty caches
        const newCanvasId = stateSerializerRef.current.getCanvasId();
        setCanvasId(newCanvasId);
        loadCachesFromLocalStorage(newCanvasId);
      }
    };

    // Listen for hash changes
    window.addEventListener("hashchange", handleHashChange);

    // Initial load
    handleHashChange();

    // Cleanup
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, [decodeCanvasState, loadCachesFromLocalStorage]);

  // Save caches to localStorage when they change
  useEffect(() => {
    if (canvasId) {
      console.log("Saving caches to localStorage for canvasId:", canvasId);
      saveCachesToLocalStorage(canvasId);
    }
  }, [
    canvasId,
    parityCheckMatrixCache,
    weightEnumeratorCache,
    saveCachesToLocalStorage
  ]);

  // Add mouse position tracking with useRef to avoid re-renders
  const mousePositionRef = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const canvasPanel = document.querySelector("#main-panel");
      if (!canvasPanel) return;

      const canvasRect = canvasPanel.getBoundingClientRect();
      const isOverCanvas =
        e.clientX >= canvasRect.left &&
        e.clientX <= canvasRect.right &&
        e.clientY >= canvasRect.top &&
        e.clientY <= canvasRect.bottom;

      if (isOverCanvas) {
        mousePositionRef.current = {
          x: e.clientX - canvasRect.left,
          y: e.clientY - canvasRect.top
        };
      } else {
        mousePositionRef.current = null;
      }
    };

    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  const handleDragStart = useCallback(
    (e: React.DragEvent<HTMLElement>, lego: LegoPiece) => {
      if (lego.id === "custom") {
        // Store the drop position for the custom lego
        const rect = e.currentTarget.getBoundingClientRect();
        // Note: position will be set when the custom lego is dropped, not during drag start
        // Set the draggedLego state for custom legos
        const draggedLego: DroppedLego = {
          ...lego,
          instanceId: newInstanceId(),
          x: rect.left + rect.width / 2,
          y: rect.top + rect.height / 2,
          style: getLegoStyle(lego.id, lego.parity_check_matrix[0].length / 2),
          selectedMatrixRows: []
        };
        setDraggedLego(draggedLego);
      } else {
        // Handle regular lego drag
        const rect = e.currentTarget.getBoundingClientRect();
        const draggedLego: DroppedLego = {
          ...lego,
          instanceId: newInstanceId(),
          x: rect.left + rect.width / 2,
          y: rect.top + rect.height / 2,
          style: getLegoStyle(lego.id, lego.parity_check_matrix[0].length / 2),
          selectedMatrixRows: []
        };
        setDraggedLego(draggedLego);
      }
    },
    [newInstanceId]
  );

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();

    // Use the draggedLego state instead of trying to get data from dataTransfer
    if (!draggedLego) return;

    const numLegs = draggedLego.parity_check_matrix[0].length / 2;

    // Only handle two-legged legos
    if (numLegs !== 2) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Find the closest connection
    let closestConnection: Connection | null = null;
    let minDistance = Infinity;

    connections.forEach((conn) => {
      const fromLego = droppedLegos.find(
        (l) => l.instanceId === conn.from.legoId
      );
      const toLego = droppedLegos.find((l) => l.instanceId === conn.to.legoId);
      if (!fromLego || !toLego) return;

      const fromPos = calculateLegPosition(fromLego, conn.from.legIndex);
      const toPos = calculateLegPosition(toLego, conn.to.legIndex);

      const fromPoint = {
        x: fromLego.x + fromPos.endX,
        y: fromLego.y + fromPos.endY
      };
      const toPoint = {
        x: toLego.x + toPos.endX,
        y: toLego.y + toPos.endY
      };

      // Calculate distance from point to line segment
      const distance = pointToLineDistance(
        x,
        y,
        fromPoint.x,
        fromPoint.y,
        toPoint.x,
        toPoint.y
      );
      if (distance < minDistance && distance < 20) {
        // 20 pixels threshold
        minDistance = distance;
        closestConnection = conn;
      }
    });

    setHoveredConnection(closestConnection);
  };

  const handleDropStopperOnConnection = (
    dropPosition: { x: number; y: number },
    draggedLego: LegoPiece
  ): boolean => {
    if (draggedLego.id.includes("stopper")) {
      const closestLeg = findClosestDanglingLeg(
        dropPosition,
        droppedLegos,
        connections
      );
      if (!closestLeg) return false;

      // Get max instance ID
      const maxInstanceId = Math.max(
        ...droppedLegos.map((l) => parseInt(l.instanceId))
      );

      // Create the stopper lego
      const stopperLego: DroppedLego = {
        ...draggedLego,
        instanceId: (maxInstanceId + 1).toString(),
        x: dropPosition.x,
        y: dropPosition.y,
        style: getLegoStyle(draggedLego.id, 1),
        selectedMatrixRows: []
      };
      try {
        const addStopper = new AddStopper(connections, droppedLegos);
        const result = addStopper.apply(
          closestLeg.lego,
          closestLeg.legIndex,
          stopperLego
        );
        setConnections(result.connections);
        setDroppedLegos(result.droppedLegos);
        operationHistory.addOperation(result.operation);
        encodeCanvasState(
          result.droppedLegos,
          result.connections,
          hideConnectedLegs
        );
        return true;
      } catch (error) {
        console.error("Failed to add stopper:", error);
        toast({
          title: "Error",
          description:
            error instanceof Error ? error.message : "Failed to add stopper",
          status: "error",
          duration: 3000,
          isClosable: true
        });
        return false;
      }
    }
    return false;
  };

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    if (!draggedLego) return;

    const dropPosition = {
      x: e.clientX - e.currentTarget.getBoundingClientRect().left,
      y: e.clientY - e.currentTarget.getBoundingClientRect().top
    };

    if (draggedLego.id === "custom") {
      openCustomLegoDialog(dropPosition);
      return;
    }

    // Find the closest dangling leg if we're dropping a stopper
    const success = handleDropStopperOnConnection(dropPosition, draggedLego);
    if (success) return;

    const numLegs = draggedLego.parity_check_matrix[0].length / 2;

    if (draggedLego.is_dynamic) {
      setSelectedDynamicLego(draggedLego);
      setPendingDropPosition({ x: dropPosition.x, y: dropPosition.y });
      setIsDynamicLegoDialogOpen(true);
      setDraggedLego(null);
      return;
    }

    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const newLego = {
      ...draggedLego,
      x,
      y,
      instanceId: newInstanceId(),
      style: getLegoStyle(draggedLego.id, numLegs),
      selectedMatrixRows: []
    };

    // Handle two-legged lego insertion
    if (numLegs === 2 && hoveredConnection) {
      const trafo = new InjectTwoLegged(connections, droppedLegos);
      trafo
        .apply(newLego, hoveredConnection)
        .then(
          ({
            connections: newConnections,
            droppedLegos: newDroppedLegos,
            operation
          }) => {
            setDroppedLegos(newDroppedLegos);
            setConnections(newConnections);
            operationHistory.addOperation(operation);
            encodeCanvasState(
              newDroppedLegos,
              newConnections,
              hideConnectedLegs
            );
          }
        )
        .catch((error) => {
          setError(`${error}`);
          console.error(error);
        });
    } else {
      console.log("Dropped lego", newLego);
      // If it's a custom lego, show the dialog after dropping
      if (draggedLego.id === "custom") {
        openCustomLegoDialog({ x, y });
      } else {
        addDroppedLego(newLego);
        operationHistory.addOperation({
          type: "add",
          data: { legosToAdd: [newLego] }
        });
        encodeCanvasState(
          [...droppedLegos, newLego],
          connections,
          hideConnectedLegs
        );
      }
    }

    setHoveredConnection(null);
    setDraggedLego(null);
  };

  // Add a handler for when drag ends
  const handleDragEnd = () => {
    setDraggedLego(null);
    setHoveredConnection(null);
  };

  const handleDynamicLegoSubmit = async (
    parameters: Record<string, unknown>
  ) => {
    if (!selectedDynamicLego || !pendingDropPosition) return;

    try {
      const dynamicLego = Legos.getDynamicLego({
        lego_id: selectedDynamicLego.id,
        parameters
      });

      const instanceId = newInstanceId();
      const numLegs = dynamicLego.parity_check_matrix[0].length / 2;
      const newLego = {
        ...dynamicLego,
        x: pendingDropPosition.x,
        y: pendingDropPosition.y,
        instanceId,
        style: getLegoStyle(dynamicLego.id, numLegs),
        selectedMatrixRows: []
      };
      addDroppedLego(newLego);
      operationHistory.addOperation({
        type: "add",
        data: { legosToAdd: [newLego] }
      });
      encodeCanvasState(
        [...droppedLegos, newLego],
        connections,
        hideConnectedLegs
      );
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Failed to create dynamic lego"
      );
    } finally {
      setIsDynamicLegoDialogOpen(false);
      setSelectedDynamicLego(null);
      setPendingDropPosition(null);
    }
  };
  const handleClone = (lego: DroppedLego, clientX: number, clientY: number) => {
    // Check if we're cloning multiple legos
    const legosToClone = tensorNetwork?.legos || [lego];

    // Get a single starting ID for all new legos
    const startingId = parseInt(newInstanceId());

    // Create a mapping from old instance IDs to new ones
    const instanceIdMap = new Map<string, string>();
    const newLegos = legosToClone.map((l, idx) => {
      const newId = String(startingId + idx);
      instanceIdMap.set(l.instanceId, newId);
      return {
        ...l,
        instanceId: newId,
        x: l.x + 20,
        y: l.y + 20
      };
    });

    // Clone connections between the selected legos
    const newConnections = connections
      .filter(
        (conn) =>
          legosToClone.some((l) => l.instanceId === conn.from.legoId) &&
          legosToClone.some((l) => l.instanceId === conn.to.legoId)
      )
      .map(
        (conn) =>
          new Connection(
            {
              legoId: instanceIdMap.get(conn.from.legoId)!,
              legIndex: conn.from.legIndex
            },
            {
              legoId: instanceIdMap.get(conn.to.legoId)!,
              legIndex: conn.to.legIndex
            }
          )
      );

    // Add new legos and connections
    addDroppedLegos(newLegos);
    addConnections(newConnections);

    // Set up drag state for the group
    const positions: { [instanceId: string]: { x: number; y: number } } = {};
    newLegos.forEach((l) => {
      positions[l.instanceId] = { x: l.x, y: l.y };
    });

    setGroupDragState({
      legoInstanceIds: newLegos.map((l) => l.instanceId),
      originalPositions: positions
    });

    // Set up initial drag state for the first lego
    setDragState({
      isDragging: false,
      draggedLegoIndex: droppedLegos.length,
      startX: clientX,
      startY: clientY,
      originalX: lego.x + 20,
      originalY: lego.y + 20,
      justFinished: false
    });

    // Add to history
    operationHistory.addOperation({
      type: "add",
      data: {
        legosToAdd: newLegos,
        connectionsToAdd: newConnections
      }
    });

    // Update URL state
    encodeCanvasState(
      droppedLegos.concat(newLegos),
      connections.concat(newConnections),
      hideConnectedLegs
    );
  };
  const handleLegoMouseDown = (e: React.MouseEvent, index: number) => {
    e.preventDefault();
    e.stopPropagation();
    const lego = droppedLegos[index];

    if (e.shiftKey) {
      handleClone(lego, e.clientX, e.clientY);
    } else {
      const isPartOfSelection = tensorNetwork?.legos.some(
        (l) => l.instanceId === lego.instanceId
      );

      if (isPartOfSelection) {
        const selectedLegos = tensorNetwork?.legos || [];
        const currentPositions: {
          [instanceId: string]: { x: number; y: number };
        } = {};
        selectedLegos.forEach((l) => {
          currentPositions[l.instanceId] = { x: l.x, y: l.y };
        });

        setGroupDragState({
          legoInstanceIds: selectedLegos.map((l) => l.instanceId),
          originalPositions: currentPositions
        });
      }

      setDragState({
        isDragging: false,
        draggedLegoIndex: index,
        startX: e.clientX,
        startY: e.clientY,
        originalX: lego.x,
        originalY: lego.y,
        justFinished: false
      });
    }
  };

  const handleLegoClick = (e: React.MouseEvent, lego: DroppedLego) => {
    // Reset the justFinished flag first
    if (dragState.justFinished) {
      setDragState((prev) => ({ ...prev, justFinished: false }));
      return; // Skip this click, but be ready for the next one
    }

    if (!dragState.isDragging) {
      // Only handle click if not dragging
      e.stopPropagation();

      if (e.ctrlKey || e.metaKey) {
        // Handle Ctrl+click for toggling selection
        if (tensorNetwork) {
          const isSelected = tensorNetwork.legos.some(
            (l) => l.instanceId === lego.instanceId
          );
          if (isSelected) {
            // Remove lego from tensor network
            const newLegos = tensorNetwork.legos.filter(
              (l) => l.instanceId !== lego.instanceId
            );
            const newConnections = tensorNetwork.connections.filter(
              (conn) =>
                conn.from.legoId !== lego.instanceId &&
                conn.to.legoId !== lego.instanceId
            );
            if (newLegos.length === 0) {
              setTensorNetwork(null);
            } else {
              const newNetwork = new TensorNetwork(newLegos, newConnections);
              newNetwork.signature = createNetworkSignature(newNetwork);
              setTensorNetwork(newNetwork);
            }
          } else {
            // Add lego to tensor network
            const newLegos = [...tensorNetwork.legos, lego];
            const newConnections = connections.filter(
              (conn) =>
                newLegos.some((l) => l.instanceId === conn.from.legoId) &&
                newLegos.some((l) => l.instanceId === conn.to.legoId)
            );
            const newNetwork = new TensorNetwork(newLegos, newConnections);
            newNetwork.signature = createNetworkSignature(newNetwork);
            setTensorNetwork(newNetwork);
          }
        } else {
          // If no tensor network exists, create one with just this lego
          const newNetwork = new TensorNetwork([lego], []);

          newNetwork.signature = createNetworkSignature(newNetwork);
          setTensorNetwork(newNetwork);
        }
      } else {
        // Regular click behavior
        if (
          tensorNetwork?.legos.length === 1 &&
          tensorNetwork.legos[0].instanceId === lego.instanceId
        ) {
          const network = findConnectedComponent(
            lego,
            droppedLegos,
            connections
          );
          network.signature = createNetworkSignature(network);
          setTensorNetwork(network);
        } else {
          setTensorNetwork(new TensorNetwork([lego], []));
        }
      }
    }
  };

  const handleCanvasClick = (e: React.MouseEvent) => {
    // Only clear selection if clicking directly on canvas (not on a Lego)
    // and not during or right after selection box usage
    if (
      e.target === e.currentTarget &&
      !selectionBox.isSelecting &&
      !dragState.isDragging &&
      !selectionBox.justFinished
    ) {
      setTensorNetwork(null);
    }
    // Reset the justFinished flag after handling the click
    if (selectionBox.justFinished) {
      setSelectionBox((prev) => ({ ...prev, justFinished: false }));
    }
  };

  const handleCanvasMouseDown = (e: React.MouseEvent) => {
    // Only start selection box if clicking directly on canvas (not on a Lego)
    if (e.target === e.currentTarget) {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;

      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      if (!e.altKey) {
        // Use SelectionManager for selection logic
        selectionManagerRef.current?.handleMouseDown(e);
      } else {
        setCanvasDragState({
          isDragging: true,
          startX: x,
          startY: y,
          currentX: x,
          currentY: y
        });
      }
    }
  };

  const handleLegMouseDown = (
    e: React.MouseEvent,
    legoId: string,
    legIndex: number
  ) => {
    e.preventDefault();
    e.stopPropagation();
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    setLegDragState({
      isDragging: true,
      legoId,
      legIndex,
      startX: x,
      startY: y,
      currentX: x,
      currentY: y
    });
  };

  const handleCanvasMouseMove = (e: React.MouseEvent) => {
    e.preventDefault();
    const rect = canvasRef.current?.getBoundingClientRect();

    if (!rect) return;

    // Selection box dragging is now handled by SelectionManager
    if (selectionBox.isSelecting) {
      return;
    }

    if (canvasDragState.isDragging) {
      const newX = e.clientX - rect.left;
      const newY = e.clientY - rect.top;
      const deltaX = newX - canvasDragState.startX;
      const deltaY = newY - canvasDragState.startY;

      setCanvasDragState((prev) => ({
        ...prev,
        startX: newX,
        startY: newY,
        currentX: newX,
        currentY: newY
      }));

      const movedLegos = droppedLegos.map((lego) => ({
        ...lego,
        x: lego.x + deltaX,
        y: lego.y + deltaY
      }));
      setDroppedLegos(movedLegos);
      encodeCanvasState(movedLegos, connections, hideConnectedLegs);
    }

    // Check if we should start dragging
    if (!dragState.isDragging && dragState.draggedLegoIndex !== -1) {
      const deltaX = e.clientX - dragState.startX;
      const deltaY = e.clientY - dragState.startY;

      // Only start dragging if the mouse has moved more than 3 pixels
      if (Math.abs(deltaX) > 3 || Math.abs(deltaY) > 3) {
        setDragState((prev) => ({
          ...prev,
          isDragging: true
        }));
      }
      return;
    }

    // Handle Lego dragging
    if (dragState.isDragging) {
      const deltaX = e.clientX - dragState.startX;
      const deltaY = e.clientY - dragState.startY;
      const newX = dragState.originalX + deltaX;
      const newY = dragState.originalY + deltaY;

      // Create a new array with updated positions
      const updatedLegos = droppedLegos.map((lego, index) => {
        if (
          groupDragState &&
          groupDragState.legoInstanceIds.includes(lego.instanceId)
        ) {
          // Move all selected legos together
          const originalPos = groupDragState.originalPositions[lego.instanceId];
          return {
            ...lego,
            x: originalPos.x + deltaX,
            y: originalPos.y + deltaY
          };
        } else if (index === dragState.draggedLegoIndex) {
          return {
            ...lego,
            x: newX,
            y: newY
          };
        }
        return lego;
      });

      setDroppedLegos(updatedLegos);
      if (groupDragState) {
        if (tensorNetwork) {
          tensorNetwork.legos = updatedLegos.filter((lego) =>
            groupDragState.legoInstanceIds.includes(lego.instanceId)
          );
        }
      }

      // Check if we're hovering over a connection (for two-legged legos) or a dangling leg (for stoppers)
      const draggedLego = updatedLegos[dragState.draggedLegoIndex];
      if (draggedLego) {
        const draggedLegoHasConnections = connections.some((conn) =>
          conn.containsLego(draggedLego.instanceId)
        );
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        if (
          draggedLego.parity_check_matrix[0].length / 2 === 2 &&
          !draggedLegoHasConnections
        ) {
          // Find the closest connection for two-legged legos
          let closestConnection: Connection | null = null;
          let minDistance = Infinity;

          connections.forEach((conn) => {
            const fromLego = droppedLegos.find(
              (l) => l.instanceId === conn.from.legoId
            );
            const toLego = droppedLegos.find(
              (l) => l.instanceId === conn.to.legoId
            );
            if (!fromLego || !toLego) return;

            const fromPos = calculateLegPosition(fromLego, conn.from.legIndex);
            const toPos = calculateLegPosition(toLego, conn.to.legIndex);

            const fromPoint = {
              x: fromLego.x + fromPos.endX,
              y: fromLego.y + fromPos.endY
            };
            const toPoint = {
              x: toLego.x + toPos.endX,
              y: toLego.y + toPos.endY
            };

            const distance = pointToLineDistance(
              x,
              y,
              fromPoint.x,
              fromPoint.y,
              toPoint.x,
              toPoint.y
            );
            if (distance < minDistance && distance < 20) {
              minDistance = distance;
              closestConnection = conn;
            }
          });

          setHoveredConnection(closestConnection);
        } else if (
          draggedLego.id.includes("stopper") &&
          !draggedLegoHasConnections
        ) {
          // Find the closest dangling leg for stoppers
          const closestLeg = findClosestDanglingLeg(
            { x, y },
            droppedLegos,
            connections
          );
          if (closestLeg) {
            const pos = calculateLegPosition(
              closestLeg.lego,
              closestLeg.legIndex
            );
            const legX = closestLeg.lego.x + pos.endX;
            const legY = closestLeg.lego.y + pos.endY;
            const distance = Math.sqrt(
              Math.pow(x - legX, 2) + Math.pow(y - legY, 2)
            );

            if (distance < 20) {
              // 20 pixels threshold
              setHoveredConnection(
                new Connection(
                  {
                    legoId: closestLeg.lego.instanceId,
                    legIndex: closestLeg.legIndex
                  },
                  { legoId: draggedLego.instanceId, legIndex: 0 }
                )
              );
            } else {
              setHoveredConnection(null);
            }
          } else {
            setHoveredConnection(null);
          }
        }
      }
    }

    // Handle leg dragging
    if (legDragState?.isDragging) {
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      setLegDragState((prev) => ({
        ...prev!,
        currentX: mouseX,
        currentY: mouseY
      }));
    }
  };

  const handleCanvasMouseWheel = (e: React.WheelEvent) => {
    if (altKeyPressed) {
      const newZoomLevel =
        zoomLevel *
        Math.pow(1 + Math.sign(e.deltaY) / 10, Math.abs(e.deltaY) / 100);
      const scale = newZoomLevel / zoomLevel;
      setZoomLevel(newZoomLevel);
      const centerX = e.currentTarget.getBoundingClientRect().width / 2;
      const centerY = e.currentTarget.getBoundingClientRect().height / 2;
      const rescaledLegos = droppedLegos.map((lego) => ({
        ...lego,
        x: (lego.x - centerX) * scale + centerX,
        y: (lego.y - centerY) * scale + centerY
      }));
      setDroppedLegos(rescaledLegos);
      encodeCanvasState(rescaledLegos, connections, hideConnectedLegs);
    }
  };

  const handleCanvasMouseUp = (e: React.MouseEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect();

    if (!rect) {
      setLegDragState(null);
      return;
    }

    // Selection box end is now handled by SelectionManager
    if (selectionBox.isSelecting) {
      return;
    }

    if (canvasDragState.isDragging) {
      const newCanvasDragState = {
        isDragging: false,
        startX: 0,
        startY: 0,
        currentX: 0,
        currentY: 0
      };
      setCanvasDragState(newCanvasDragState);
      return;
    }

    if (dragState.isDragging) {
      const deltaX = e.clientX - dragState.startX;
      const deltaY = e.clientY - dragState.startY;
      const newX = dragState.originalX + deltaX;
      const newY = dragState.originalY + deltaY;
      let updatedLegos = droppedLegos;
      let updatedConnections = connections;

      // Check if we're dropping on a connection (for two-legged legos) or a dangling leg (for stoppers)
      if (hoveredConnection) {
        const draggedLego = droppedLegos[dragState.draggedLegoIndex];
        if (draggedLego) {
          if (draggedLego.parity_check_matrix[0].length / 2 === 2) {
            // Handle two-legged lego insertion
            const updatedLego = {
              ...draggedLego,
              x: newX,
              y: newY
            };

            const trafo = new InjectTwoLegged(connections, droppedLegos);
            trafo
              .apply(updatedLego, hoveredConnection, {
                ...draggedLego,
                x: newX - deltaX,
                y: newY - deltaY
              })
              .then(
                ({
                  connections: newConnections,
                  droppedLegos: newDroppedLegos,
                  operation
                }) => {
                  updatedLegos = newDroppedLegos;
                  updatedConnections = newConnections;
                  setDroppedLegos(updatedLegos);
                  setConnections(updatedConnections);
                  operationHistory.addOperation(operation);
                }
              )
              .catch((error) => {
                setError(`${error}`);
                console.error(error);
              });
          } else if (draggedLego.id.includes("stopper")) {
            // Handle stopper lego insertion
            const updatedLego = {
              ...draggedLego,
              x: newX,
              y: newY
            };

            const addStopper = new AddStopper(connections, droppedLegos);
            try {
              const {
                connections: newConnections,
                droppedLegos: newDroppedLegos,
                operation
              } = addStopper.apply(
                droppedLegos.find(
                  (l) => l.instanceId === hoveredConnection.from.legoId
                )!,
                hoveredConnection.from.legIndex,
                updatedLego
              );
              updatedLegos = newDroppedLegos;
              updatedConnections = newConnections;
              setDroppedLegos(updatedLegos);
              setConnections(updatedConnections);
              operationHistory.addOperation(operation);
            } catch (error) {
              console.error("Failed to add stopper:", error);
              toast({
                title: "Error",
                description:
                  error instanceof Error
                    ? error.message
                    : "Failed to add stopper",
                status: "error",
                duration: 3000,
                isClosable: true
              });
            }
          }
        }
      } else if (deltaX !== 0 || deltaY !== 0) {
        // Handle regular movement
        if (groupDragState) {
          const groupMoves = groupDragState.legoInstanceIds.map(
            (instanceId) => ({
              oldLego: {
                ...(droppedLegos.find(
                  (lego) => lego.instanceId === instanceId
                )! as DroppedLego),
                x: groupDragState.originalPositions[instanceId].x,
                y: groupDragState.originalPositions[instanceId].y
              },
              newLego: {
                ...(droppedLegos.find(
                  (lego) => lego.instanceId === instanceId
                )! as DroppedLego),
                x: groupDragState.originalPositions[instanceId].x + deltaX,
                y: groupDragState.originalPositions[instanceId].y + deltaY
              }
            })
          );

          operationHistory.addOperation({
            type: "move",
            data: { legosToUpdate: groupMoves }
          });
        } else if (tensorNetwork) {
          const groupMoves = tensorNetwork.legos.map((lego) => ({
            oldLego: {
              ...lego,
              x: lego.x - deltaX,
              y: lego.y - deltaY
            },
            newLego: {
              ...lego,
              x: lego.x,
              y: lego.y
            }
          }));

          operationHistory.addOperation({
            type: "move",
            data: { legosToUpdate: groupMoves }
          });
        } else {
          operationHistory.addOperation({
            type: "move",
            data: {
              legosToUpdate: [
                {
                  oldLego: {
                    ...(droppedLegos[
                      dragState.draggedLegoIndex
                    ] as DroppedLego),
                    x: dragState.originalX,
                    y: dragState.originalY
                  },
                  newLego: {
                    ...(droppedLegos[
                      dragState.draggedLegoIndex
                    ] as DroppedLego),
                    x: newX,
                    y: newY
                  }
                }
              ]
            }
          });
        }
      }

      encodeCanvasState(updatedLegos, updatedConnections, hideConnectedLegs);
    }

    // Handle leg connection
    if (legDragState?.isDragging) {
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      droppedLegos.find((lego) => {
        const legCount = lego.parity_check_matrix[0].length / 2;
        for (let i = 0; i < legCount; i++) {
          const pos = calculateLegPosition(lego, i);
          const targetPoint = {
            x: lego.x + pos.endX,
            y: lego.y + pos.endY
          };

          const distance = Math.sqrt(
            Math.pow(mouseX - targetPoint.x, 2) +
              Math.pow(mouseY - targetPoint.y, 2)
          );

          if (distance < 10) {
            // Check if either leg is already participating in a connection
            const isSourceLegConnected = connections.some(
              (conn) =>
                (conn.from.legoId === legDragState.legoId &&
                  conn.from.legIndex === legDragState.legIndex) ||
                (conn.to.legoId === legDragState.legoId &&
                  conn.to.legIndex === legDragState.legIndex)
            );
            const isTargetLegConnected = connections.some(
              (conn) =>
                (conn.from.legoId === lego.instanceId &&
                  conn.from.legIndex === i) ||
                (conn.to.legoId === lego.instanceId && conn.to.legIndex === i)
            );

            if (
              lego.instanceId === legDragState.legoId &&
              i === legDragState.legIndex
            ) {
              return true;
            }

            if (isSourceLegConnected || isTargetLegConnected) {
              setError("Cannot connect to a leg that is already connected");
              return true;
            }

            const connectionExists = connections.some(
              (conn) =>
                (conn.from.legoId === legDragState.legoId &&
                  conn.from.legIndex === legDragState.legIndex &&
                  conn.to.legoId === lego.instanceId &&
                  conn.to.legIndex === i) ||
                (conn.from.legoId === lego.instanceId &&
                  conn.from.legIndex === i &&
                  conn.to.legoId === legDragState.legoId &&
                  conn.to.legIndex === legDragState.legIndex)
            );

            if (!connectionExists) {
              const newConnection = new Connection(
                {
                  legoId: legDragState.legoId,
                  legIndex: legDragState.legIndex
                },
                {
                  legoId: lego.instanceId,
                  legIndex: i
                }
              );

              addConnections([newConnection]);
              console.log("adding new connection", newConnection);
              console.log(
                "connections",
                useConnectionStore.getState().getConnections()
              );

              encodeCanvasState(
                droppedLegos,
                useConnectionStore.getState().getConnections(),
                hideConnectedLegs
              );

              operationHistory.addOperation({
                type: "connect",
                data: { connectionsToAdd: [newConnection] }
              });
              return true;
            }
          }
        }
        return false;
      });
    }

    setLegDragState(null);
    setHoveredConnection(null);

    setDragState((prev) => ({
      ...prev,
      isDragging: false,
      draggedLegoIndex: -1,
      justFinished: dragState.isDragging
    }));

    setGroupDragState(null);
  };

  const handleCanvasMouseLeave = () => {
    setLegDragState(null);
    if (canvasDragState.isDragging) {
      setCanvasDragState({
        isDragging: false,
        startX: 0,
        startY: 0,
        currentX: 0,
        currentY: 0
      });
    }
  };

  // Handle undo
  const handleUndo = () => {
    console.log("before undo", connections, droppedLegos);
    const { connections: newConnections, droppedLegos: newDroppedLegos } =
      operationHistory.undo(connections, droppedLegos);
    console.log("undo result", newConnections, newDroppedLegos);
    setConnections(newConnections);
    setDroppedLegos(newDroppedLegos);
    encodeCanvasState(newDroppedLegos, newConnections, hideConnectedLegs);
  };

  // Handle redo
  const handleRedo = () => {
    console.log("before redo", connections, droppedLegos);
    const { connections: newConnections, droppedLegos: newDroppedLegos } =
      operationHistory.redo(connections, droppedLegos);
    console.log("redo result", newConnections, newDroppedLegos);
    setConnections(newConnections);
    setDroppedLegos(newDroppedLegos);
    encodeCanvasState(newDroppedLegos, newConnections, hideConnectedLegs);
  };

  // Helper function to generate network signature for caching
  const createNetworkSignature = (network: TensorNetwork) => {
    const sortedLegos = [...network.legos]
      .sort((a, b) => a.instanceId.localeCompare(b.instanceId))
      .map(
        (lego) =>
          lego.id +
          "-" +
          lego.instanceId +
          "-" +
          lego.parity_check_matrix[0].length / 2
      );
    const sortedConnections = [...network.connections].sort((a, b) => {
      const aStr = `${a.from.legoId}${a.from.legIndex}${a.to.legoId}${a.to.legIndex}`;
      const bStr = `${b.from.legoId}${b.from.legIndex}${b.to.legoId}${b.to.legIndex}`;
      return aStr.localeCompare(bStr);
    });
    const sig = JSON.stringify({
      legos: sortedLegos,
      connections: sortedConnections
    });
    return sig;
  };

  // Keyboard handling moved to KeyboardHandler component

  // KeyUp, Blur, and Focus handling moved to KeyboardHandler component

  useEffect(() => {
    if (!userContextSupabase) {
      return;
    }
    const {
      data: { subscription }
    } = userContextSupabase.auth.onAuthStateChange((_event, session) => {
      setCurrentUser(session?.user ?? null);
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const calculatePanelSizes = (containerWidth: number) => {
      // With accordion structure, we need more space for the headers
      // Default is 280px, min is 150px to accommodate accordion headers
      const defaultWidthInPx = 280;
      const minWidthInPx = 150;

      if (containerWidth > 0) {
        const defaultSize = (defaultWidthInPx / containerWidth) * 100 * 1.5;
        const minSize = (minWidthInPx / containerWidth) * 100;

        // Add some sanity checks to not exceed 100% or go below 0
        setLegoPanelSizes({
          defaultSize: Math.min(100, Math.max(0, defaultSize)),
          minSize: Math.min(100, Math.max(0, minSize))
        });
      }
    };

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        calculatePanelSizes(entry.contentRect.width);
      }
    });

    const currentContainerRef = panelGroupContainerRef.current;
    if (currentContainerRef) {
      observer.observe(currentContainerRef);
      // Initial calculation
      calculatePanelSizes(currentContainerRef.offsetWidth);
    }

    return () => {
      if (currentContainerRef) {
        observer.unobserve(currentContainerRef);
      }
    };
  }, []);

  // Add Supabase status check on page load
  useEffect(() => {
    if (!userContextSupabase) {
      return;
    }
    const checkStatus = async () => {
      // Use 3 retries to ensure we're not showing errors due to temporary network issues
      const status = await checkSupabaseStatus(userContextSupabase!, 3);
      setSupabaseStatus(status);

      if (!status.isHealthy) {
        console.error("Supabase connection issue:", status.message);

        if (currentUser) {
          // User is logged in, show error toast
          toast({
            title: "Backend Connection Issue",
            description: status.message,
            status: "error",
            duration: 10000,
            isClosable: true,
            position: "top"
          });
        }
      }
    };

    checkStatus();

    // Set up periodic checks every 30 seconds
    const intervalId = setInterval(checkStatus, 30000);

    return () => {
      clearInterval(intervalId);
    };
  }, [currentUser, toast]);

  // Update the auth dialog to show Supabase status error if needed
  const handleAuthDialogOpen = async () => {
    if (!userContextSupabase) {
      setSupabaseStatus({
        isHealthy: false,
        message: "No supabase client available"
      });
      return;
    }
    try {
      let status = supabaseStatus;
      if (!status) {
        openLoadingModal(
          "⚠️There seems to be an issue wtih the backend, checking..."
        );
        const timeoutPromise = new Promise<{
          isHealthy: boolean;
          message: string;
        }>((resolve) => {
          setTimeout(() => {
            resolve({
              isHealthy: false,
              message: "Connection timed out"
            });
          }, 3000);
        });

        // Race between the actual check and the timeout
        status = await Promise.race([
          checkSupabaseStatus(userContextSupabase, 1),
          timeoutPromise
        ]);

        setSupabaseStatus(status);
      }
      // Check if Supabase is experiencing connection issues
      if (status && !status.isHealthy) {
        // Show an error toast
        toast({
          title: "Backend Connection Issue",
          description: `Cannot sign in: ${status.message}. Please try again later.`,
          status: "error",
          duration: 10000,
          isClosable: true
        });

        // Still open the dialog to show the connection error message
        openAuthDialog(status.message);
        return;
      }

      // If no connection issues, open the auth dialog normally
      openAuthDialog();
    } finally {
      closeLoadingModal();
    }
  };

  const handleConnectionDoubleClick = (
    e: React.MouseEvent,
    connection: Connection
  ) => {
    e.preventDefault();
    e.stopPropagation();

    // Add to history before removing
    operationHistory.addOperation({
      type: "disconnect",
      data: { connectionsToRemove: [connection] }
    });

    // Remove the connection and update URL state with the new connections
    removeConnections([connection]);
    encodeCanvasState(droppedLegos, connections, hideConnectedLegs);
  };

  const handleClearAll = () => {
    if (droppedLegos.length === 0 && connections.length === 0) return;

    // Store current state for history
    operationHistory.addOperation({
      type: "remove",
      data: {
        legosToRemove: droppedLegos,
        connectionsToRemove: connections
      }
    });

    // Clear all state
    clearDroppedLegos();
    setConnections([]);
    setTensorNetwork(null);

    // Update URL state
    encodeCanvasState([], [], hideConnectedLegs);
  };

  // Cache clearing is now handled by localStorage-based caching system
  // Caches persist across page refreshes and are managed per canvas ID

  const handleLegClick = (legoId: string, legIndex: number) => {
    // Find the lego that was clicked
    const clickedLego = droppedLegos.find((lego) => lego.instanceId === legoId);
    if (!clickedLego) return;
    const numQubits = clickedLego.parity_check_matrix[0].length / 2;
    const h = clickedLego.parity_check_matrix;
    const existingPushedLeg = clickedLego.selectedMatrixRows?.find(
      (row) => h[row][legIndex] == 1 || h[row][legIndex + numQubits] == 1
    );
    const currentOperator = existingPushedLeg
      ? h[existingPushedLeg][legIndex] == 1
        ? PauliOperator.X
        : PauliOperator.Z
      : PauliOperator.I;

    // Find available operators in parity check matrix for this leg
    const hasX = clickedLego.parity_check_matrix.some(
      (row) => row[legIndex] === 1 && row[legIndex + numQubits] === 0
    );
    const hasZ = clickedLego.parity_check_matrix.some(
      (row) => row[legIndex] === 0 && row[legIndex + numQubits] === 1
    );

    // Cycle through operators only if they exist in matrix
    let nextOperator: PauliOperator;
    switch (currentOperator) {
      case PauliOperator.I:
        nextOperator = hasX
          ? PauliOperator.X
          : hasZ
            ? PauliOperator.Z
            : PauliOperator.I;
        break;
      case PauliOperator.X:
        nextOperator = hasZ ? PauliOperator.Z : PauliOperator.I;
        break;
      case PauliOperator.Z:
        nextOperator = PauliOperator.I;
        break;
      default:
        nextOperator = PauliOperator.I;
    }

    // Find the first row in parity check matrix that matches currentOperator on legIndex
    const baseRepresentative =
      clickedLego.parity_check_matrix.find((row) => {
        if (nextOperator === PauliOperator.X) {
          return row[legIndex] === 1 && row[legIndex + numQubits] === 0;
        } else if (nextOperator === PauliOperator.Z) {
          return row[legIndex] === 0 && row[legIndex + numQubits] === 1;
        }
        return false;
      }) || new Array(2 * numQubits).fill(0);

    // Find the row index that corresponds to the baseRepresentative
    const rowIndex = clickedLego.parity_check_matrix.findIndex((row) =>
      row.every((val, idx) => val === baseRepresentative[idx])
    );

    // Update the selected rows based on the pushed legs
    const selectedRows = [rowIndex].filter((row) => row !== -1);

    // Create a new lego instance with updated properties
    const updatedLego = {
      ...clickedLego,
      selectedMatrixRows: selectedRows
    };

    // Update the selected tensornetwork state
    setTensorNetwork(new TensorNetwork([updatedLego], []));

    // Update droppedLegos by replacing the old lego with the new one
    const newDroppedLegos = droppedLegos.map((lego) =>
      lego.instanceId === legoId ? updatedLego : lego
    );
    setDroppedLegos(newDroppedLegos);
    encodeCanvasState(newDroppedLegos, connections, hideConnectedLegs);

    const selectedNetwork = findConnectedComponent(
      clickedLego,
      newDroppedLegos,
      connections
    );
    simpleAutoFlow(
      updatedLego,
      selectedNetwork,
      connections,
      setDroppedLegos,
      setTensorNetwork
    );
  };

  const fuseLegos = async (legosToFuse: DroppedLego[]) => {
    const trafo = new FuseLegos(connections, droppedLegos);
    try {
      const {
        connections: newConnections,
        droppedLegos: newDroppedLegos,
        operation: operation
      } = await trafo.apply(legosToFuse);
      operationHistory.addOperation(operation);
      setDroppedLegos(newDroppedLegos);
      setConnections(newConnections);
      setTensorNetwork(null);
      encodeCanvasState(newDroppedLegos, newConnections, hideConnectedLegs);
    } catch (error) {
      setError(`${error}`);
      return;
    }
  };

  // Helper function to push legos out of the way radially
  const makeSpace = (
    center: { x: number; y: number },
    radius: number,
    skipLegos: DroppedLego[],
    legosToCheck: DroppedLego[]
  ): DroppedLego[] => {
    const skipIds = new Set(skipLegos.map((l) => l.instanceId));
    return legosToCheck.map((lego) => {
      if (skipIds.has(lego.instanceId)) return lego;

      // Calculate distance from center
      const dx = lego.x - center.x;
      const dy = lego.y - center.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      // If lego is within radius, push it out
      if (distance < radius + 80) {
        // Increased check radius
        // Calculate angle
        const angle = Math.atan2(dy, dx);
        // Push out to radius + 100 pixels (increased buffer)
        const newX = center.x + (radius + 80) * Math.cos(angle);
        const newY = center.y + (radius + 80) * Math.sin(angle);
        return { ...lego, x: newX, y: newY };
      }

      return lego;
    });
  };

  const handlePullOutSameColoredLeg = async (lego: DroppedLego) => {
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

    try {
      // Get the new repetition code with one more leg
      const newLegoData = Legos.getDynamicLego({
        lego_id: lego.id,
        parameters: {
          d: numLegs + 1
        }
      });

      // Create the new lego with updated matrix but same position
      const newLego: DroppedLego = {
        ...lego,
        style: getLegoStyle(lego.id, numLegs + 1),
        parity_check_matrix: newLegoData.parity_check_matrix
      };

      // Create a stopper based on the lego type
      const stopperLego: DroppedLego = {
        id: lego.id === "z_rep_code" ? "stopper_x" : "stopper_z",
        name: lego.id === "z_rep_code" ? "X Stopper" : "Z Stopper",
        shortName: lego.id === "z_rep_code" ? "X" : "Z",
        description: lego.id === "z_rep_code" ? "X Stopper" : "Z Stopper",
        instanceId: (maxInstanceId + 1).toString(),
        x: lego.x + 100, // Position the stopper to the right of the lego
        y: lego.y,
        parity_check_matrix: lego.id === "z_rep_code" ? [[1, 0]] : [[0, 1]],
        logical_legs: [],
        gauge_legs: [],
        style: getLegoStyle(
          lego.id === "z_rep_code" ? "stopper_x" : "stopper_z",
          1
        ),
        selectedMatrixRows: []
      };

      // Create new connection to the stopper
      const newConnection: Connection = new Connection(
        {
          legoId: lego.instanceId,
          legIndex: numLegs // The new leg will be at index numLegs
        },
        {
          legoId: stopperLego.instanceId,
          legIndex: 0
        }
      );

      // Update the state
      const newLegos = [
        ...droppedLegos.filter((l) => l.instanceId !== lego.instanceId),
        newLego,
        stopperLego
      ];
      const newConnections = [
        ...connections.filter(
          (c) =>
            c.from.legoId !== lego.instanceId && c.to.legoId !== lego.instanceId
        ),
        ...existingConnections,
        newConnection
      ];

      setDroppedLegos(newLegos);
      setConnections(newConnections);

      // Add to operation history
      operationHistory.addOperation({
        type: "pullOutOppositeLeg",
        data: {
          legosToRemove: [lego],
          connectionsToRemove: [],
          legosToAdd: [newLego, stopperLego],
          connectionsToAdd: [newConnection]
        }
      });

      // Update URL state
      encodeCanvasState(newLegos, newConnections, hideConnectedLegs);
    } catch (error) {
      setError(`Error pulling out opposite leg: ${error}`);
    }
  };

  const handleExportSvg = () => {
    // Get the canvas panel element
    const canvasPanel = document.querySelector("#main-panel");
    if (!canvasPanel) {
      toast({
        title: "Export failed",
        description: "Could not find the canvas panel",
        status: "error",
        duration: 3000,
        isClosable: true
      });
      return;
    }

    // Create a new SVG element that will contain everything
    const combinedSvg = document.createElementNS(
      "http://www.w3.org/2000/svg",
      "svg"
    );

    // First, let's calculate the total bounding box
    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;
    // Process all SVG elements in the canvas
    const connections_svg = canvasPanel.querySelector("#connections-svg");
    const svgElements = canvasPanel.querySelectorAll("svg");
    svgElements.forEach((svg) => {
      // Skip SVGs that are marked as hidden
      if (
        svg.style.visibility === "hidden" ||
        svg.getAttribute("visibility") === "hidden"
      ) {
        return;
      }

      // Get the SVG's position relative to the canvas
      const rect = svg.getBoundingClientRect();
      const canvasRect = canvasPanel.getBoundingClientRect();
      const relativeX = rect.left - canvasRect.left;
      const relativeY = rect.top - canvasRect.top;

      // Update bounding box
      if (svg != connections_svg) {
        minX = Math.min(minX, relativeX);
        minY = Math.min(minY, relativeY);
        maxX = Math.max(maxX, relativeX + rect.width);
        maxY = Math.max(maxY, relativeY + rect.height);
      }

      // Clone the SVG content
      const clonedContent = svg.cloneNode(true) as SVGElement;

      // Remove any duplicate text elements (keep only SVG text elements)
      const textElements = clonedContent.querySelectorAll("text");
      textElements.forEach((text) => {
        const parent = text.parentElement;
        if (parent && parent.querySelector("div")) {
          // If the parent also contains a div element, this is likely a duplicate text
          text.remove();
        }
      });

      // Create a group to maintain position
      const group = document.createElementNS("http://www.w3.org/2000/svg", "g");
      group.setAttribute("transform", `translate(${relativeX}, ${relativeY})`);

      // Move all children to the group
      while (clonedContent.firstChild) {
        group.appendChild(clonedContent.firstChild);
      }

      combinedSvg.appendChild(group);
    });

    // Add padding to bounding box
    const padding = 50;
    const width = maxX - minX + 2 * padding;
    const height = maxY - minY + 2 * padding;

    // Set the viewBox and size of the combined SVG
    combinedSvg.setAttribute(
      "viewBox",
      `${minX - padding} ${minY - padding} ${width} ${height}`
    );
    combinedSvg.setAttribute("width", width.toString());
    combinedSvg.setAttribute("height", height.toString());
    combinedSvg.setAttribute("xmlns", "http://www.w3.org/2000/svg");

    // Add XML declaration and create final SVG content
    const svgContent =
      '<?xml version="1.0" encoding="UTF-8" standalone="no"?>\n' +
      combinedSvg.outerHTML;

    // Create and trigger download
    const blob = new Blob([svgContent], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "quantum_lego_network.svg";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast({
      title: "Export successful",
      description: "SVG file has been downloaded",
      status: "success",
      duration: 3000,
      isClosable: true
    });
  };

  function handleTitleKeyDown(
    event: React.KeyboardEvent<HTMLDivElement>
  ): void {
    event.stopPropagation();
  }

  const handleRuntimeToggle = () => {
    const isLocalRuntime = RuntimeConfigService.isLocalRuntime();
    if (isLocalRuntime) {
      RuntimeConfigService.switchToCloud();
    } else {
      const currentConfig = RuntimeConfigService.getCurrentConfig();
      openRuntimeConfigDialog(isLocalRuntime, currentConfig || undefined);
    }
  };

  const handleExportPythonCode = () => {
    if (!tensorNetwork) return;
    const code = tensorNetwork.generateConstructionCode();
    setPythonCode(code);
    setShowPythonCodeModal(true);
  };

  return (
    <>
      <KeyboardHandler
        hideConnectedLegs={hideConnectedLegs}
        tensorNetwork={tensorNetwork}
        operationHistory={operationHistory}
        newInstanceId={newInstanceId}
        onSetTensorNetwork={(network) =>
          setTensorNetwork(network as TensorNetwork | null)
        }
        onSetAltKeyPressed={setAltKeyPressed}
        onEncodeCanvasState={encodeCanvasState}
        onUndo={handleUndo}
        onRedo={handleRedo}
        onSetError={setError}
        onFuseLegos={fuseLegos}
        onPullOutSameColoredLeg={handlePullOutSameColoredLeg}
        onCreateNetworkSignature={createNetworkSignature}
        onSetCanvasDragState={(state) =>
          setCanvasDragState((prev) => ({
            ...prev,
            ...(state as Partial<typeof prev>)
          }))
        }
        onToast={(props) =>
          toast({
            ...props,
            status: props.status as "success" | "error" | "warning" | "info"
          })
        }
      />

      <VStack spacing={0} align="stretch" h="100vh">
        {fatalError &&
          (() => {
            throw fatalError;
          })()}
        {/* Main Content */}
        <Box
          ref={panelGroupContainerRef}
          flex={1}
          position="relative"
          overflow="hidden"
        >
          {/* Collapsed Panel Handle
          {isLegoPanelCollapsed && (
            <Box
              position="absolute"
              left={0}
              top={0}
              bottom={0}
              width="8px"
              bg={useColorModeValue("gray.200", "gray.600")}
              cursor="col-resize"
              zIndex={10}
              transition="background-color 0.2s"
              _hover={{ bg: "blue.500" }}
              onMouseDown={(e) => {
                e.preventDefault();
                setIsLegoPanelCollapsed(false);
              }}
              display="flex"
              alignItems="center"
              justifyContent="center"
            >
              <Icon
                as={FiChevronRight}
                boxSize={3}
                color={useColorModeValue("gray.600", "gray.300")}
                _hover={{ color: "white" }}
              />
            </Box>
          )} */}
          <PanelGroup direction="horizontal">
            {/* Left Panel */}
            <LeftPanel
              leftPanelRef={
                leftPanelRef as React.RefObject<ImperativePanelHandle>
              }
              legoPanelSizes={legoPanelSizes}
              isLegoPanelCollapsed={isLegoPanelCollapsed}
              setIsLegoPanelCollapsed={handleSetLegoPanelCollapsed}
              handleDragStart={handleDragStart}
              isUserLoggedIn={isUserLoggedIn}
            />
            <ResizeHandle id="lego-panel-resize-handle" />

            {/* Main Content */}
            <Panel id="main-panel" defaultSize={65} minSize={5} order={2}>
              <Box h="100%" display="flex" flexDirection="column" p={4}>
                {/* Canvas with overlay controls */}
                <Box
                  ref={canvasRef}
                  flex={1}
                  bg="gray.100"
                  borderRadius="lg"
                  boxShadow="inner"
                  position="relative"
                  onDragOver={handleDragOver}
                  onDrop={handleDrop}
                  onDragEnd={handleDragEnd}
                  onMouseMove={handleCanvasMouseMove}
                  onWheel={handleCanvasMouseWheel}
                  onMouseUp={handleCanvasMouseUp}
                  onMouseLeave={handleCanvasMouseLeave}
                  onClick={handleCanvasClick}
                  onMouseDown={handleCanvasMouseDown}
                  style={{
                    userSelect: "none",
                    overflow: "hidden",
                    cursor: altKeyPressed
                      ? canvasDragState.isDragging
                        ? "grabbing"
                        : "grab"
                      : "default"
                  }}
                >
                  {/* Top-left three-dots menu */}
                  <Box
                    position="absolute"
                    top={2}
                    left={2}
                    zIndex={20}
                    bg={useColorModeValue("white", "gray.800")}
                    borderRadius="md"
                    boxShadow="md"
                    p={1}
                  >
                    <Menu>
                      {({ isOpen }) => (
                        <>
                          <MenuButton
                            as={Button}
                            variant="ghost"
                            size="sm"
                            minW="auto"
                            p={2}
                          >
                            <Icon as={FiMoreVertical} boxSize={4} />
                          </MenuButton>
                          {isOpen && (
                            <MenuList>
                              <MenuItem
                                onClick={() => {
                                  if (tensorNetwork) {
                                    openWeightEnumeratorDialog(
                                      tensorNetwork,
                                      connections
                                    );
                                  }
                                }}
                                isDisabled={!tensorNetwork || !currentUser}
                                title={
                                  !tensorNetwork
                                    ? "No network to calculate weight enumerator"
                                    : !currentUser
                                      ? "Please sign in to calculate weight enumerator"
                                      : ""
                                }
                              >
                                Calculate Weight Enumerator
                              </MenuItem>
                              <MenuItem
                                onClick={handleExportPythonCode}
                                isDisabled={!tensorNetwork}
                              >
                                Export network as Python code
                              </MenuItem>
                              <MenuDivider />
                              <MenuItemOption
                                onClick={() => {
                                  setHideConnectedLegs(!hideConnectedLegs);
                                  encodeCanvasState(
                                    droppedLegos,
                                    connections,
                                    !hideConnectedLegs
                                  );
                                }}
                                isChecked={hideConnectedLegs}
                              >
                                Hide connected legs
                              </MenuItemOption>
                              <MenuItemOption
                                isChecked={isLegoPanelCollapsed}
                                onClick={() => {
                                  if (leftPanelRef.current) {
                                    if (isLegoPanelCollapsed) {
                                      leftPanelRef.current.expand();
                                    } else {
                                      leftPanelRef.current.collapse();
                                    }
                                  }
                                }}
                              >
                                Hide Building Blocks Panel
                              </MenuItemOption>
                              <MenuItemOption
                                isChecked={isTaskPanelCollapsed}
                                onClick={() => {
                                  setIsTaskPanelCollapsed(
                                    !isTaskPanelCollapsed
                                  );
                                }}
                              >
                                Hide Task Panel
                              </MenuItemOption>
                              <MenuItem
                                onClick={() => {
                                  const rect =
                                    canvasRef.current?.getBoundingClientRect();
                                  if (!rect) return;
                                  const centerX = rect.width / 2;
                                  const centerY = rect.height / 2;
                                  const scale = 1 / zoomLevel;
                                  const rescaledLegos = droppedLegos.map(
                                    (lego) => ({
                                      ...lego,
                                      x: (lego.x - centerX) * scale + centerX,
                                      y: (lego.y - centerY) * scale + centerY
                                    })
                                  );
                                  setDroppedLegos(rescaledLegos);
                                  setZoomLevel(1);
                                  encodeCanvasState(
                                    rescaledLegos,
                                    connections,
                                    hideConnectedLegs
                                  );
                                }}
                                isDisabled={zoomLevel === 1}
                              >
                                Reset zoom
                              </MenuItem>
                              <MenuDivider />
                              <MenuItem onClick={handleClearAll}>
                                Remove all
                              </MenuItem>
                              <MenuItem
                                onClick={() => {
                                  const clearedLegos = droppedLegos.map(
                                    (lego) => ({
                                      ...lego,
                                      selectedMatrixRows: []
                                    })
                                  );
                                  setDroppedLegos(clearedLegos);
                                  encodeCanvasState(
                                    clearedLegos,
                                    connections,
                                    hideConnectedLegs
                                  );
                                }}
                                isDisabled={
                                  !droppedLegos.some(
                                    (lego) =>
                                      lego.selectedMatrixRows &&
                                      lego.selectedMatrixRows.length > 0
                                  )
                                }
                              >
                                Clear highlights
                              </MenuItem>
                              <MenuDivider />
                              <MenuItem onClick={handleRuntimeToggle}>
                                <HStack spacing={2}>
                                  <Icon as={TbPlugConnected} />
                                  <Text>
                                    Switch runtime to{" "}
                                    {RuntimeConfigService.isLocalRuntime()
                                      ? "cloud"
                                      : "local"}
                                  </Text>
                                </HStack>
                              </MenuItem>
                              <MenuDivider />
                              <MenuItem onClick={handleExportSvg}>
                                Export canvas as SVG...
                              </MenuItem>
                            </MenuList>
                          )}
                        </>
                      )}
                    </Menu>
                  </Box>
                  {/* Top-center title (contextual) */}
                  <Box
                    position="absolute"
                    top={2}
                    left="50%"
                    transform="translateX(-50%)"
                    zIndex={15}
                    opacity={0.2}
                    _hover={{ opacity: 1 }}
                    transition="opacity 0.2s"
                    bg={useColorModeValue("white", "gray.800")}
                    borderRadius="md"
                    boxShadow="md"
                    px={3}
                    py={1}
                  >
                    <Editable
                      value={currentTitle}
                      onChange={handleTitleChange}
                      onKeyDown={handleTitleKeyDown}
                    >
                      <EditablePreview fontSize="sm" />
                      <EditableInput fontSize="sm" />
                    </Editable>
                  </Box>
                  {/* Top-right controls */}
                  <Box
                    position="absolute"
                    top={2}
                    right={2}
                    zIndex={20}
                    display="flex"
                    gap={2}
                  >
                    {/* User menu */}
                    <Box
                      bg="transparent"
                      borderRadius="md"
                      p={1}
                      opacity={0.8}
                      _hover={{ opacity: 1 }}
                      transition="opacity 0.2s"
                    >
                      <UserMenu
                        user={currentUser}
                        onSignIn={handleAuthDialogOpen}
                      />
                    </Box>
                  </Box>
                  <ConnectionsLayer
                    hideConnectedLegs={hideConnectedLegs}
                    legDragState={legDragState}
                    hoveredConnection={hoveredConnection}
                    onConnectionDoubleClick={handleConnectionDoubleClick}
                  />
                  {/* Selection Manager */}
                  <SelectionManager
                    ref={selectionManagerRef}
                    droppedLegos={droppedLegos}
                    connections={connections}
                    tensorNetwork={tensorNetwork}
                    selectionBox={selectionBox}
                    onSelectionBoxChange={setSelectionBox}
                    onTensorNetworkChange={setTensorNetwork}
                    onCreateNetworkSignature={createNetworkSignature}
                    canvasRef={canvasRef}
                  />
                  <LegosLayer
                    droppedLegos={droppedLegos}
                    legDragState={legDragState}
                    dragState={dragState}
                    connections={connections}
                    tensorNetwork={tensorNetwork}
                    hideConnectedLegs={hideConnectedLegs}
                    onLegMouseDown={handleLegMouseDown}
                    onLegoMouseDown={handleLegoMouseDown}
                    onLegoClick={handleLegoClick}
                    onLegClick={handleLegClick}
                  />
                </Box>
              </Box>
            </Panel>

            <ResizeHandle id="details-panel-resize-handle" />

            {/* Right Panel */}
            <Panel id="details-panel" defaultSize={20} minSize={5} order={3}>
              <DetailsPanel
                handlePullOutSameColoredLeg={handlePullOutSameColoredLeg}
                tensorNetwork={tensorNetwork}
                setTensorNetwork={setTensorNetwork}
                setError={setError}
                fuseLegos={fuseLegos}
                operationHistory={operationHistory}
                encodeCanvasState={encodeCanvasState}
                hideConnectedLegs={hideConnectedLegs}
                makeSpace={(
                  center: { x: number; y: number },
                  radius: number,
                  skipLegos: DroppedLego[],
                  legosToCheck: DroppedLego[]
                ) => makeSpace(center, radius, skipLegos, legosToCheck)}
                toast={toast}
                user={currentUser}
                parityCheckMatrixCache={parityCheckMatrixCache}
                setParityCheckMatrixCache={setParityCheckMatrixCache}
                weightEnumeratorCache={weightEnumeratorCache}
                setWeightEnumeratorCache={setWeightEnumeratorCache}
              />
            </Panel>
          </PanelGroup>
          {/* Error Panel */}
          <ErrorPanel error={error} onDismiss={() => setError("")} />
        </Box>

        <FloatingTaskPanel
          user={currentUser}
          onError={setError}
          onClose={() => setIsTaskPanelCollapsed(true)}
          isOpen={!isTaskPanelCollapsed}
        />

        {isDynamicLegoDialogOpen && (
          <DynamicLegoDialog
            isOpen={isDynamicLegoDialogOpen}
            onClose={() => {
              setIsDynamicLegoDialogOpen(false);
              setSelectedDynamicLego(null);
              setPendingDropPosition(null);
            }}
            onSubmit={handleDynamicLegoSubmit}
            legoId={selectedDynamicLego?.id || ""}
            parameters={selectedDynamicLego?.parameters || {}}
          />
        )}
        {/* Network dialogs managed by ModalRoot */}
        <ModalRoot
          operationHistory={operationHistory}
          stateSerializer={stateSerializerRef.current}
          hideConnectedLegs={hideConnectedLegs}
          newInstanceId={newInstanceId}
          currentUser={currentUser}
          setTensorNetwork={setTensorNetwork}
          setError={setError}
          weightEnumeratorCache={weightEnumeratorCache}
        />
      </VStack>

      {showPythonCodeModal && (
        <PythonCodeModal
          isOpen={showPythonCodeModal}
          onClose={() => setShowPythonCodeModal(false)}
          code={pythonCode}
          title="Python Network Construction Code"
        />
      )}
    </>
  );
};

export default LegoStudioView;
