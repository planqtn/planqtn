import React, { useState, useMemo } from "react";
import { useCanvasStore } from "../../stores/canvasStateStore";
import { BoundingBox } from "../../stores/canvasUISlice";

interface SubnetNameDisplayProps {
  boundingBox: BoundingBox;
  networkSignature: string;
  networkName: string;
  isSingleLego?: boolean;
  singleLegoInstanceId?: string;
}

export const SubnetNameDisplay: React.FC<SubnetNameDisplayProps> = ({
  boundingBox,
  networkSignature,
  networkName,
  isSingleLego = false,
  singleLegoInstanceId
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(networkName);
  const updateCachedTensorNetworkName = useCanvasStore(
    (state) => state.updateCachedTensorNetworkName
  );
  const cachedTensorNetworks = useCanvasStore(
    (state) => state.cachedTensorNetworks
  );
  const cacheTensorNetwork = useCanvasStore(
    (state) => state.cacheTensorNetwork
  );
  const tensorNetwork = useCanvasStore((state) => state.tensorNetwork);
  const updateDroppedLego = useCanvasStore((state) => state.updateDroppedLego);
  const droppedLegos = useCanvasStore((state) => state.droppedLegos);

  // Get the current display name (for single legos, this might change as the short_name is updated)
  const currentDisplayName = useMemo(() => {
    if (isSingleLego && singleLegoInstanceId) {
      const lego = droppedLegos.find(
        (lego) => lego.instance_id === singleLegoInstanceId
      );
      return lego?.short_name || networkName;
    }
    return networkName;
  }, [isSingleLego, singleLegoInstanceId, droppedLegos, networkName]);

  // Calculate text dimensions based on text length and font size
  const textDimensions = useMemo(() => {
    const fontSize = 12;
    const fontFamily = "system-ui, sans-serif";
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");

    if (context) {
      context.font = `${fontSize}px ${fontFamily}`;
      const metrics = context.measureText(currentDisplayName);
      return {
        width: metrics.width + 16, // Add padding
        height: fontSize + 8 // Approximate height
      };
    }

    // Fallback calculation
    return {
      width: currentDisplayName.length * 7 + 16, // Approximate width
      height: 20
    };
  }, [currentDisplayName]);

  const handleNameChange = () => {
    if (editValue.trim()) {
      if (isSingleLego && singleLegoInstanceId) {
        const legoToUpdate = droppedLegos.find(
          (lego) => lego.instance_id === singleLegoInstanceId
        );
        if (legoToUpdate) {
          const updatedLego = legoToUpdate.with({
            short_name: editValue.trim()
          });
          updateDroppedLego(singleLegoInstanceId, updatedLego);
        }
      } else if (!(networkSignature in cachedTensorNetworks)) {
        cacheTensorNetwork({
          tensorNetwork: tensorNetwork!,
          name: editValue.trim(),
          isActive: true,
          svg: "<svg>render me</svg>",
          isLocked: false,
          lastUpdated: new Date()
        });
      } else {
        updateCachedTensorNetworkName(networkSignature, editValue.trim());
      }
    } else {
      if (isSingleLego && singleLegoInstanceId) {
        const lego = droppedLegos.find(
          (lego) => lego.instance_id === singleLegoInstanceId
        );
        setEditValue(lego?.short_name || networkName);
      } else {
        setEditValue(networkName);
      }
    }
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    e.stopPropagation();
    if (e.key === "Enter") {
      handleNameChange();
    } else if (e.key === "Escape") {
      if (isSingleLego && singleLegoInstanceId) {
        const lego = droppedLegos.find(
          (lego) => lego.instance_id === singleLegoInstanceId
        );
        setEditValue(lego?.short_name || networkName);
      } else {
        setEditValue(networkName);
      }
      setIsEditing(false);
    }
  };

  const handleDoubleClick = () => {
    setIsEditing(true);
    if (isSingleLego && singleLegoInstanceId) {
      const lego = droppedLegos.find(
        (lego) => lego.instance_id === singleLegoInstanceId
      );
      setEditValue(lego?.short_name || networkName);
    } else {
      setEditValue(networkName);
    }
  };

  // Position the label above the bounding box
  const labelX = boundingBox.minX + boundingBox.width / 2;
  const labelY = boundingBox.minY - 60;

  // Background rectangle position (centered on text)
  const bgX = labelX - textDimensions.width / 2;
  const bgY = labelY - textDimensions.height - 2;

  if (isEditing) {
    return (
      <g>
        {/* Background for input */}
        <rect
          x={bgX}
          y={bgY}
          width={Math.max(textDimensions.width, 120)} // Minimum width for input
          height={textDimensions.height}
          fill="white"
          stroke="#e2e8f0"
          strokeWidth="1"
          rx="4"
        />
        {/* Input field */}
        <foreignObject
          x={bgX + 4}
          y={bgY + 2}
          width={Math.max(textDimensions.width - 8, 112)}
          height={textDimensions.height - 4}
          onClick={(e) => e.stopPropagation()}
          onMouseDown={(e) => e.stopPropagation()}
          onMouseUp={(e) => e.stopPropagation()}
          pointerEvents="all"
        >
          <input
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onKeyDown={handleKeyDown}
            onBlur={handleNameChange}
            style={{
              width: "100%",
              height: "100%",
              border: "none",
              outline: "none",
              fontSize: "12px",
              fontFamily: "inherit",
              background: "transparent"
            }}
            autoFocus
          />
        </foreignObject>
      </g>
    );
  }

  return (
    <g
      pointerEvents="all"
      onDoubleClick={handleDoubleClick}
      style={{ cursor: "pointer" }}
    >
      {/* Background rectangle */}
      <rect
        x={bgX}
        y={bgY}
        width={textDimensions.width}
        height={textDimensions.height}
        fill="white"
        stroke="#e2e8f0"
        strokeWidth="1"
        rx="4"
      />
      {/* Text label */}
      <text
        x={labelX}
        y={labelY - 10}
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize="12"
        fontFamily="system-ui, sans-serif"
        fontWeight="500"
        fill="#374151"
      >
        {currentDisplayName}
      </text>
    </g>
  );
};
