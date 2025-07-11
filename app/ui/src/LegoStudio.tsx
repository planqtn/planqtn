import {
  Box,
  Editable,
  EditableInput,
  EditablePreview,
  useColorModeValue,
  useToast,
  VStack
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
import { ParityCheckMatrix } from "./lib/types";

import DetailsPanel from "./features/details-panel/DetailsPanel.tsx";
import { ResizeHandle } from "./features/canvas/ResizeHandle.tsx";
import { DynamicLegoDialog } from "./features/building-blocks-panel/DynamicLegoDialog.tsx";

import { randomPlankterName } from "./lib/RandomPlankterNames";
import { useLocation, useNavigate } from "react-router-dom";
import { UserMenu } from "./features/auth/UserMenu.tsx";

import { userContextSupabase } from "./config/supabaseClient.ts";
import { User } from "@supabase/supabase-js";

import { checkSupabaseStatus } from "./lib/errors.ts";
// import WeightEnumeratorCalculationDialog from "./components/WeightEnumeratorCalculationDialog";

import FloatingTaskPanel from "./features/tasks/FloatingTaskPanel.tsx";

import PythonCodeModal from "./features/python-export/PythonCodeModal.tsx";
import { useModalStore } from "./stores/modalStore";
import { RuntimeConfigService } from "./features/kernel/runtimeConfigService.ts";
import { ModalRoot } from "./components/ModalRoot";
import { DragProxy } from "./features/lego/DragProxy.tsx";
import { useCanvasStore } from "./stores/canvasStateStore";
import { CanvasMouseHandler } from "./features/canvas/CanvasMouseHandler.tsx";
import { useCanvasDragStateStore } from "./stores/canvasDragStateStore.ts";
import { CanvasMenu } from "./features/canvas/CanvasMenu.tsx";
import { CanvasMiniMap } from "./features/canvas/CanvasMiniMap.tsx";
import { ViewportDebugOverlay } from "./features/canvas/ViewportDebugOverlay.tsx";

import { DroppedLego } from "./stores/droppedLegoStore.ts";
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
  const [canvasSvgRef, setCanvasSvgRef] = useState<SVGSVGElement | null>(null);

  const [altKeyPressed, setAltKeyPressed] = useState(false);
  // const [message, setMessage] = useState<string>("Loading...");

  const decodeCanvasState = useCanvasStore((state) => state.decodeCanvasState);
  const handleDynamicLegoSubmit = useCanvasStore(
    (state) => state.handleDynamicLegoSubmit
  );
  const handleClearAll = useCanvasStore((state) => state.handleClearAll);
  const fuseLegos = useCanvasStore((state) => state.fuseLegos);
  const makeSpace = useCanvasStore((state) => state.makeSpace);
  const handleDynamicLegoDrop = useCanvasStore(
    (state) => state.handleDynamicLegoDrop
  );
  const handleExportPythonCode = useCanvasStore(
    (state) => state.handleExportPythonCode
  );
  const handlePullOutSameColoredLeg = useCanvasStore(
    (state) => state.handlePullOutSameColoredLeg
  );
  const showPythonCodeModal = useCanvasStore(
    (state) => state.showPythonCodeModal
  );
  const setShowPythonCodeModal = useCanvasStore(
    (state) => state.setShowPythonCodeModal
  );
  const pythonCode = useCanvasStore((state) => state.pythonCode);
  const selectedDynamicLego = useCanvasStore(
    (state) => state.selectedDynamicLego
  );
  const isDynamicLegoDialogOpen = useCanvasStore(
    (state) => state.isDynamicLegoDialogOpen
  );
  const setIsDynamicLegoDialogOpen = useCanvasStore(
    (state) => state.setIsDynamicLegoDialogOpen
  );
  const setSelectedDynamicLego = useCanvasStore(
    (state) => state.setSelectedDynamicLego
  );
  const setPendingDropPosition = useCanvasStore(
    (state) => state.setPendingDropPosition
  );
  const setError = useCanvasStore((state) => state.setError);

  const setZoomLevel = useCanvasStore((state) => state.setZoomLevel);
  const setCanvasRef = useCanvasStore((state) => state.setCanvasRef);
  const canvasRef = useCanvasStore((state) => state.canvasRef);
  const selectionManagerRef = useRef<SelectionManagerRef>(null);

  const { canvasDragState } = useCanvasDragStateStore();
  const viewport = useCanvasStore((state) => state.viewport);
  const zoomLevel = viewport.zoomLevel;

  // Use centralized TensorNetwork store

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

  // Inside the App component, add this line near the other hooks
  const toast = useToast();

  // Add title effect at the top
  useEffect(() => {
    console.log("location/navigate changed", location);
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
    console.log("decodeCanvasState changed", decodeCanvasState);
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

  const handleExportSvg = () => {
    try {
      const svgElement = canvasSvgRef?.cloneNode(true) as SVGSVGElement;
      const svgString = svgElement.outerHTML;
      const blob = new Blob([svgString], { type: "image/svg+xml" });
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
        description: "SVG file is being downloaded",
        status: "success",
        duration: 3000,
        isClosable: true
      });
    } catch (error) {
      console.error("Error exporting SVG:", error);
      toast({
        title: "Export failed",
        description: "SVG file could not be generated/downloaded",
        status: "error",
        duration: 3000,
        isClosable: true
      });
    }
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

  return (
    <>
      <KeyboardHandler
        onSetAltKeyPressed={setAltKeyPressed}
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
        selectionManagerRef={selectionManagerRef}
        zoomLevel={zoomLevel}
        altKeyPressed={altKeyPressed}
        handleDynamicLegoDrop={handleDynamicLegoDrop}
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
                  ref={setCanvasRef}
                  flex={1}
                  bg="gray.100"
                  borderRadius="lg"
                  boxShadow="inner"
                  position="relative"
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
                  <CanvasMenu
                    zoomLevel={zoomLevel}
                    setZoomLevel={setZoomLevel}
                    isLegoPanelCollapsed={isLegoPanelCollapsed}
                    isTaskPanelCollapsed={isTaskPanelCollapsed}
                    setIsTaskPanelCollapsed={setIsTaskPanelCollapsed}
                    leftPanelRef={leftPanelRef}
                    handleClearAll={handleClearAll}
                    handleExportPythonCode={handleExportPythonCode}
                    handleExportSvg={handleExportSvg}
                    handleRuntimeToggle={handleRuntimeToggle}
                    openWeightEnumeratorDialog={openWeightEnumeratorDialog}
                    currentUser={currentUser}
                  />
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

                  <svg
                    id="canvas-svg"
                    xmlns="http://www.w3.org/2000/svg"
                    ref={setCanvasSvgRef}
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      width: "100%",
                      height: "100%",
                      pointerEvents: "none",
                      userSelect: "none"
                    }}
                    viewBox={
                      canvasRef
                        ? `0 0 ${canvasRef?.current?.clientWidth} ${canvasRef?.current?.clientHeight}`
                        : undefined
                    }
                  >
                    <ConnectionsLayer />
                    {/* Selection Manager */}
                    <LegosLayer />
                  </svg>
                  <SelectionManager ref={selectionManagerRef} />

                  {/* Drag Proxy for smooth dragging */}
                  <DragProxy />

                  {import.meta.env.VITE_ENV === "debug" && (
                    // Debug viewport overlay
                    <ViewportDebugOverlay />
                  )}

                  {/* Mini-map with zoom level display */}
                  <CanvasMiniMap />
                </Box>
              </Box>
            </Panel>

            <ResizeHandle id="details-panel-resize-handle" />

            {/* Right Panel */}
            <Panel id="details-panel" defaultSize={20} minSize={5} order={3}>
              <DetailsPanel
                handlePullOutSameColoredLeg={handlePullOutSameColoredLeg}
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
          <ErrorPanel />
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
            legoId={selectedDynamicLego?.type_id || ""}
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
