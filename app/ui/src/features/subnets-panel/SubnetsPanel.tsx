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
  ViewIcon,
  DeleteIcon
} from "@chakra-ui/icons";
import { useCanvasStore } from "../../stores/canvasStateStore";
import { CachedTensorNetwork } from "../../stores/tensorNetworkStore";
import { FloatingPanelConfigManager } from "../floating-panel/FloatingPanelConfig";

interface SubnetsPanelProps {
  // No props needed for this component
}

interface TreeNode {
  id: string;
  name: string;
  isActive: boolean;
  legoCount: number;
  calculationCount: number;
  children?: TreeNode[];
  cachedTensorNetwork?: CachedTensorNetwork;
  isPCM?: boolean;
  isWeightEnumerator?: boolean;
  taskId?: string;
  openLegsCount?: number;
  truncateLength?: number;
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
  const cloneCachedTensorNetwork = useCanvasStore(
    (state) => state.cloneCachedTensorNetwork
  );
  const parityCheckMatrices = useCanvasStore(
    (state) => state.parityCheckMatrices
  );
  const unCacheTensorNetwork = useCanvasStore(
    (state) => state.unCacheTensorNetwork
  );

  const unCachePCM = useCanvasStore((state) => state.unCachePCM);
  const unCacheWeightEnumerator = useCanvasStore(
    (state) => state.unCacheWeightEnumerator
  );

  const currentTensorNetwork = useCanvasStore((state) => state.tensorNetwork);
  const weightEnumerators = useCanvasStore((state) => state.weightEnumerators);
  const refreshAndSetCachedTensorNetworkFromCanvas = useCanvasStore(
    (state) => state.refreshAndSetCachedTensorNetworkFromCanvas
  );
  const addPCMPanel = useCanvasStore((state) => state.addPCMPanel);
  const nextZIndex = useCanvasStore((state) => state.nextZIndex);
  const updateCachedTensorNetworkName = useCanvasStore(
    (state) => state.updateCachedTensorNetworkName
  );

  // State for editing subnet names
  const [editingNodeId, setEditingNodeId] = React.useState<string | null>(null);

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
    return activeNetworks.map((network) => {
      const enumerators =
        weightEnumerators[network.tensorNetwork.signature] || [];
      const calculationCount = enumerators.length;
      const hasPCM = parityCheckMatrices[network.tensorNetwork.signature];

      const children: TreeNode[] = [];

      // Add PCM node if it exists
      if (hasPCM) {
        children.push({
          id: `${network.tensorNetwork.signature}-pcm`,
          name: "Parity Check Matrix",
          isActive: false,
          legoCount: 0,
          calculationCount: 0,
          cachedTensorNetwork: network,
          isPCM: true
        });
      }

      // Add weight enumerator nodes
      children.push(
        ...enumerators.map((enumerator, index) => ({
          id: `${network.tensorNetwork.signature}-enumerator-${index}`,
          name: enumerator.taskId
            ? `Task ${enumerator.taskId.slice(0, 8)}...`
            : `Weight Enumerator ${index + 1}`,
          isActive: false,
          legoCount: 0,
          calculationCount: 0,
          cachedTensorNetwork: network,
          isWeightEnumerator: true,
          taskId: enumerator.taskId,
          openLegsCount: enumerator.openLegs.length,
          truncateLength: enumerator.truncateLength
        }))
      );

      return {
        id: network.tensorNetwork.signature,
        name: network.name,
        isActive: true,
        legoCount: network.tensorNetwork.legos.length,
        calculationCount,
        cachedTensorNetwork: network,
        children
      } as TreeNode;
    });
  }, [activeNetworks, weightEnumerators, parityCheckMatrices]);

  const cachedNodes: TreeNode[] = useMemo(() => {
    return cachedNetworks.map((network) => {
      const enumerators =
        weightEnumerators[network.tensorNetwork.signature] || [];
      const calculationCount = enumerators.length;
      const hasPCM = parityCheckMatrices[network.tensorNetwork.signature];

      const children: TreeNode[] = [];

      // Add PCM node if it exists
      if (hasPCM) {
        children.push({
          id: `${network.tensorNetwork.signature}-pcm`,
          name: "Parity Check Matrix",
          isActive: false,
          legoCount: 0,
          calculationCount: 0,
          cachedTensorNetwork: network,
          isPCM: true
        });
      }

      // Add weight enumerator nodes
      children.push(
        ...enumerators.map((enumerator, index) => ({
          id: `${network.tensorNetwork.signature}-enumerator-${index}`,
          name: enumerator.taskId
            ? `Task ${enumerator.taskId.slice(0, 8)}...`
            : `Weight Enumerator ${index + 1}`,
          isActive: false,
          legoCount: 0,
          calculationCount: 0,
          cachedTensorNetwork: network,
          isWeightEnumerator: true,
          taskId: enumerator.taskId,
          openLegsCount: enumerator.openLegs.length,
          truncateLength: enumerator.truncateLength
        }))
      );

      return {
        id: network.tensorNetwork.signature,
        name: network.name,
        isActive: false,
        legoCount: network.tensorNetwork.legos.length,
        calculationCount,
        cachedTensorNetwork: network,
        children
      } as TreeNode;
    });
  }, [cachedNetworks, weightEnumerators, parityCheckMatrices]);

  const handleNetworkClick = (node: TreeNode) => {
    console.log("handleNetworkClick", {
      node
    });
    if (node.isActive && node.cachedTensorNetwork) {
      const sig = node.cachedTensorNetwork.tensorNetwork.signature;
      refreshAndSetCachedTensorNetworkFromCanvas(sig);
    }
    // For cached networks, do nothing as specified
  };

  const handleNameChange = (node: TreeNode, newName: string) => {
    if (node.cachedTensorNetwork && newName.trim()) {
      const sig = node.cachedTensorNetwork.tensorNetwork.signature;
      updateCachedTensorNetworkName(sig, newName.trim());
    }
    setEditingNodeId(null);
  };

  const handleNameCancel = () => {
    setEditingNodeId(null);
  };

  const handleCloneClick = (node: TreeNode, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent triggering the parent click
    if (node.cachedTensorNetwork) {
      const sig = node.cachedTensorNetwork.tensorNetwork.signature;
      cloneCachedTensorNetwork(sig);
    }
  };

  const handlePCMClick = (node: TreeNode, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent triggering the parent click
    if (node.cachedTensorNetwork) {
      const sig = node.cachedTensorNetwork.tensorNetwork.signature;
      const config = new FloatingPanelConfigManager({
        id: `pcm-${sig}`,
        title: `PCM - ${node.cachedTensorNetwork.name}`,
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
      addPCMPanel(sig, config);
    }
  };

  const handleUncacheClick = (node: TreeNode, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent triggering the parent click
    if (node.cachedTensorNetwork) {
      const sig = node.cachedTensorNetwork.tensorNetwork.signature;
      unCacheTensorNetwork(sig);
    }
  };

  const handleUncachePCMClick = (node: TreeNode, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent triggering the parent click
    if (node.cachedTensorNetwork) {
      const sig = node.cachedTensorNetwork.tensorNetwork.signature;
      unCachePCM(sig);
    }
  };

  const handleUncacheWeightEnumeratorClick = (
    node: TreeNode,
    e: React.MouseEvent
  ) => {
    e.stopPropagation(); // Prevent triggering the parent click
    if (node.cachedTensorNetwork && node.taskId) {
      const sig = node.cachedTensorNetwork.tensorNetwork.signature;
      unCacheWeightEnumerator(sig, node.taskId);
    }
  };

  const TreeNodeComponent: React.FC<{ node: TreeNode; level: number }> = ({
    node,
    level
  }) => {
    const [isExpanded, setIsExpanded] = React.useState(false);
    const hasChildren = node.children && node.children.length > 0;
    const isCurrentNetwork = currentTensorNetwork?.signature === node.id;
    const editableRef = React.useRef<any>(null);

    const handleClick = () => {
      if (hasChildren) {
        setIsExpanded(!isExpanded);
      }
      handleNetworkClick(node);
    };

    const handleDoubleClick = () => {
      console.log("handleDoubleClick", {
        node
      });
      if (node.cachedTensorNetwork && !node.isPCM && !node.isWeightEnumerator) {
        setEditingNodeId(node.id);
        // Use setTimeout to ensure the ref is available
        setTimeout(() => {
          if (editableRef.current) {
            editableRef.current.focus();
          }
        }, 0);
      }
    };

    return (
      <Box>
        <HStack
          spacing={2}
          p={2}
          pl={level * 4 + 2}
          cursor={node.isActive ? "pointer" : "default"}
          bg={isCurrentNetwork ? activeBgColor : "transparent"}
          border={
            isCurrentNetwork
              ? `1px solid ${activeBorderColor}`
              : "1px solid transparent"
          }
          borderRadius="md"
          _hover={{
            bg: node.isActive ? hoverBgColor : "transparent"
          }}
          onClick={handleClick}
          onDoubleClick={handleDoubleClick}
        >
          {hasChildren && (
            <IconButton
              aria-label={isExpanded ? "Collapse" : "Expand"}
              icon={isExpanded ? <ChevronDownIcon /> : <ChevronRightIcon />}
              size="xs"
              variant="ghost"
              onClick={(e) => {
                e.stopPropagation();
                setIsExpanded(!isExpanded);
              }}
            />
          )}
          {editingNodeId === node.id ? (
            <Input
              defaultValue={node.name}
              onBlur={(e) => handleNameChange(node, e.target.value)}
              onKeyPress={(e) => {
                if (e.key === "Enter") {
                  handleNameChange(node, e.currentTarget.value);
                }
              }}
              onKeyDown={(e) => {
                if (e.key === "Escape") {
                  handleNameCancel();
                }
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
            </Text>
          )}
          <HStack spacing={1}>
            {/* For PCM nodes, show table icon and PCM-specific trashcan */}
            {node.isPCM ? (
              <>
                <IconButton
                  aria-label="View parity check matrix"
                  icon={<ViewIcon />}
                  size="xs"
                  variant="ghost"
                  colorScheme="purple"
                  onClick={(e) => handlePCMClick(node, e)}
                  _hover={{
                    bg: "purple.100",
                    color: "purple.700"
                  }}
                />
                {/* Trashcan button for PCM nodes */}
                {node.cachedTensorNetwork && (
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
                )}
              </>
            ) : node.isWeightEnumerator ? (
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
                  {node.openLegsCount} open legs
                </Badge>
                {/* Trashcan button for weight enumerator nodes */}
                {node.cachedTensorNetwork && node.taskId && (
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
            ) : (
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
            )}
          </HStack>
        </HStack>
        {hasChildren && (
          <Collapse in={isExpanded}>
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
