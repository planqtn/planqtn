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
import { useCallback, useEffect, useRef, useState, memo } from "react";
import {
  Panel,
  PanelGroup,
  ImperativePanelHandle
} from "react-resizable-panels";
import axios, { AxiosError } from "axios";
import { getLegoStyle } from "./LegoStyles";
import ErrorPanel from "./components/ErrorPanel";
import BuildingBlocksPanel from "./components/BuildingBlocksPanel.tsx";
import {
  CanvasDragState,
  Connection,
  DragState,
  DroppedLego,
  GroupDragState,
  LegDragState,
  LegoPiece,
  PauliOperator,
  SelectionBoxState
} from "./lib/types";
import { TensorNetwork } from "./lib/TensorNetwork";

import DetailsPanel from "./components/DetailsPanel";
import { ResizeHandle } from "./components/ResizeHandle";
import { CanvasStateSerializer } from "./lib/CanvasStateSerializer";
import {
  calculateLegPosition,
  DroppedLegoDisplay
} from "./components/DroppedLegoDisplay";
import { DynamicLegoDialog } from "./components/DynamicLegoDialog";
import { TannerDialog } from "./components/TannerDialog";
import { OperationHistory } from "./lib/OperationHistory";
import { FuseLegos } from "./transformations/FuseLegos";
import { InjectTwoLegged } from "./transformations/InjectTwoLegged";
import { AddStopper } from "./transformations/AddStopper";
import { findConnectedComponent } from "./lib/TensorNetwork";
import { randomPlankterName } from "./lib/RandomPlankterNames";
import { useLocation, useNavigate } from "react-router-dom";
import { UserMenu } from "./components/UserMenu";
import AuthDialog from "./components/AuthDialog";
import { userContextSupabase } from "./supabaseClient";
import { User } from "@supabase/supabase-js";
import { simpleAutoFlow } from "./transformations/AutoPauliFlow";
import { Legos } from "./lib/Legos";
import { config, getApiUrl } from "./config";
import { getAccessToken } from "./lib/auth";
import { RuntimeConfigDialog } from "./components/RuntimeConfigDialog";
import { TbPlugConnected } from "react-icons/tb";
import LoadingModal from "./components/LoadingModal.tsx";
import { checkSupabaseStatus, getAxiosErrorMessage } from "./lib/errors.ts";
import { FiMoreVertical } from "react-icons/fi";
import WeightEnumeratorCalculationDialog from "./components/WeightEnumeratorCalculationDialog";
import { TensorNetworkLeg } from "./lib/TensorNetwork";
import { LegoServerPayload } from "./lib/types";
import TaskPanel from "./components/TaskPanel";

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
  legos: LegoPiece[];
  handleDragStart: (e: React.DragEvent<HTMLLIElement>, lego: LegoPiece) => void;
  setIsCssTannerDialogOpen: (open: boolean) => void;
  setIsTannerDialogOpen: (open: boolean) => void;
  setIsMspDialogOpen: (open: boolean) => void;
  currentUser: User | null;
}>(
  ({
    leftPanelRef,
    legoPanelSizes,
    isLegoPanelCollapsed,
    setIsLegoPanelCollapsed,
    legos,
    handleDragStart,
    setIsCssTannerDialogOpen,
    setIsTannerDialogOpen,
    setIsMspDialogOpen,
    currentUser
  }) => {
    return (
      <Panel
        ref={leftPanelRef}
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
            legos={legos}
            onDragStart={handleDragStart}
            onLegoSelect={() => {
              // Handle lego selection if needed
            }}
            onCreateCssTanner={() => setIsCssTannerDialogOpen(true)}
            onCreateTanner={() => setIsTannerDialogOpen(true)}
            onCreateMsp={() => setIsMspDialogOpen(true)}
            isUserLoggedIn={!!currentUser}
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
  const [legos, setLegos] = useState<LegoPiece[]>([]);
  const [droppedLegos, setDroppedLegos] = useState<DroppedLego[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
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
  const stateSerializerRef = useRef<CanvasStateSerializer>(
    new CanvasStateSerializer([])
  );
  const [tensorNetwork, setTensorNetwork] = useState<TensorNetwork | null>(
    null
  );
  const [operationHistory] = useState<OperationHistory>(
    new OperationHistory([])
  );
  const [mousePosition, setMousePosition] = useState<{
    x: number;
    y: number;
  } | null>(null);

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
    Map<string, number[][]>
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
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedDynamicLego, setSelectedDynamicLego] =
    useState<LegoPiece | null>(null);
  const [pendingDropPosition, setPendingDropPosition] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const [isCssTannerDialogOpen, setIsCssTannerDialogOpen] = useState(false);
  const [isTannerDialogOpen, setIsTannerDialogOpen] = useState(false);
  const [isMspDialogOpen, setIsMspDialogOpen] = useState(false);
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

  const [showCustomLegoDialog, setShowCustomLegoDialog] = useState(false);
  const [customLegoPosition, setCustomLegoPosition] = useState({ x: 0, y: 0 });
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authDialogOpen, setAuthDialogOpen] = useState(false);
  const [isRuntimeConfigOpen, setIsRuntimeConfigOpen] = useState(false);
  const [isLocalRuntime] = useState(() => {
    const isActive = localStorage.getItem("runtimeConfigActive");
    return isActive === "true";
  });
  const [isNetworkLoading, setIsNetworkLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState("");
  const [supabaseStatus, setSupabaseStatus] = useState<{
    isHealthy: boolean;
    message: string;
  } | null>(null);
  const [showWeightEnumeratorDialog, setShowWeightEnumeratorDialog] =
    useState(false);

  // Inside the App component, add this line near the other hooks
  const toast = useToast();
  const borderColor = useColorModeValue("gray.200", "gray.600");

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

  const newInstanceId = (currentLegos: DroppedLego[]): string => {
    const maxInstanceId =
      currentLegos.length > 0
        ? Math.max(...currentLegos.map((lego) => parseInt(lego.instanceId)))
        : 0;
    return String(maxInstanceId + 1);
  };

  // Update the serializer when legos change
  useEffect(() => {
    stateSerializerRef.current.updateLegos(legos);
  }, [legos]);

  const encodeCanvasState = useCallback(
    (
      pieces: DroppedLego[],
      conns: Connection[],
      hideConnectedLegs: boolean
    ) => {
      // console.log("Encoding droppedLegos", pieces, "connections", conns);
      // console.log(new Error().stack);
      // Print call stack for debugging
      // console.log('Canvas state encoding call stack:', new Error("just debugging").stack);
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
          const parityCache = new Map<string, number[][]>(
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

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLegos(Legos.listAvailableLegos());
      } catch (error) {
        setError("Failed to load legos");
        console.error("Error:", error);
      }
    };

    fetchData();
  }, []);

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

  // Add mouse position tracking
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
        setMousePosition({
          x: e.clientX - canvasRect.left,
          y: e.clientY - canvasRect.top
        });
      } else {
        setMousePosition(null);
      }
    };

    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, []);

  const handleDragStart = (
    e: React.DragEvent<HTMLLIElement>,
    lego: LegoPiece
  ) => {
    if (lego.id === "custom") {
      // Store the drop position for the custom lego
      const rect = e.currentTarget.getBoundingClientRect();
      setCustomLegoPosition({
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2
      });
      // Set the draggedLego state for custom legos
      const draggedLego: DroppedLego = {
        ...lego,
        instanceId: newInstanceId(droppedLegos),
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
        instanceId: newInstanceId(droppedLegos),
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
        style: getLegoStyle(lego.id, lego.parity_check_matrix[0].length / 2),
        selectedMatrixRows: []
      };
      setDraggedLego(draggedLego);
    }
  };

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

    console.log("draggedLego", draggedLego);
    if (draggedLego.id === "custom") {
      setCustomLegoPosition(dropPosition);
      setShowCustomLegoDialog(true);
      return;
    }

    // Find the closest dangling leg if we're dropping a stopper
    const success = handleDropStopperOnConnection(dropPosition, draggedLego);
    if (success) return;

    const numLegs = draggedLego.parity_check_matrix[0].length / 2;

    if (draggedLego.is_dynamic) {
      setSelectedDynamicLego(draggedLego);
      setPendingDropPosition({ x: dropPosition.x, y: dropPosition.y });
      setIsDialogOpen(true);
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
      instanceId: newInstanceId(droppedLegos),
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
        setCustomLegoPosition({ x, y });
        setShowCustomLegoDialog(true);
      } else {
        setDroppedLegos((prev) => [...prev, newLego]);
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

      const instanceId = newInstanceId(droppedLegos);
      const numLegs = dynamicLego.parity_check_matrix[0].length / 2;
      const newLego = {
        ...dynamicLego,
        x: pendingDropPosition.x,
        y: pendingDropPosition.y,
        instanceId,
        style: getLegoStyle(dynamicLego.id, numLegs),
        selectedMatrixRows: []
      };
      setDroppedLegos((prev) => [...prev, newLego]);
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
      setIsDialogOpen(false);
      setSelectedDynamicLego(null);
      setPendingDropPosition(null);
    }
  };
  const handleClone = (lego: DroppedLego, clientX: number, clientY: number) => {
    // Check if we're cloning multiple legos
    const legosToClone = tensorNetwork?.legos || [lego];

    // Get a single starting ID for all new legos
    const startingId = parseInt(newInstanceId(droppedLegos));

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
    setDroppedLegos((prev) => [...prev, ...newLegos]);
    setConnections((prev) => [...prev, ...newConnections]);

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
        setSelectionBox({
          isSelecting: true,
          startX: x,
          startY: y,
          currentX: x,
          currentY: y,
          justFinished: false
        });
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

  // Helper function to handle selection box logic
  const handleSelectionBoxUpdate = (
    left: number,
    right: number,
    top: number,
    bottom: number,
    e: React.MouseEvent
  ) => {
    // Find Legos within the selection box
    const selectedLegos = droppedLegos.filter((lego) => {
      return (
        lego.x >= left && lego.x <= right && lego.y >= top && lego.y <= bottom
      );
    });

    // Update selection state based on the selected Legos
    if (selectedLegos.length === 1) {
      if (e.ctrlKey || e.metaKey) {
        // If Ctrl is pressed, add to existing selection
        if (tensorNetwork) {
          const newLegos = [...tensorNetwork.legos, ...selectedLegos];
          const newConnections = connections.filter(
            (conn) =>
              newLegos.some((l) => l.instanceId === conn.from.legoId) &&
              newLegos.some((l) => l.instanceId === conn.to.legoId)
          );
          const newNetwork = new TensorNetwork(newLegos, newConnections);
          newNetwork.signature = createNetworkSignature(newNetwork);
          setTensorNetwork(newNetwork);
        } else {
          const newNetwork = new TensorNetwork(selectedLegos, []);
          newNetwork.signature = createNetworkSignature(newNetwork);
          setTensorNetwork(newNetwork);
        }
      } else {
        setTensorNetwork(new TensorNetwork(selectedLegos, []));
      }
    } else if (selectedLegos.length > 1) {
      if (e.ctrlKey || e.metaKey) {
        // If Ctrl is pressed, add to existing selection
        if (tensorNetwork) {
          const newLegos = [...tensorNetwork.legos, ...selectedLegos];
          const newConnections = connections.filter(
            (conn) =>
              newLegos.some((l) => l.instanceId === conn.from.legoId) &&
              newLegos.some((l) => l.instanceId === conn.to.legoId)
          );
          const newNetwork = new TensorNetwork(newLegos, newConnections);
          newNetwork.signature = createNetworkSignature(newNetwork);
          setTensorNetwork(newNetwork);
        } else {
          const selectedLegoIds = new Set(
            selectedLegos.map((lego) => lego.instanceId)
          );
          const internalConnections = connections.filter(
            (conn) =>
              selectedLegoIds.has(conn.from.legoId) &&
              selectedLegoIds.has(conn.to.legoId)
          );
          const newNetwork = new TensorNetwork(
            selectedLegos,
            internalConnections
          );
          newNetwork.signature = createNetworkSignature(newNetwork);
          setTensorNetwork(newNetwork);
        }
      } else {
        // Create a tensor network from the selected legos
        const selectedLegoIds = new Set(
          selectedLegos.map((lego) => lego.instanceId)
        );
        const internalConnections = connections.filter(
          (conn) =>
            selectedLegoIds.has(conn.from.legoId) &&
            selectedLegoIds.has(conn.to.legoId)
        );
        const newNetwork = new TensorNetwork(
          selectedLegos,
          internalConnections
        );
        newNetwork.signature = createNetworkSignature(newNetwork);
        setTensorNetwork(newNetwork);
      }
    } else {
      if (!(e.ctrlKey || e.metaKey)) {
        setTensorNetwork(null);
      }
    }
  };

  const handleCanvasMouseMove = (e: React.MouseEvent) => {
    e.preventDefault();
    const rect = canvasRef.current?.getBoundingClientRect();

    if (!rect) return;

    // Handle selection box dragging
    if (selectionBox.isSelecting) {
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      setSelectionBox((prev) => ({
        ...prev,
        currentX: x,
        currentY: y
      }));

      // Calculate selection box bounds
      const left = Math.min(selectionBox.startX, x);
      const right = Math.max(selectionBox.startX, x);
      const top = Math.min(selectionBox.startY, y);
      const bottom = Math.max(selectionBox.startY, y);

      handleSelectionBoxUpdate(left, right, top, bottom, e);
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
        tensorNetwork!.legos = updatedLegos.filter((lego) =>
          groupDragState.legoInstanceIds.includes(lego.instanceId)
        );
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

    // Handle selection box end
    if (selectionBox.isSelecting) {
      const left = Math.min(selectionBox.startX, selectionBox.currentX);
      const right = Math.max(selectionBox.startX, selectionBox.currentX);
      const top = Math.min(selectionBox.startY, selectionBox.currentY);
      const bottom = Math.max(selectionBox.startY, selectionBox.currentY);

      handleSelectionBoxUpdate(left, right, top, bottom, e);

      setSelectionBox((prev) => ({
        ...prev,
        isSelecting: false,
        justFinished: true
      }));
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

              setConnections((prev) => {
                const newConnections = [...prev, newConnection];
                encodeCanvasState(
                  droppedLegos,
                  newConnections,
                  hideConnectedLegs
                );
                return newConnections;
              });

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

  // Update keyboard event listener for both Ctrl+Z, Ctrl+Y and Delete
  useEffect(() => {
    const handleKeyDown = async (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "c" && tensorNetwork) {
        e.preventDefault();
        const networkToCopy = tensorNetwork;

        const jsonStr = JSON.stringify(networkToCopy);
        navigator.clipboard
          .writeText(jsonStr)
          .then(() => {
            toast({
              title: "Copied to clipboard",
              description: "Network data has been copied",
              status: "success",
              duration: 2000,
              isClosable: true
            });
          })
          .catch((error) => {
            toast({
              title: "Copy failed",
              description: "Failed to copy network data (" + error + ")",
              status: "error",
              duration: 2000,
              isClosable: true
            });
          });
      } else if ((e.ctrlKey || e.metaKey) && e.key === "v") {
        e.preventDefault();
        try {
          const clipText = await navigator.clipboard.readText();
          const pastedData = JSON.parse(clipText);

          if (
            pastedData.legos &&
            Array.isArray(pastedData.legos) &&
            pastedData.legos.length > 0
          ) {
            // Get canvas element and its dimensions
            const canvasPanel = document.querySelector("#main-panel");
            if (!canvasPanel) return;

            const canvasRect = canvasPanel.getBoundingClientRect();

            // Determine drop position
            let dropX: number, dropY: number;

            if (mousePosition) {
              // Use current mouse position
              dropX = mousePosition.x;
              dropY = mousePosition.y;
            } else {
              // Use random position around canvas center
              const centerX = canvasRect.width / 2;
              const centerY = canvasRect.height / 2;
              const randomOffset = 50; // pixels

              dropX = centerX + (Math.random() * 2 - 1) * randomOffset;
              dropY = centerY + (Math.random() * 2 - 1) * randomOffset;
            }

            // Create a mapping from old instance IDs to new ones
            const startingId = parseInt(newInstanceId(droppedLegos));
            const instanceIdMap = new Map<string, string>();

            // Create new legos with new instance IDs
            const newLegos = pastedData.legos.map(
              (l: DroppedLego, idx: number) => {
                const newId = String(startingId + idx);
                instanceIdMap.set(l.instanceId, newId);
                return {
                  ...l,
                  instanceId: newId,
                  x: l.x + dropX - pastedData.legos[0].x, // Maintain relative positions
                  y: l.y + dropY - pastedData.legos[0].y,
                  style: getLegoStyle(l.id, l.parity_check_matrix[0].length / 2)
                };
              }
            );

            // Create new connections with updated instance IDs
            const newConnections = (pastedData.connections || []).map(
              (conn: Connection) => {
                return new Connection(
                  {
                    legoId: instanceIdMap.get(conn.from.legoId)!,
                    legIndex: conn.from.legIndex
                  },
                  {
                    legoId: instanceIdMap.get(conn.to.legoId)!,
                    legIndex: conn.to.legIndex
                  }
                );
              }
            );

            // Update state
            setDroppedLegos((prev) => [...prev, ...newLegos]);
            setConnections((prev) => [...prev, ...newConnections]);

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
              [...droppedLegos, ...newLegos],
              [...connections, ...newConnections],
              hideConnectedLegs
            );

            toast({
              title: "Paste successful",
              description: `Pasted ${newLegos.length} lego${
                newLegos.length > 1 ? "s" : ""
              }`,
              status: "success",
              duration: 2000,
              isClosable: true
            });
          }
        } catch (err) {
          toast({
            title: "Paste failed",
            description: "Invalid network data in clipboard (" + err + ")",
            status: "error",
            duration: 2000,
            isClosable: true
          });
        }
      } else if ((e.ctrlKey || e.metaKey) && e.key === "z") {
        e.preventDefault();
        handleUndo();
      } else if (
        (e.ctrlKey || e.metaKey) &&
        (e.key === "y" || (e.shiftKey && e.key === "Z"))
      ) {
        e.preventDefault();
        handleRedo();
      } else if ((e.ctrlKey || e.metaKey) && e.key === "a") {
        e.preventDefault();
        if (droppedLegos.length > 0) {
          // Create a tensor network from all legos
          const selectedLegoIds = new Set(
            droppedLegos.map((lego) => lego.instanceId)
          );

          // Collect only internal connections between selected legos
          const internalConnections = connections.filter(
            (conn) =>
              selectedLegoIds.has(conn.from.legoId) &&
              selectedLegoIds.has(conn.to.legoId)
          );

          const tensorNetwork = new TensorNetwork(
            droppedLegos,
            internalConnections
          );

          tensorNetwork.signature = createNetworkSignature(tensorNetwork);

          setTensorNetwork(tensorNetwork);
        }
      } else if (e.key === "Delete" || e.key === "Backspace") {
        // Handle deletion of selected legos
        let legosToRemove: DroppedLego[] = [];

        if (tensorNetwork) {
          legosToRemove = tensorNetwork.legos;
        }

        if (legosToRemove.length > 0) {
          // Get all connections involving the legos to be removed
          const connectionsToRemove = connections.filter((conn) =>
            legosToRemove.some(
              (lego) =>
                conn.from.legoId === lego.instanceId ||
                conn.to.legoId === lego.instanceId
            )
          );

          // Add to history
          operationHistory.addOperation({
            type: "remove",
            data: {
              legosToRemove: legosToRemove,
              connectionsToRemove: connectionsToRemove
            }
          });

          // Remove the connections and legos
          setConnections((prev) =>
            prev.filter(
              (conn) =>
                !legosToRemove.some(
                  (lego) =>
                    conn.from.legoId === lego.instanceId ||
                    conn.to.legoId === lego.instanceId
                )
            )
          );
          setDroppedLegos((prev) =>
            prev.filter(
              (lego) =>
                !legosToRemove.some((l) => l.instanceId === lego.instanceId)
            )
          );

          // Clear selection states
          setTensorNetwork(null);

          // Update URL state
          encodeCanvasState(
            droppedLegos.filter(
              (lego) =>
                !legosToRemove.some((l) => l.instanceId === lego.instanceId)
            ),
            connections.filter(
              (conn) =>
                !legosToRemove.some(
                  (l) =>
                    conn.from.legoId === l.instanceId ||
                    conn.to.legoId === l.instanceId
                )
            ),
            hideConnectedLegs
          );
        }
      } else if (e.key === "Escape") {
        // Dismiss error message when Escape is pressed
        setError("");
      } else if (e.key === "Alt") {
        e.preventDefault();
        setAltKeyPressed(true);
      } else if (e.key === "f") {
        e.preventDefault();
        if (tensorNetwork) {
          fuseLegos(tensorNetwork.legos);
        }
      } else if (e.key === "p") {
        e.preventDefault();
        if (
          tensorNetwork &&
          (tensorNetwork.legos[0].id === "x_rep_code" ||
            tensorNetwork.legos[0].id === "z_rep_code")
        ) {
          handlePullOutSameColoredLeg(tensorNetwork.legos[0]);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    handleUndo,
    handleRedo,
    tensorNetwork,
    connections,
    droppedLegos,
    operationHistory.addOperation,
    encodeCanvasState,
    hideConnectedLegs,
    mousePosition
  ]);

  useEffect(() => {
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === "Alt") {
        setAltKeyPressed(false);
      }
    };
    window.addEventListener("keyup", handleKeyUp);
    return () => window.removeEventListener("keyup", handleKeyUp);
  }, []);

  useEffect(() => {
    const handleBlur = () => {
      setCanvasDragState((prev) => ({
        ...prev,
        isDragging: false
      }));
      setAltKeyPressed(false);
    };
    window.addEventListener("blur", handleBlur);
    return () => window.removeEventListener("blur", handleBlur);
  }, []);

  useEffect(() => {
    const handleFocus = () => {
      setCanvasDragState((prev) => ({
        ...prev,
        isDragging: false
      }));
      setAltKeyPressed(false);
    };

    window.addEventListener("focus", handleFocus);
    return () => window.removeEventListener("focus", handleFocus);
  }, []);

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
        setIsNetworkLoading(true);
        setLoadingMessage(
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
        setAuthDialogOpen(true);
        return;
      }

      // If no connection issues, open the auth dialog normally
      setAuthDialogOpen(true);
    } finally {
      setIsNetworkLoading(false);
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
    setConnections((prev) => {
      const newConnections = prev.filter(
        (conn) =>
          !(
            conn.from.legoId === connection.from.legoId &&
            conn.from.legIndex === connection.from.legIndex &&
            conn.to.legoId === connection.to.legoId &&
            conn.to.legIndex === connection.to.legIndex
          )
      );
      encodeCanvasState(droppedLegos, newConnections, hideConnectedLegs);
      return newConnections;
    });
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
    setDroppedLegos([]);
    setConnections([]);
    setTensorNetwork(null);

    // Update URL state
    encodeCanvasState([], [], hideConnectedLegs);
  };

  // Cache clearing is now handled by localStorage-based caching system
  // Caches persist across page refreshes and are managed per canvas ID

  const requestTensorNetwork = async (
    matrix: number[][],
    networkType: string
  ) => {
    setIsNetworkLoading(true);
    setLoadingMessage(`Generating network...`);

    try {
      const acessToken = await getAccessToken();
      const key = !acessToken ? config.runtimeStoreAnonKey : acessToken;
      const response = await axios.post(
        getApiUrl("tensorNetwork"),
        {
          matrix,
          networkType: networkType,
          start_node_index: newInstanceId(droppedLegos)
        },
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${key}`
          }
        }
      );
      return response;
    } finally {
      setIsNetworkLoading(false);
    }
  };

  const handleCssTannerSubmit = async (matrix: number[][]) => {
    try {
      const response = await requestTensorNetwork(matrix, "CSS_TANNER");
      const { legos, connections } = response.data;
      const newConnections = connections.map((conn: Connection) => {
        return new Connection(conn.from, conn.to);
      });

      // Calculate positions for each type of node
      const canvasWidth = 800; // Approximate canvas width
      const nodeSpacing = 100; // Space between nodes

      // Group legos by type
      const zNodes = legos.filter((lego: DroppedLego) =>
        lego.shortName.startsWith("z")
      );
      const qNodes = legos.filter((lego: DroppedLego) =>
        lego.shortName.startsWith("q")
      );
      const xNodes = legos.filter((lego: DroppedLego) =>
        lego.shortName.startsWith("x")
      );

      // Calculate positions for each row
      const newLegos = legos.map((lego: DroppedLego) => {
        let nodesInRow: DroppedLego[];
        let y: number;

        if (lego.shortName.startsWith("z")) {
          nodesInRow = zNodes;
          y = 100; // Top row
        } else if (lego.shortName.startsWith("q")) {
          nodesInRow = qNodes;
          y = 250; // Middle row
        } else {
          nodesInRow = xNodes;
          y = 400; // Bottom row
        }

        // Calculate x position based on index in row
        const indexInRow = nodesInRow.findIndex(
          (l) => l.instanceId === lego.instanceId
        );
        const x =
          (canvasWidth - (nodesInRow.length - 1) * nodeSpacing) / 2 +
          indexInRow * nodeSpacing;

        return {
          ...lego,
          x,
          y,
          style: getLegoStyle(lego.id, lego.parity_check_matrix[0].length / 2),
          selectedMatrixRows: []
        };
      });

      // Add to state
      setDroppedLegos((prev) => [...prev, ...newLegos]);
      setConnections((prev) => [...prev, ...newConnections]);

      // Add to history
      operationHistory.addOperation({
        type: "add",
        data: {
          legosToAdd: newLegos,
          connectionsToAdd: newConnections
        }
      });

      const updatedLegos = [...droppedLegos, ...newLegos];
      encodeCanvasState(updatedLegos, newConnections, hideConnectedLegs);
    } catch (error) {
      if (axios.isAxiosError(error)) {
        setError(
          `Failed to create CSS Tanner network: ${getAxiosErrorMessage(error)}`
        );
      } else {
        setError("Failed to create CSS Tanner network");
      }
      console.error("Error:", error);
    }
  };

  const handleTannerSubmit = async (matrix: number[][]) => {
    try {
      const response = await requestTensorNetwork(matrix, "TANNER");
      const { legos, connections } = response.data;
      const newConnections = connections.map((conn: Connection) => {
        return new Connection(conn.from, conn.to);
      });

      // Calculate positions for each type of node
      const canvasWidth = 800; // Approximate canvas width
      const nodeSpacing = 100; // Space between nodes

      // Group legos by type
      const checkNodes = legos.filter(
        (lego: DroppedLego) => !lego.shortName.startsWith("q")
      );
      const qNodes = legos.filter((lego: DroppedLego) =>
        lego.shortName.startsWith("q")
      );

      // Calculate positions for each row
      const newLegos = legos.map((lego: DroppedLego) => {
        let nodesInRow: DroppedLego[];
        let y: number;

        if (lego.shortName.startsWith("q")) {
          nodesInRow = qNodes;
          y = 300; // Bottom row
        } else {
          nodesInRow = checkNodes;
          y = 150; // Top row
        }

        // Calculate x position based on index in row
        const indexInRow = nodesInRow.findIndex(
          (l) => l.instanceId === lego.instanceId
        );
        const x =
          (canvasWidth - (nodesInRow.length - 1) * nodeSpacing) / 2 +
          indexInRow * nodeSpacing;

        return {
          ...lego,
          x,
          y,
          style: getLegoStyle(lego.id, lego.parity_check_matrix[0].length / 2),
          selectedMatrixRows: []
        };
      });

      // Add to state
      setDroppedLegos((prev) => [...prev, ...newLegos]);
      setConnections((prev) => [...prev, ...newConnections]);

      // Add to history
      operationHistory.addOperation({
        type: "add",
        data: {
          legosToAdd: newLegos,
          connectionsToAdd: newConnections
        }
      });

      const updatedLegos = [...droppedLegos, ...newLegos];
      encodeCanvasState(updatedLegos, newConnections, hideConnectedLegs);
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const message =
          error.response?.data?.message ||
          error.response?.data?.detail ||
          error.message;
        setError(`Failed to create Tanner network: ${message}`);
      } else {
        setError("Failed to create Tanner network");
      }
      console.error("Error:", error);
    }
  };

  const handleMspSubmit = async (matrix: number[][]) => {
    try {
      const response = await requestTensorNetwork(matrix, "MSP");
      const { legos, connections } = response.data;
      const newMspConnections = connections.map((conn: Connection) => {
        return new Connection(conn.from, conn.to);
      });
      // Calculate positions using lego coordinates
      const canvasWidth = 800; // Approximate canvas width
      const margin = 50; // Margin from edges

      // Find min/max x and y to determine scale
      const xValues = legos.map((lego: DroppedLego) => lego.x);
      const yValues = legos.map((lego: DroppedLego) => lego.y);
      const minX = Math.min(...xValues);
      const maxX = Math.max(...xValues);
      const minY = Math.min(...yValues);

      // Calculate scale to fit width with margins
      const xScale = ((canvasWidth - 2 * margin) / (maxX - minX || 1)) * 1.2;

      // Position legos using their coordinates scaled to fit
      const newLegos = legos.map((lego: DroppedLego) => {
        const x = margin + (lego.x - minX) * xScale;
        const y = margin + (lego.y - minY) * xScale; // Use same scale for y to maintain proportions

        return {
          ...lego,
          x,
          y,
          style: getLegoStyle(lego.id, lego.parity_check_matrix[0].length / 2),
          pushedLegs: [],
          selectedMatrixRows: []
        };
      });

      // Add to state
      setDroppedLegos((prev) => [...prev, ...newLegos]);
      setConnections((prev) => [...prev, ...newMspConnections]);

      // Add to history
      operationHistory.addOperation({
        type: "add",
        data: {
          legosToAdd: newLegos,
          connectionsToAdd: newMspConnections
        }
      });

      const updatedLegos = [...droppedLegos, ...newLegos];
      encodeCanvasState(updatedLegos, newMspConnections, hideConnectedLegs);
    } catch (error) {
      if (axios.isAxiosError(error)) {
        const message =
          error.response?.data?.message ||
          error.response?.data?.detail ||
          error.message;
        setError(
          `Failed to create measurement state preparation network: ${message}`
        );
      } else {
        setError("Failed to create measurement state preparation network");
      }
      console.error("Error:", error);
    }
  };

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

  const handleCustomLegoSubmit = (
    matrix: number[][],
    logicalLegs: number[]
  ) => {
    const instanceId = newInstanceId(droppedLegos);
    const newLego: DroppedLego = {
      // to avoid caching collisions
      id:
        "custom-" +
        instanceId +
        "-" +
        Math.random().toString(36).substring(2, 15),
      name: "Custom Lego",
      shortName: "Custom",
      description: "Custom lego with user-defined parity check matrix",
      instanceId: newInstanceId(droppedLegos),
      x: customLegoPosition.x,
      y: customLegoPosition.y,
      parity_check_matrix: matrix,
      logical_legs: logicalLegs,
      gauge_legs: [],
      style: getLegoStyle("custom", matrix[0].length / 2),
      selectedMatrixRows: []
    };

    setDroppedLegos([...droppedLegos, newLego]);
    operationHistory.addOperation({
      type: "add",
      data: {
        legosToAdd: [newLego]
      }
    });
    encodeCanvasState(
      [...droppedLegos, newLego],
      connections,
      hideConnectedLegs
    );
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

  const handleRuntimeConfigSubmit = (config: Record<string, string>) => {
    // Store the config in localStorage
    localStorage.setItem("runtimeConfig", JSON.stringify(config));
    // Set the active flag
    localStorage.setItem("runtimeConfigActive", "true");

    // Reload the page
    window.location.reload();
  };

  const handleRuntimeToggle = () => {
    if (isLocalRuntime) {
      localStorage.setItem("runtimeConfigActive", "false");

      // Reload the page
      window.location.reload();
    } else {
      setIsRuntimeConfigOpen(true);
    }
  };

  // Helper to get external and dangling legs for the current tensor network
  const getExternalAndDanglingLegs = () => {
    if (!tensorNetwork) return { externalLegs: [], danglingLegs: [] };
    const externalLegs = [];
    const danglingLegs = [];
    for (const lego of tensorNetwork.legos) {
      const numLegs = lego.parity_check_matrix[0].length / 2;
      for (let i = 0; i < numLegs; i++) {
        const isConnected = connections.some(
          (conn) =>
            (conn.from.legoId === lego.instanceId &&
              conn.from.legIndex === i) ||
            (conn.to.legoId === lego.instanceId && conn.to.legIndex === i)
        );
        const leg = { instanceId: lego.instanceId, legIndex: i };
        if (isConnected) externalLegs.push(leg);
        else danglingLegs.push(leg);
      }
    }
    return { externalLegs, danglingLegs };
  };

  const handleExportPythonCode = () => {
    if (!tensorNetwork) return;
    const code = tensorNetwork.generateConstructionCode();
    navigator.clipboard.writeText(code);
    toast({
      title: "Copied to clipboard",
      description: "Python code for the network has been copied.",
      status: "success",
      duration: 2000,
      isClosable: true
    });
  };

  const calculateWeightEnumerator = async (
    truncateLength: number | null,
    openLegs?: TensorNetworkLeg[]
  ) => {
    if (!tensorNetwork) return;

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

      const acessToken = await getAccessToken();

      const response = await axios.post(
        getApiUrl("planqtnJob"),
        {
          user_id: currentUser?.id,
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

      if (response.data.status === "error") {
        throw new Error(response.data.message);
      }

      const taskId = response.data.task_id;

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

      toast({
        title: "Success starting the task!",
        description: "Weight enumerator calculation has been started.",
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

  return (
    <>
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
              leftPanelRef={leftPanelRef}
              legoPanelSizes={legoPanelSizes}
              isLegoPanelCollapsed={isLegoPanelCollapsed}
              setIsLegoPanelCollapsed={setIsLegoPanelCollapsed}
              legos={legos}
              handleDragStart={handleDragStart}
              setIsCssTannerDialogOpen={setIsCssTannerDialogOpen}
              setIsTannerDialogOpen={setIsTannerDialogOpen}
              setIsMspDialogOpen={setIsMspDialogOpen}
              currentUser={currentUser}
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
                      <MenuButton
                        as={Button}
                        variant="ghost"
                        size="sm"
                        minW="auto"
                        p={2}
                      >
                        <Icon as={FiMoreVertical} boxSize={4} />
                      </MenuButton>
                      <MenuList>
                        <MenuItem onClick={handleExportSvg}>
                          Export canvas as SVG...
                        </MenuItem>
                        <MenuItem
                          onClick={() => setShowWeightEnumeratorDialog(true)}
                          isDisabled={!tensorNetwork}
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
                            setIsTaskPanelCollapsed(!isTaskPanelCollapsed);
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
                            const rescaledLegos = droppedLegos.map((lego) => ({
                              ...lego,
                              x: (lego.x - centerX) * scale + centerX,
                              y: (lego.y - centerY) * scale + centerY
                            }));
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
                        <MenuItem onClick={handleClearAll}>Remove all</MenuItem>
                        <MenuItem
                          onClick={() => {
                            const clearedLegos = droppedLegos.map((lego) => ({
                              ...lego,
                              selectedMatrixRows: []
                            }));
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
                              {isLocalRuntime ? "cloud" : "local"}
                            </Text>
                          </HStack>
                        </MenuItem>
                      </MenuList>
                    </Menu>
                  </Box>

                  {/* Top-center title (contextual) */}
                  <Box
                    position="absolute"
                    top={2}
                    left="50%"
                    transform="translateX(-50%)"
                    zIndex={15}
                    opacity={0}
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

                  {/* Connection Lines */}
                  <svg
                    id="connections-svg"
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      width: "100%",
                      height: "100%",
                      pointerEvents: "none",
                      userSelect: "none"
                      // border: "1px solid red"
                    }}
                  >
                    {/* Existing connections */}
                    <g style={{ pointerEvents: "all" }}>
                      {connections.map((conn) => {
                        const fromLego = droppedLegos.find(
                          (l) => l.instanceId === conn.from.legoId
                        );
                        const toLego = droppedLegos.find(
                          (l) => l.instanceId === conn.to.legoId
                        );
                        if (!fromLego || !toLego) return null;

                        // Create a stable key based on the connection's properties
                        const [firstId, firstLeg, secondId, secondLeg] =
                          conn.from.legoId < conn.to.legoId
                            ? [
                                conn.from.legoId,
                                conn.from.legIndex,
                                conn.to.legoId,
                                conn.to.legIndex
                              ]
                            : [
                                conn.to.legoId,
                                conn.to.legIndex,
                                conn.from.legoId,
                                conn.from.legIndex
                              ];
                        const connKey = `${firstId}-${firstLeg}-${secondId}-${secondLeg}`;

                        // Calculate positions using shared function
                        const fromPos = calculateLegPosition(
                          fromLego,
                          conn.from.legIndex
                        );
                        const toPos = calculateLegPosition(
                          toLego,
                          conn.to.legIndex
                        );

                        // Check if legs are connected and should be hidden
                        const fromLegConnected = connections.some(
                          (c) =>
                            (c.from.legoId === fromLego.instanceId &&
                              c.from.legIndex === conn.from.legIndex) ||
                            (c.to.legoId === fromLego.instanceId &&
                              c.to.legIndex === conn.from.legIndex)
                        );
                        const toLegConnected = connections.some(
                          (c) =>
                            (c.from.legoId === toLego.instanceId &&
                              c.from.legIndex === conn.to.legIndex) ||
                            (c.to.legoId === toLego.instanceId &&
                              c.to.legIndex === conn.to.legIndex)
                        );

                        // Check if legs are highlighted
                        const fromLegStyle = fromLego.style.getLegStyle(
                          conn.from.legIndex,
                          fromLego
                        );
                        const toLegStyle = toLego.style.getLegStyle(
                          conn.to.legIndex,
                          toLego
                        );
                        const fromLegHighlighted = fromLegStyle.is_highlighted;
                        const toLegHighlighted = toLegStyle.is_highlighted;

                        // Determine if legs should be hidden
                        const hideFromLeg =
                          hideConnectedLegs &&
                          fromLegConnected &&
                          !fromLego.alwaysShowLegs &&
                          (!fromLegHighlighted
                            ? !toLegHighlighted
                            : toLegHighlighted &&
                              fromLegStyle.color === toLegStyle.color);
                        const hideToLeg =
                          hideConnectedLegs &&
                          toLegConnected &&
                          !toLego.alwaysShowLegs &&
                          (!toLegHighlighted
                            ? !fromLegHighlighted
                            : fromLegHighlighted &&
                              fromLegStyle.color === toLegStyle.color);

                        // Final points with lego positions
                        const fromPoint = hideFromLeg
                          ? { x: fromLego.x, y: fromLego.y }
                          : {
                              x: fromLego.x + fromPos.endX,
                              y: fromLego.y + fromPos.endY
                            };
                        const toPoint = hideToLeg
                          ? { x: toLego.x, y: toLego.y }
                          : {
                              x: toLego.x + toPos.endX,
                              y: toLego.y + toPos.endY
                            };

                        // Get the colors of the connected legs
                        const fromLegColor = fromLego.style.getLegColor(
                          conn.from.legIndex,
                          fromLego
                        );
                        const toLegColor = toLego.style.getLegColor(
                          conn.to.legIndex,
                          toLego
                        );
                        const colorsMatch = fromLegColor === toLegColor;

                        // Calculate control points for the curve
                        const controlPointDistance = 30;
                        const cp1 = {
                          x:
                            fromPoint.x +
                            Math.cos(fromPos.angle) * controlPointDistance,
                          y:
                            fromPoint.y +
                            Math.sin(fromPos.angle) * controlPointDistance
                        };
                        const cp2 = {
                          x:
                            toPoint.x +
                            Math.cos(toPos.angle) * controlPointDistance,
                          y:
                            toPoint.y +
                            Math.sin(toPos.angle) * controlPointDistance
                        };

                        // Create the path string for the cubic Bezier curve
                        const pathString = `M ${fromPoint.x} ${fromPoint.y} C ${cp1.x} ${cp1.y}, ${cp2.x} ${cp2.y}, ${toPoint.x} ${toPoint.y}`;

                        // Calculate midpoint for warning sign
                        const midPoint = {
                          x: (fromPoint.x + toPoint.x) / 2,
                          y: (fromPoint.y + toPoint.y) / 2
                        };

                        function fromChakraColorToHex(color: string): string {
                          if (color.startsWith("blue")) {
                            return "#0000FF";
                          } else if (color.startsWith("red")) {
                            return "#FF0000";
                          } else if (color.startsWith("purple")) {
                            return "#800080";
                          } else {
                            return "darkgray";
                          }
                        }
                        const sharedColor = colorsMatch
                          ? fromChakraColorToHex(fromLegColor)
                          : "yellow";
                        const connectorColor = colorsMatch
                          ? sharedColor
                          : "yellow";

                        // Check if this connection is being hovered
                        const isHovered =
                          hoveredConnection &&
                          hoveredConnection.from.legoId === conn.from.legoId &&
                          hoveredConnection.from.legIndex ===
                            conn.from.legIndex &&
                          hoveredConnection.to.legoId === conn.to.legoId &&
                          hoveredConnection.to.legIndex === conn.to.legIndex;

                        return (
                          <g key={connKey}>
                            {/* Invisible wider path for easier clicking */}
                            <path
                              d={pathString}
                              stroke="transparent"
                              strokeWidth="10"
                              fill="none"
                              style={{
                                cursor: "pointer"
                              }}
                              onDoubleClick={(e) =>
                                handleConnectionDoubleClick(e, conn)
                              }
                              onMouseEnter={(e) => {
                                // Find and update the visible path
                                const visiblePath = e.currentTarget
                                  .nextSibling as SVGPathElement;
                                if (visiblePath) {
                                  visiblePath.style.stroke = connectorColor;
                                  visiblePath.style.strokeWidth = "3";
                                  visiblePath.style.filter =
                                    "drop-shadow(0 0 2px rgba(66, 153, 225, 0.5))";
                                }
                              }}
                              onMouseLeave={(e) => {
                                // Reset the visible path
                                const visiblePath = e.currentTarget
                                  .nextSibling as SVGPathElement;
                                if (visiblePath) {
                                  visiblePath.style.stroke = connectorColor;
                                  visiblePath.style.strokeWidth = "2";
                                  visiblePath.style.filter = "none";
                                }
                              }}
                            />
                            {/* Visible path */}
                            <path
                              d={pathString}
                              stroke={connectorColor}
                              strokeWidth={isHovered ? "4" : "2"}
                              fill="none"
                              style={{
                                pointerEvents: "none",
                                stroke: connectorColor,
                                filter: isHovered
                                  ? "drop-shadow(0 0 2px rgba(66, 153, 225, 0.5))"
                                  : "none"
                              }}
                            />
                            {/* Warning sign if operators don't match */}
                            {!colorsMatch && (
                              <text
                                x={midPoint.x}
                                y={midPoint.y}
                                fontSize="16"
                                fill="#FF0000"
                                textAnchor="middle"
                                dominantBaseline="middle"
                                style={{ pointerEvents: "none" }}
                              >
                                ⚠
                              </text>
                            )}
                          </g>
                        );
                      })}
                    </g>

                    {/* Temporary line while dragging */}
                    {legDragState?.isDragging &&
                      (() => {
                        const fromLego = droppedLegos.find(
                          (l) => l.instanceId === legDragState.legoId
                        );
                        if (!fromLego) return null;

                        // Calculate position using shared function
                        const fromPos = calculateLegPosition(
                          fromLego,
                          legDragState.legIndex
                        );
                        const fromPoint = {
                          x: fromLego.x + fromPos.endX,
                          y: fromLego.y + fromPos.endY
                        };

                        const legStyle = fromLego.style.getLegStyle(
                          legDragState.legIndex,
                          fromLego
                        );
                        const controlPointDistance = 30;
                        const cp1 = {
                          x:
                            fromPoint.x +
                            Math.cos(legStyle.angle) * controlPointDistance,
                          y:
                            fromPoint.y +
                            Math.sin(legStyle.angle) * controlPointDistance
                        };
                        const cp2 = {
                          x: legDragState.currentX,
                          y: legDragState.currentY
                        };

                        const pathString = `M ${fromPoint.x} ${fromPoint.y} C ${cp1.x} ${cp1.y}, ${cp2.x} ${cp2.y}, ${legDragState.currentX} ${legDragState.currentY}`;

                        return (
                          <>
                            <circle
                              cx={fromLego.x}
                              cy={fromLego.y}
                              r={5}
                              fill="red"
                            />
                            <path
                              d={pathString}
                              stroke="#3182CE"
                              strokeWidth="2"
                              strokeDasharray="4"
                              fill="none"
                              opacity={0.5}
                              style={{ pointerEvents: "none" }}
                            />
                          </>
                        );
                      })()}
                  </svg>

                  {/* Selection Box */}
                  {selectionBox.isSelecting && (
                    <Box
                      position="absolute"
                      left={`${Math.min(
                        selectionBox.startX,
                        selectionBox.currentX
                      )}px`}
                      top={`${Math.min(
                        selectionBox.startY,
                        selectionBox.currentY
                      )}px`}
                      width={`${Math.abs(
                        selectionBox.currentX - selectionBox.startX
                      )}px`}
                      height={`${Math.abs(
                        selectionBox.currentY - selectionBox.startY
                      )}px`}
                      border="2px"
                      borderColor="blue.500"
                      bg="blue.50"
                      opacity={0.3}
                      pointerEvents="none"
                    />
                  )}

                  {droppedLegos.map((lego, index) => (
                    <DroppedLegoDisplay
                      key={lego.instanceId}
                      lego={lego}
                      index={index}
                      legDragState={legDragState}
                      handleLegMouseDown={handleLegMouseDown}
                      handleLegoMouseDown={handleLegoMouseDown}
                      handleLegoClick={handleLegoClick}
                      tensorNetwork={tensorNetwork}
                      dragState={dragState}
                      onLegClick={handleLegClick}
                      hideConnectedLegs={hideConnectedLegs}
                      connections={connections}
                      droppedLegos={droppedLegos}
                      demoMode={false}
                    />
                  ))}
                </Box>
              </Box>
            </Panel>

            <ResizeHandle id="details-panel-resize-handle" />

            {/* Right Panel */}
            <Panel id="details-panel" defaultSize={20} minSize={5} order={3}>
              <DetailsPanel
                handlePullOutSameColoredLeg={handlePullOutSameColoredLeg}
                tensorNetwork={tensorNetwork}
                droppedLegos={droppedLegos}
                connections={connections}
                setTensorNetwork={setTensorNetwork}
                setError={setError}
                setDroppedLegos={setDroppedLegos}
                fuseLegos={fuseLegos}
                setConnections={setConnections}
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

        {!isTaskPanelCollapsed && (
          <Box borderTopWidth={1} borderColor={borderColor}>
            <TaskPanel user={currentUser} onError={setError} />
          </Box>
        )}

        <DynamicLegoDialog
          isOpen={isDialogOpen}
          onClose={() => {
            setIsDialogOpen(false);
            setSelectedDynamicLego(null);
            setPendingDropPosition(null);
          }}
          onSubmit={handleDynamicLegoSubmit}
          legoId={selectedDynamicLego?.id || ""}
          parameters={selectedDynamicLego?.parameters || {}}
        />
        <TannerDialog
          isOpen={isCssTannerDialogOpen}
          onClose={() => setIsCssTannerDialogOpen(false)}
          onSubmit={handleCssTannerSubmit}
          title="Create CSS Tanner Network"
          cssOnly={true}
        />
        <TannerDialog
          isOpen={isTannerDialogOpen}
          onClose={() => setIsTannerDialogOpen(false)}
          onSubmit={handleTannerSubmit}
          title="Create Tanner Network"
        />
        <TannerDialog
          isOpen={isMspDialogOpen}
          onClose={() => setIsMspDialogOpen(false)}
          onSubmit={handleMspSubmit}
          title="Measurement State Prep Network"
        />
        {showCustomLegoDialog && (
          <TannerDialog
            isOpen={showCustomLegoDialog}
            onClose={() => setShowCustomLegoDialog(false)}
            onSubmit={handleCustomLegoSubmit}
            title="Create Custom Lego"
          />
        )}
        <AuthDialog
          isOpen={authDialogOpen}
          onClose={() => setAuthDialogOpen(false)}
          connectionError={
            supabaseStatus && !supabaseStatus.isHealthy
              ? supabaseStatus.message
              : undefined
          }
        />
        <RuntimeConfigDialog
          isOpen={isRuntimeConfigOpen}
          onClose={() => setIsRuntimeConfigOpen(false)}
          onSubmit={handleRuntimeConfigSubmit}
          isLocal={isLocalRuntime}
          initialConfig={(() => {
            try {
              const storedConfig = localStorage.getItem("runtimeConfig");
              return storedConfig ? JSON.parse(storedConfig) : undefined;
            } catch {
              return undefined;
            }
          })()}
        />
        <LoadingModal isOpen={isNetworkLoading} message={loadingMessage} />
      </VStack>
      {tensorNetwork && (
        <WeightEnumeratorCalculationDialog
          open={showWeightEnumeratorDialog}
          onClose={() => setShowWeightEnumeratorDialog(false)}
          onSubmit={(truncateLength, openLegs) => {
            setShowWeightEnumeratorDialog(false);
            calculateWeightEnumerator(truncateLength, openLegs);
          }}
          externalLegs={getExternalAndDanglingLegs().externalLegs}
          danglingLegs={getExternalAndDanglingLegs().danglingLegs}
        />
      )}
    </>
  );
};

export default LegoStudioView;
