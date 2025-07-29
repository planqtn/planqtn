import React, { useMemo } from "react";
import {
  Box,
  VStack,
  Text,
  useColorModeValue,
  IconButton,
  HStack,
  Collapse,
  Badge,
  Input
} from "@chakra-ui/react";
import {
  ChevronRightIcon,
  ChevronDownIcon,
  CopyIcon,
  DeleteIcon
} from "@chakra-ui/icons";
import { useCanvasStore } from "../../stores/canvasStateStore";
import { usePanelConfigStore } from "../../stores/panelConfigStore";
import { CachedTensorNetwork } from "../../stores/tensorNetworkStore";
import { FloatingPanelConfigManager } from "../floating-panel/FloatingPanelConfig";

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
interface SubnetsPanelProps {
  // No props needed for this component
}

type NodeContentType = "pcm" | "weightEnumerator" | "tensorNetwork";

interface TreeNode {
  id: string;
  name: string;
  nodeContentType?: NodeContentType;
  children?: TreeNode[];
}

interface TensorNetworkNode extends TreeNode {
  nodeContentType: "tensorNetwork";
  legoCount: number;
  calculationCount: number;
  isActive: boolean;
  cachedTensorNetwork: CachedTensorNetwork;
}

interface WeightEnumeratorNode extends TreeNode {
  signature: string;
  nodeContentType: "weightEnumerator";
  taskId: string;
  openLegsCount: number;
  truncateLength: number;
  cachedTensorNetwork: CachedTensorNetwork;
}

interface PCMNode extends TreeNode {
  signature: string;
  nodeContentType: "pcm";
  numDanglingLegs: number;
  pcmRows: number;
}

const SubnetsPanel: React.FC<SubnetsPanelProps> = () => {
  const bgColor = useColorModeValue("white", "gray.800");
  const borderColor = useColorModeValue("gray.200", "gray.600");
  const hoverBgColor = useColorModeValue("gray.50", "gray.700");
  const activeBgColor = useColorModeValue("blue.50", "blue.900");
  const activeBorderColor = useColorModeValue("blue.200", "blue.600");

  const cachedTensorNetworks = useCanvasStore(
    (state) => state.cachedTensorNetworks
  );
  const parityCheckMatrices = useCanvasStore(
    (state) => state.parityCheckMatrices
  );
  const weightEnumerators = useCanvasStore((state) => state.weightEnumerators);
  const tensorNetwork = useCanvasStore((state) => state.tensorNetwork);
  const cloneCachedTensorNetwork = useCanvasStore(
    (state) => state.cloneCachedTensorNetwork
  );
  const unCacheTensorNetwork = useCanvasStore(
    (state) => state.unCacheTensorNetwork
  );
  const unCachePCM = useCanvasStore((state) => state.unCachePCM);
  const unCacheWeightEnumerator = useCanvasStore(
    (state) => state.unCacheWeightEnumerator
  );
  const refreshAndSetCachedTensorNetworkFromCanvas = useCanvasStore(
    (state) => state.refreshAndSetCachedTensorNetworkFromCanvas
  );
  const updateCachedTensorNetworkName = useCanvasStore(
    (state) => state.updateCachedTensorNetworkName
  );
  const setTensorNetwork = useCanvasStore((state) => state.setTensorNetwork);
  const nextZIndex = usePanelConfigStore((state) => state.nextZIndex);
  const addPCMPanel = usePanelConfigStore((state) => state.addPCMPanel);
  const openPCMPanels = usePanelConfigStore((state) => state.openPCMPanels);

  // State for editing subnet names
  const [editingNodeId, setEditingNodeId] = React.useState<string | null>(null);

  // State for tree expansion - memoized based on cachedTensorNetworks
  const [expandedNodes, setExpandedNodes] = React.useState<Set<string>>(
    new Set()
  );

  // Memoize the expanded state to prevent unnecessary re-renders
  const isNodeExpanded = React.useCallback(
    (nodeId: string) => {
      return expandedNodes.has(nodeId);
    },
    [expandedNodes]
  );

  const toggleNodeExpansion = React.useCallback((nodeId: string) => {
    setExpandedNodes((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(nodeId)) {
        newSet.delete(nodeId);
      } else {
        newSet.add(nodeId);
      }
      return newSet;
    });
  }, []);

  const mapTensorNetworkToTreeNode = (
    network: CachedTensorNetwork
  ): TensorNetworkNode => {
    const enumerators =
      weightEnumerators[network.tensorNetwork.signature] || [];
    const calculationCount = enumerators.length;
    const hasPCM = parityCheckMatrices[network.tensorNetwork.signature];

    const children: TreeNode[] = [];

    // Add PCM node if it exists
    if (hasPCM) {
      const pcm = parityCheckMatrices[network.tensorNetwork.signature];
      const totalLegs = pcm ? pcm.matrix[0].length / 2 : 0;
      const pcmRows = pcm ? pcm.matrix.length : 0;
      children.push({
        id: `${network.tensorNetwork.signature}-pcm`,
        signature: network.tensorNetwork.signature,
        name: "Parity Check Matrix",
        nodeContentType: "pcm",
        numDanglingLegs: totalLegs,
        pcmRows: pcmRows
      } as PCMNode);
    }

    // Add weight enumerator nodes
    children.push(
      ...enumerators.map(
        (enumerator, index) =>
          ({
            id: `${network.tensorNetwork.signature}-enumerator-${index}`,
            signature: network.tensorNetwork.signature,
            name: enumerator.taskId
              ? `Task ${enumerator.taskId.slice(0, 8)}...`
              : `Weight Enumerator ${index + 1}`,
            nodeContentType: "weightEnumerator",
            taskId: enumerator.taskId,
            openLegsCount: enumerator.openLegs.length,
            truncateLength: enumerator.truncateLength,
            cachedTensorNetwork: network
          }) as WeightEnumeratorNode
      )
    );

    return {
      id: network.tensorNetwork.signature,
      name: network.name,
      nodeContentType: "tensorNetwork",
      legoCount: network.tensorNetwork.legos.length,
      calculationCount,
      isActive: network.isActive,
      cachedTensorNetwork: network,
      children
    } as TensorNetworkNode;
  };

  // Group cached tensor networks by active status
  const { activeNetworks, cachedNetworks } = useMemo(() => {
    const active: CachedTensorNetwork[] = [];
    const cached: CachedTensorNetwork[] = [];

    Object.values(cachedTensorNetworks).forEach((network) => {
      if (network.isActive) {
        active.push(network);
      } else {
        cached.push(network);
      }
    });

    return { activeNetworks: active, cachedNetworks: cached };
  }, [cachedTensorNetworks]);

  // Convert networks to tree nodes
  const activeNodes: TreeNode[] = useMemo(() => {
    return activeNetworks.map(mapTensorNetworkToTreeNode);
  }, [activeNetworks, weightEnumerators, parityCheckMatrices]);

  const cachedNodes: TreeNode[] = useMemo(() => {
    return cachedNetworks.map(mapTensorNetworkToTreeNode);
  }, [cachedNetworks, weightEnumerators, parityCheckMatrices]);

  const handleNetworkClick = (signature: string) => {
    refreshAndSetCachedTensorNetworkFromCanvas(signature);
  };

  const handleNameChange = (node: TensorNetworkNode, newName: string) => {
    if (node.cachedTensorNetwork && newName.trim()) {
      const sig = node.cachedTensorNetwork.tensorNetwork.signature;
      updateCachedTensorNetworkName(sig, newName.trim());
    }
    setTensorNetwork(null);
    setTimeout(() => {
      setTensorNetwork(node.cachedTensorNetwork.tensorNetwork);
    }, 1);
    setEditingNodeId(null);
  };

  const handleNameCancel = () => {
    setEditingNodeId(null);
  };

  const handleCloneClick = (node: TensorNetworkNode, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent triggering the parent click
    if (node.cachedTensorNetwork) {
      const sig = node.cachedTensorNetwork.tensorNetwork.signature;
      cloneCachedTensorNetwork(sig);
    }
  };

  const handleOpenPCMPanel = (node: PCMNode, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent triggering the parent click

    // Check if PCM panel is already open for this network
    if (openPCMPanels[node.signature]) {
      // Panel is already open, just bring it to front (this will be handled by the panel's own click handler)
      return;
    }

    const config = new FloatingPanelConfigManager({
      id: `pcm-${node.signature}`,
      title: `PCM - ${node.name}`,
      isOpen: true,
      isCollapsed: false,
      layout: {
        position: {
          x: 200 + Math.random() * 100,
          y: 200 + Math.random() * 100
        },
        size: { width: 500, height: 600 }
      },
      minWidth: 300,
      minHeight: 400,
      defaultWidth: 500,
      defaultHeight: 600,
      zIndex: nextZIndex
    });
    addPCMPanel(node.signature, config);
  };

  const handleUncacheClick = (node: TensorNetworkNode, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent triggering the parent click
    unCacheTensorNetwork(node.cachedTensorNetwork.tensorNetwork.signature);
  };

  const handleUncachePCMClick = (node: PCMNode, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent triggering the parent click
    unCachePCM(node.signature);
  };

  const handleUncacheWeightEnumeratorClick = (
    node: WeightEnumeratorNode,
    e: React.MouseEvent
  ) => {
    e.stopPropagation(); // Prevent triggering the parent click
    unCacheWeightEnumerator(node.signature, node.taskId);
  };

  // Separate display components for different node types
  const PCMNodeDisplay: React.FC<{ node: PCMNode }> = ({ node }) => (
    <>
      {/* Trashcan button for PCM nodes */}
      <IconButton
        aria-label="Uncache parity check matrix"
        icon={<DeleteIcon />}
        size="xs"
        variant="ghost"
        colorScheme="red"
        onClick={(e) => handleUncachePCMClick(node, e)}
        _hover={{
          bg: "red.100",
          color: "red.700"
        }}
      />
    </>
  );

  const WeightEnumeratorNodeDisplay: React.FC<{
    node: WeightEnumeratorNode;
  }> = ({ node }) => (
    <>
      {/* For weight enumerator nodes, show calculation type, truncation level, open legs count and weight enumerator-specific trashcan */}
      <Badge size="sm" colorScheme="teal">
        WEP
      </Badge>
      {node.truncateLength && (
        <Badge size="sm" colorScheme="purple">
          T{node.truncateLength}
        </Badge>
      )}
      <Badge size="sm" colorScheme="orange">
        {node.openLegsCount} legs
      </Badge>
      {/* Trashcan button for weight enumerator nodes */}
      {node.taskId && (
        <IconButton
          aria-label="Uncache weight enumerator"
          icon={<DeleteIcon />}
          size="xs"
          variant="ghost"
          colorScheme="red"
          onClick={(e) => handleUncacheWeightEnumeratorClick(node, e)}
          _hover={{
            bg: "red.100",
            color: "red.700"
          }}
        />
      )}
    </>
  );

  const TensorNetworkNodeDisplay: React.FC<{ node: TensorNetworkNode }> = ({
    node
  }) => (
    <>
      {/* For regular tensor network nodes */}
      <Badge size="sm" colorScheme="blue">
        {node.legoCount} legos
      </Badge>
      {node.calculationCount > 0 && (
        <Badge size="sm" colorScheme="green">
          {node.calculationCount} calcs
        </Badge>
      )}
      {/* Clone button for inactive networks */}
      {!node.isActive && node.cachedTensorNetwork && (
        <IconButton
          aria-label="Clone tensor network"
          icon={<CopyIcon />}
          size="xs"
          variant="ghost"
          colorScheme="gray"
          onClick={(e) => handleCloneClick(node, e)}
          _hover={{
            bg: "gray.100",
            color: "gray.700"
          }}
        />
      )}
      {/* Trashcan button for all tensor network nodes */}
      {node.cachedTensorNetwork && (
        <IconButton
          aria-label="Uncache tensor network"
          icon={<DeleteIcon />}
          size="xs"
          variant="ghost"
          colorScheme="red"
          onClick={(e) => handleUncacheClick(node, e)}
          _hover={{
            bg: "red.100",
            color: "red.700"
          }}
        />
      )}
    </>
  );

  const TreeNodeComponent: React.FC<{ node: TreeNode; level: number }> = ({
    node,
    level
  }) => {
    const hasChildren = node.children && node.children.length > 0;
    const isCurrentNetwork = tensorNetwork?.signature === node.id;
    const editableRef = React.useRef<HTMLInputElement>(null);

    const handleDoubleClick = (e: React.MouseEvent) => {
      // Only allow double-click for active tensor network nodes
      if (node.nodeContentType === "tensorNetwork") {
        const tensorNode = node as TensorNetworkNode;
        if (tensorNode.isActive) {
          e.stopPropagation();
          setEditingNodeId(node.id);
          // Use setTimeout to ensure the ref is available
          setTimeout(() => {
            if (editableRef.current) {
              editableRef.current.focus();
              editableRef.current.select(); // Select all text for easy editing
            }
          }, 0);
          return; // Exit early for double-click
        }
      }
    };

    const handleClick = (e: React.MouseEvent) => {
      console.log("handleClick", {
        node,
        e
      });
      // Handle double-click for renaming
      if (e.detail === 2) {
        handleDoubleClick(e);
        return; // Exit early for any double-click
      }

      // Handle single click
      if (
        node.nodeContentType === "tensorNetwork" &&
        !(node as TensorNetworkNode).isActive
      ) {
        return;
      }
      e.stopPropagation();

      // Handle different click behaviors based on node type
      if (node.nodeContentType === "pcm") {
        // For PCM nodes, open the PCM panel
        handleOpenPCMPanel(node as PCMNode, e as React.MouseEvent);
        handleNetworkClick((node as PCMNode).signature);
      } else if (node.nodeContentType === "tensorNetwork") {
        // For tensor network nodes, toggle expansion if they have children if the node is selected
        if (hasChildren && isCurrentNetwork) {
          toggleNodeExpansion(node.id);
        }

        // Select the network if not already selected
        const tensorNode = node as TensorNetworkNode;
        if (
          tensorNetwork?.signature !==
          tensorNode.cachedTensorNetwork.tensorNetwork.signature
        ) {
          handleNetworkClick(
            tensorNode.cachedTensorNetwork.tensorNetwork.signature
          );
        }
      }
    };

    return (
      <Box>
        <HStack
          spacing={2}
          p={2}
          pl={level * 4 + 2}
          cursor={
            (node.nodeContentType === "tensorNetwork" &&
              (node as TensorNetworkNode).isActive) ||
            node.nodeContentType === "pcm"
              ? "pointer"
              : "default"
          }
          bg={isCurrentNetwork ? activeBgColor : "transparent"}
          border={
            isCurrentNetwork
              ? `1px solid ${activeBorderColor}`
              : "1px solid transparent"
          }
          borderRadius="md"
          _hover={{
            bg:
              node.nodeContentType === "tensorNetwork" &&
              (node as TensorNetworkNode).isActive
                ? hoverBgColor
                : "transparent"
          }}
          onClick={handleClick}
        >
          {(node.nodeContentType === "tensorNetwork" && (
            <IconButton
              aria-label={isNodeExpanded(node.id) ? "Collapse" : "Expand"}
              icon={
                isNodeExpanded(node.id) ? (
                  <ChevronDownIcon />
                ) : (
                  <ChevronRightIcon />
                )
              }
              size="xs"
              variant="ghost"
              isDisabled={!hasChildren}
              onClick={(e) => {
                e.stopPropagation();
                toggleNodeExpansion(node.id);
              }}
            />
          )) || <Box w={4} />}

          {editingNodeId === node.id ? (
            <Input
              defaultValue={node.name}
              onBlur={(e) =>
                handleNameChange(node as TensorNetworkNode, e.target.value)
              }
              onKeyDown={(e) => {
                e.stopPropagation();
                if (e.key === "Enter") {
                  handleNameChange(
                    node as TensorNetworkNode,
                    e.currentTarget.value
                  );
                }
                if (e.key === "Escape") {
                  handleNameCancel();
                }
              }}
              onKeyUp={(e) => {
                e.stopPropagation();
              }}
              onClick={(e) => {
                e.stopPropagation();
              }}
              ref={editableRef}
            />
          ) : (
            <Text
              fontSize="sm"
              flex={1}
              textOverflow="ellipsis"
              overflow="hidden"
              whiteSpace="nowrap"
            >
              {node.name}
              {node.nodeContentType === "pcm" &&
                `[[${(node as PCMNode).numDanglingLegs},${(node as PCMNode).numDanglingLegs - (node as PCMNode).pcmRows}]]`}
            </Text>
          )}
          <HStack spacing={1}>
            {node.nodeContentType === "pcm" ? (
              <PCMNodeDisplay node={node as PCMNode} />
            ) : node.nodeContentType === "weightEnumerator" ? (
              <WeightEnumeratorNodeDisplay
                node={node as WeightEnumeratorNode}
              />
            ) : (
              <TensorNetworkNodeDisplay node={node as TensorNetworkNode} />
            )}
          </HStack>
        </HStack>
        {hasChildren && (
          <Collapse in={isNodeExpanded(node.id)}>
            <VStack align="stretch" spacing={0}>
              {node.children!.map((child) => (
                <TreeNodeComponent
                  key={child.id}
                  node={child}
                  level={level + 1}
                />
              ))}
            </VStack>
          </Collapse>
        )}
      </Box>
    );
  };

  return (
    <Box h="100%" bg={bgColor} overflowY="auto">
      <VStack align="stretch" spacing={0}>
        {/* Active Networks Section */}
        <Box p={3} borderBottom="1px" borderColor={borderColor}>
          <Text fontWeight="bold" fontSize="sm" color="green.600">
            On canvas
          </Text>
        </Box>
        {activeNodes.length > 0 ? (
          <VStack align="stretch" spacing={0}>
            {activeNodes.map((node) => (
              <TreeNodeComponent key={node.id} node={node} level={0} />
            ))}
          </VStack>
        ) : (
          <Box p={3}>
            <Text fontSize="sm" color="gray.500">
              No active tensor networks
            </Text>
          </Box>
        )}

        {/* Cached Networks Section */}
        <Box p={3} borderBottom="1px" borderColor={borderColor}>
          <Text fontWeight="bold" fontSize="sm" color="gray.600">
            Cached
          </Text>
        </Box>
        {cachedNodes.length > 0 ? (
          <VStack align="stretch" spacing={0}>
            {cachedNodes.map((node) => (
              <TreeNodeComponent key={node.id} node={node} level={0} />
            ))}
          </VStack>
        ) : (
          <Box p={3}>
            <Text fontSize="sm" color="gray.500">
              No cached tensor networks
            </Text>
          </Box>
        )}
      </VStack>
    </Box>
  );
};

export default SubnetsPanel;
