import React, { useState } from "react";
import { Box } from "@chakra-ui/react";
import { useCanvasStore } from "../../stores/canvasStateStore";
import { LogicalPoint } from "../../types/coordinates";
import { useDraggedLegoStore } from "../../stores/draggedLegoProtoStore";
import { useCanvasDragStateStore } from "../../stores/canvasDragStateStore";
import { useDebugStore } from "../../stores/debugStore";
import { useVisibleLegos } from "../../hooks/useVisibleLegos";

// Custom hook for persistent collapsed state
const useLocalStorageState = (key: string, defaultValue: boolean) => {
  const [state, setState] = useState(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : defaultValue;
    } catch (error) {
      console.warn(`Error reading localStorage key "${key}":`, error);
      return defaultValue;
    }
  });

  const setValue = (value: boolean | ((val: boolean) => boolean)) => {
    try {
      const valueToStore = value instanceof Function ? value(state) : value;
      setState(valueToStore);
      window.localStorage.setItem(key, JSON.stringify(valueToStore));
    } catch (error) {
      console.warn(`Error setting localStorage key "${key}":`, error);
    }
  };

  return [state, setValue] as const;
};

export const ViewportDebugOverlay: React.FC = () => {
  const viewport = useCanvasStore((state) => state.viewport);
  const dragState = useCanvasStore((state) => state.legoDragState);
  const draggedLego = useDraggedLegoStore((state) => state.draggedLegoProto);
  const groupDragState = useCanvasStore((state) => state.groupDragState);
  const canvasDragState = useCanvasDragStateStore(
    (state) => state.canvasDragState
  );
  const legDragState = useCanvasStore((state) => state.legDragState);

  const [dragStateCollapsed, setDragStateCollapsed] = useLocalStorageState(
    "dragStateCollapsed",
    false
  );
  const [draggedLegoCollapsed, setDraggedLegoCollapsed] = useLocalStorageState(
    "draggedLegoCollapsed",
    false
  );
  const [groupDragStateCollapsed, setGroupDragStateCollapsed] =
    useLocalStorageState("groupDragStateCollapsed", false);
  const [canvasDragStateCollapsed, setCanvasDragStateCollapsed] =
    useLocalStorageState("canvasDragStateCollapsed", false);
  const [debugStateCollapsed, setDebugStateCollapsed] = useLocalStorageState(
    "debugStateCollapsed",
    false
  );
  const [visibleLegosCollapsed, setVisibleLegosCollapsed] =
    useLocalStorageState("visibleLegosCollapsed", false);
  const [legDragStateCollapsed, setLegDragStateCollapsed] =
    useLocalStorageState("legDragStateCollapsed", false);

  // has to be the last one to avoid hook number changes

  const canvasRef = useCanvasStore((state) => state.canvasRef);
  // Get canvas dimensions from the actual element
  const canvasRect = canvasRef?.current?.getBoundingClientRect();

  const debugMousePos = useDebugStore((state) => state.debugMousePos);

  const debugMouseCanvasPos = viewport.fromWindowToCanvas(debugMousePos);
  const debugMouseLogicalPos =
    viewport.fromCanvasToLogical(debugMouseCanvasPos);

  const visibleLegos = useVisibleLegos();

  const zoomLevel = viewport.zoomLevel;

  const debugTopLeft = viewport.fromLogicalToCanvas(viewport.logicalPanOffset);
  const debugBottomRight = viewport.fromLogicalToCanvas(
    new LogicalPoint(viewport.logicalWidth, viewport.logicalHeight).plus(
      viewport.logicalPanOffset
    )
  );

  const debugBoxStyle = {
    position: "absolute" as const,
    top: debugTopLeft.y,
    left: debugTopLeft.x,
    width: `${debugBottomRight.x - debugTopLeft.x}px`,
    height: `${debugBottomRight.y - debugTopLeft.y}px`,
    border: "3px solid red",
    background: "rgba(255, 0, 0, 0.1)",
    pointerEvents: "none" as const,
    zIndex: 1000,
    borderRadius: "8px"
  };

  const toggleButtonStyle = {
    background: "none",
    border: "none",
    color: "#007ACC",
    cursor: "pointer",
    fontSize: "inherit",
    fontFamily: "inherit",
    textDecoration: "underline",
    padding: 0,
    margin: 0
  };

  return (
    <>
      {/* Main viewport debug box - should always align with canvas borders */}
      <Box style={debugBoxStyle} />

      {/* Debug info overlay */}
      <Box
        position="absolute"
        top={4}
        left={4}
        bg="rgba(255, 255, 255, 0.9)"
        p={2}
        borderRadius="md"
        fontSize="xs"
        fontFamily="mono"
        zIndex={0}
        pointerEvents="auto"
        opacity={0.5}
        border="1px solid red"
      >
        <div>Viewport Debug Info:</div>
        <div>
          {canvasRect
            ? `Canvas: ${canvasRect.width.toFixed(0)}x${canvasRect.height.toFixed(0)}`
            : "No canvas rect"}
        </div>
        <div>Zoom: {(zoomLevel * 100).toFixed(1)}%</div>
        <div>
          Pan: ({viewport.logicalPanOffset.x.toFixed(1)},{" "}
          {viewport.logicalPanOffset.y.toFixed(1)})
        </div>
        <div>
          Viewport Canvas: ({viewport.logicalPanOffset.x.toFixed(1)},{" "}
          {viewport.logicalPanOffset.y.toFixed(1)})
        </div>
        <div>
          Viewport Size: {viewport.logicalWidth.toFixed(1)}x
          {viewport.logicalHeight.toFixed(1)}
        </div>
        <div>
          Screen Size: {viewport.screenWidth.toFixed(1)}x
          {viewport.screenHeight.toFixed(1)}
        </div>

        {/* Collapsible Drag State Section */}
        <div>
          <button
            style={toggleButtonStyle}
            onClick={() => setDragStateCollapsed(!dragStateCollapsed)}
          >
            {dragStateCollapsed ? "▶" : "▼"} Drag State
          </button>
          {!dragStateCollapsed && (
            <pre style={{ fontSize: "10px", margin: "4px 0 0 16px" }}>
              {JSON.stringify(dragState, null, 2)}
            </pre>
          )}
        </div>

        {/* Collapsible Dragged Lego Section */}
        <div>
          <button
            style={toggleButtonStyle}
            onClick={() => setDraggedLegoCollapsed(!draggedLegoCollapsed)}
          >
            {draggedLegoCollapsed ? "▶" : "▼"} Dragged Lego
          </button>
          {!draggedLegoCollapsed && (
            <pre style={{ fontSize: "10px", margin: "4px 0 0 16px" }}>
              {JSON.stringify({ ...draggedLego, style: null }, null, 2)}
            </pre>
          )}
        </div>

        <div>
          <button
            style={toggleButtonStyle}
            onClick={() => setGroupDragStateCollapsed(!groupDragStateCollapsed)}
          >
            {groupDragStateCollapsed ? "▶" : "▼"} Group Drag State
          </button>
          {!groupDragStateCollapsed && (
            <pre style={{ fontSize: "10px", margin: "4px 0 0 16px" }}>
              {JSON.stringify(groupDragState, null, 2)}
            </pre>
          )}
        </div>

        <div>
          <button
            style={toggleButtonStyle}
            onClick={() =>
              setCanvasDragStateCollapsed(!canvasDragStateCollapsed)
            }
          >
            {canvasDragStateCollapsed ? "▶" : "▼"} Canvas Drag State
          </button>
          {!canvasDragStateCollapsed && (
            <pre style={{ fontSize: "10px", margin: "4px 0 0 16px" }}>
              {JSON.stringify(canvasDragState, null, 2)}
            </pre>
          )}
        </div>
        <div>
          <button
            style={toggleButtonStyle}
            onClick={() => setDebugStateCollapsed(!debugStateCollapsed)}
          >
            {debugStateCollapsed ? "▶" : "▼"} Debug state
          </button>
          {!debugStateCollapsed && (
            <>
              <div style={{ fontSize: "10px", margin: "4px 0 0 16px" }}>
                Mouse window: {debugMousePos.x}, {debugMousePos.y}
              </div>
              <div style={{ fontSize: "10px", margin: "4px 0 0 16px" }}>
                Mouse canvas: {debugMouseCanvasPos.x}, {debugMouseCanvasPos.y}
              </div>
              <div style={{ fontSize: "10px", margin: "4px 0 0 16px" }}>
                Mouse logical: {debugMouseLogicalPos.x},{" "}
                {debugMouseLogicalPos.y}
              </div>
            </>
          )}
        </div>
        <div>
          <button
            style={toggleButtonStyle}
            onClick={() => setVisibleLegosCollapsed(!visibleLegosCollapsed)}
          >
            {visibleLegosCollapsed ? "▶" : "▼"} Visible Legos
          </button>
          {!visibleLegosCollapsed && (
            <pre style={{ fontSize: "10px", margin: "4px 0 0 16px" }}>
              {JSON.stringify(
                visibleLegos.map((lego) => lego.instanceId),
                null,
                2
              )}
            </pre>
          )}
        </div>
        <div>
          <button
            style={toggleButtonStyle}
            onClick={() => setLegDragStateCollapsed(!legDragStateCollapsed)}
          >
            {legDragStateCollapsed ? "▶" : "▼"} Leg Drag State
          </button>
          {!legDragStateCollapsed && (
            <pre style={{ fontSize: "10px", margin: "4px 0 0 16px" }}>
              {JSON.stringify(legDragState, null, 2)}
            </pre>
          )}
        </div>
      </Box>
    </>
  );
};
