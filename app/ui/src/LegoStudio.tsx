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

import ErrorPanel from "./components/ErrorPanel";
import BuildingBlocksPanel from "./features/building-blocks-panel/BuildingBlocksPanel.tsx";
import { KeyboardHandler } from "./features/canvas/KeyboardHandler.tsx";
import { ConnectionsLayer } from "./features/lego/ConnectionsLayer.tsx";
import { LegosLayer } from "./features/lego/LegosLayer.tsx";
import {
  SelectionManager,
  SelectionManagerRef
} from "./features/canvas/SelectionManager.tsx";
import { Connection, ParityCheckMatrix, SelectionBoxState } from "./lib/types";

import DetailsPanel from "./features/details-panel/DetailsPanel.tsx";
import { ResizeHandle } from "./features/canvas/ResizeHandle.tsx";
import { DynamicLegoDialog } from "./features/building-blocks-panel/DynamicLegoDialog.tsx";

import { FuseLegos } from "./transformations/FuseLegos";
import { randomPlankterName } from "./lib/RandomPlankterNames";
import { useLocation, useNavigate } from "react-router-dom";
import { UserMenu } from "./features/auth/UserMenu.tsx";

import { userContextSupabase } from "./config/supabaseClient.ts";
import { User } from "@supabase/supabase-js";

import { Legos } from "./features/lego/Legos.ts";
import { TbPlugConnected } from "react-icons/tb";
import { checkSupabaseStatus } from "./lib/errors.ts";
import { FiMoreVertical } from "react-icons/fi";
// import WeightEnumeratorCalculationDialog from "./components/WeightEnumeratorCalculationDialog";

import FloatingTaskPanel from "./features/tasks/FloatingTaskPanel.tsx";

import PythonCodeModal from "./features/python-export/PythonCodeModal.tsx";
import { useModalStore } from "./stores/modalStore";
import { RuntimeConfigService } from "./features/kernel/runtimeConfigService.ts";
import { ModalRoot } from "./components/ModalRoot";
import { useTensorNetworkStore } from "./stores/tensorNetworkStore";
import { DragProxy } from "./features/lego/DragProxy.tsx";
import { useCanvasStore } from "./stores/canvasStateStore.ts";
import { CanvasMouseHandler } from "./features/canvas/CanvasMouseHandler.tsx";
import { useCanvasDragStateStore } from "./stores/canvasDragStateStore.ts";
import { useDraggedLegoStore } from "./stores/draggedLegoStore.ts";
import { findClosestDanglingLeg } from "./features/canvas/canvasCalculations.ts";
import { AddStopper } from "./transformations/AddStopper.ts";
import { InjectTwoLegged } from "./transformations/InjectTwoLegged.ts";
import { DroppedLego, LegoPiece } from "./stores/droppedLegoStore.ts";
// import PythonCodeModal from "./components/PythonCodeModal";

// Memoized Left Panel Component
const LeftPanel = memo<{
  leftPanelRef: React.RefObject<ImperativePanelHandle>;
  legoPanelSizes: { defaultSize: number; minSize: number };
  isLegoPanelCollapsed: boolean;
  setIsLegoPanelCollapsed: (collapsed: boolean) => void;
  isUserLoggedIn: boolean;
}>(
  ({
    leftPanelRef,
    legoPanelSizes,
    isLegoPanelCollapsed,
    setIsLegoPanelCollapsed,
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
          <BuildingBlocksPanel isUserLoggedIn={isUserLoggedIn} />
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
    newInstanceId,
    decodeCanvasState,
    connections,
    setLegosAndConnections,
    hideConnectedLegs,
    setHideConnectedLegs,
    addOperation
  } = useCanvasStore();

  const [error, setError] = useState<string>("");

  const { canvasDragState } = useCanvasDragStateStore();

  const [zoomLevel, setZoomLevel] = useState(1);
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const selectionManagerRef = useRef<SelectionManagerRef>(null);
  // Use centralized TensorNetwork store
  const { tensorNetwork, setTensorNetwork } = useTensorNetworkStore();

  const [selectionBox, setSelectionBox] = useState<SelectionBoxState>({
    isSelecting: false,
    startX: 0,
    startY: 0,
    currentX: 0,
    currentY: 0,
    justFinished: false
  });
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
    openLoadingModal,
    closeLoadingModal,
    openAuthDialog,
    openRuntimeConfigDialog,
    openWeightEnumeratorDialog
  } = useModalStore();

  const handleSetLegoPanelCollapsed = useCallback((collapsed: boolean) => {
    setIsLegoPanelCollapsed(collapsed);
  }, []);

  const [isLegoPanelCollapsed, setIsLegoPanelCollapsed] = useState(false);
  const [hoveredConnection, setHoveredConnection] = useState<Connection | null>(
    null
  );
  const { draggedLego, setDraggedLego } = useDraggedLegoStore();
  const { openCustomLegoDialog } = useModalStore();

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

  const supabaseStatusRef = useRef<{ isHealthy: boolean; message: string }>({
    isHealthy: false,
    message: ""
  });

  const [showPythonCodeModal, setShowPythonCodeModal] = useState(false);
  const [pythonCode, setPythonCode] = useState("");

  // Inside the App component, add this line near the other hooks
  const toast = useToast();

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
      const stopperLego: DroppedLego = new DroppedLego(
        draggedLego,
        dropPosition.x,
        dropPosition.y,
        (maxInstanceId + 1).toString()
      );
      try {
        const addStopper = new AddStopper(connections, droppedLegos);
        const result = addStopper.apply(
          closestLeg.lego,
          closestLeg.legIndex,
          stopperLego
        );
        setLegosAndConnections(result.droppedLegos, result.connections);
        addOperation(result.operation);
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

    // Get the actual drop position from the event
    const rect = e.currentTarget.getBoundingClientRect();
    const dropPosition = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
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

    // Use the drop position directly from the event
    const newLego = new DroppedLego(
      draggedLego,
      dropPosition.x,
      dropPosition.y,
      newInstanceId()
    );

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
            addOperation(operation);
            setLegosAndConnections(newDroppedLegos, newConnections);
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
        openCustomLegoDialog({ x: dropPosition.x, y: dropPosition.y });
      } else {
        addDroppedLego(newLego);
        addOperation({
          type: "add",
          data: { legosToAdd: [newLego] }
        });
      }
    }

    setHoveredConnection(null);
    setDraggedLego(null);
  };

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

  // Add a new effect to handle initial URL state
  useEffect(() => {
    const handleHashChange = async () => {
      const hashParams = new URLSearchParams(window.location.hash.slice(1));
      const stateParam = hashParams.get("state");
      if (stateParam) {
        try {
          await decodeCanvasState(stateParam);
        } catch (error) {
          // Clear the invalid state from the URL
          // window.history.replaceState(null, '', window.location.pathname + window.location.search)
          // Ensure error is an Error object
          setFatalError(
            error instanceof Error ? error : new Error(String(error))
          );
        }
      }
    };

    // Listen for hash changes
    window.addEventListener("hashchange", handleHashChange);

    // Initial load
    handleHashChange();

    // Cleanup
    return () => window.removeEventListener("hashchange", handleHashChange);
  }, [decodeCanvasState]);
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
      const newLego = new DroppedLego(
        dynamicLego,
        pendingDropPosition.x,
        pendingDropPosition.y,
        instanceId
      );
      addDroppedLego(newLego);
      addOperation({
        type: "add",
        data: { legosToAdd: [newLego] }
      });
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
      supabaseStatusRef.current = status;

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

    // Set up periodic checks every 60 seconds
    const intervalId = setInterval(checkStatus, 60000);

    return () => {
      clearInterval(intervalId);
    };
  }, [currentUser]);

  // Update the auth dialog to show Supabase status error if needed
  const handleAuthDialogOpen = async () => {
    if (!userContextSupabase) {
      supabaseStatusRef.current = {
        isHealthy: false,
        message: "No supabase client available"
      };
      return;
    }
    try {
      let status = supabaseStatusRef.current;
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

        supabaseStatusRef.current = status;
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

  const handleClearAll = () => {
    if (droppedLegos.length === 0 && connections.length === 0) return;

    // Store current state for history
    addOperation({
      type: "remove",
      data: {
        legosToRemove: droppedLegos,
        connectionsToRemove: connections
      }
    });

    // Clear all state
    setLegosAndConnections([], []);
    setTensorNetwork(null);
  };

  // Cache clearing is now handled by localStorage-based caching system
  // Caches persist across page refreshes and are managed per canvas ID

  const fuseLegos = async (legosToFuse: DroppedLego[]) => {
    const trafo = new FuseLegos(connections, droppedLegos);
    try {
      const {
        connections: newConnections,
        droppedLegos: newDroppedLegos,
        operation: operation
      } = await trafo.apply(legosToFuse);
      addOperation(operation);
      setLegosAndConnections(newDroppedLegos, newConnections);
      setTensorNetwork(null);
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
        return lego.with({ x: newX, y: newY });
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
      const newLego: DroppedLego = new DroppedLego(
        { ...lego, parity_check_matrix: newLegoData.parity_check_matrix },
        lego.x,
        lego.y,
        lego.instanceId
      );

      // Create a stopper based on the lego type
      const stopperLego: DroppedLego = new DroppedLego(
        {
          id: lego.id === "z_rep_code" ? "stopper_x" : "stopper_z",
          name: lego.id === "z_rep_code" ? "X Stopper" : "Z Stopper",
          shortName: lego.id === "z_rep_code" ? "X" : "Z",
          description: lego.id === "z_rep_code" ? "X Stopper" : "Z Stopper",
          parity_check_matrix: lego.id === "z_rep_code" ? [[1, 0]] : [[0, 1]],
          logical_legs: [],
          gauge_legs: []
        },

        lego.x + 100, // Position the stopper to the right of the lego
        lego.y,
        (maxInstanceId + 1).toString()
      );

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

      setLegosAndConnections(newLegos, newConnections);

      // Add to operation history
      addOperation({
        type: "pullOutOppositeLeg",
        data: {
          legosToRemove: [lego],
          connectionsToRemove: [],
          legosToAdd: [newLego, stopperLego],
          connectionsToAdd: [newConnection]
        }
      });
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
        onSetAltKeyPressed={setAltKeyPressed}
        onSetError={setError}
        onFuseLegos={fuseLegos}
        onPullOutSameColoredLeg={handlePullOutSameColoredLeg}
        onToast={(props) =>
          toast({
            ...props,
            status: props.status as "success" | "error" | "warning" | "info"
          })
        }
      />

      <CanvasMouseHandler
        canvasRef={canvasRef}
        setHoveredConnection={setHoveredConnection}
        selectionManagerRef={selectionManagerRef}
        selectionBox={selectionBox}
        zoomLevel={zoomLevel}
        altKeyPressed={altKeyPressed}
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
          <PanelGroup direction="horizontal">
            {/* Left Panel */}
            <LeftPanel
              leftPanelRef={
                leftPanelRef as React.RefObject<ImperativePanelHandle>
              }
              legoPanelSizes={legoPanelSizes}
              isLegoPanelCollapsed={isLegoPanelCollapsed}
              setIsLegoPanelCollapsed={handleSetLegoPanelCollapsed}
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
                  onDrop={handleDrop}
                  data-canvas="true"
                  style={{
                    userSelect: "none",
                    overflow: "hidden",
                    cursor: altKeyPressed
                      ? canvasDragState?.isDragging
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
                                    (lego) =>
                                      lego.with({
                                        x: (lego.x - centerX) * scale + centerX,
                                        y: (lego.y - centerY) * scale + centerY
                                      })
                                  );
                                  setDroppedLegos(rescaledLegos);
                                  setZoomLevel(1);
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
                                    (lego) =>
                                      lego.with({ selectedMatrixRows: [] })
                                  );
                                  setDroppedLegos(clearedLegos);
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
                    hoveredConnection={hoveredConnection}
                  />
                  {/* Selection Manager */}
                  <SelectionManager
                    ref={selectionManagerRef}
                    selectionBox={selectionBox}
                    onSelectionBoxChange={setSelectionBox}
                    canvasRef={canvasRef}
                  />
                  <LegosLayer canvasRef={canvasRef} />
                  {/* Drag Proxy for smooth dragging */}
                  <DragProxy canvasRef={canvasRef} />
                </Box>
              </Box>
            </Panel>

            <ResizeHandle id="details-panel-resize-handle" />

            {/* Right Panel */}
            <Panel id="details-panel" defaultSize={20} minSize={5} order={3}>
              <DetailsPanel
                handlePullOutSameColoredLeg={handlePullOutSameColoredLeg}
                setError={setError}
                fuseLegos={fuseLegos}
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
          currentUser={currentUser}
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
