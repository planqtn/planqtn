import React, { useMemo } from "react";
import {
  Box,
  VStack,
  Text,
  useColorModeValue,
  IconButton,
  HStack,
  Collapse,
  Badge
} from "@chakra-ui/react";
import { ChevronRightIcon, ChevronDownIcon } from "@chakra-ui/icons";
import { useCanvasStore } from "../../stores/canvasStateStore";
import { CachedTensorNetwork } from "../../stores/tensorNetworkStore";

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

  const currentTensorNetwork = useCanvasStore((state) => state.tensorNetwork);
  const setTensorNetwork = useCanvasStore((state) => state.setTensorNetwork);
  const weightEnumerators = useCanvasStore((state) => state.weightEnumerators);
  const refreshActiveCachedTensorNetworkFromCanvasState = useCanvasStore(
    (state) => state.refreshActiveCachedTensorNetworkFromCanvasState
  );

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

      return {
        id: network.tensorNetwork.signature,
        name: network.name,
        isActive: true,
        legoCount: network.tensorNetwork.legos.length,
        calculationCount,
        cachedTensorNetwork: network,
        children: enumerators.map((enumerator, index) => ({
          id: `${network.tensorNetwork.signature}-enumerator-${index}`,
          name: enumerator.taskId
            ? `Task ${enumerator.taskId.slice(0, 8)}...`
            : `Weight Enumerator ${index + 1}`,
          isActive: false,
          legoCount: 0,
          calculationCount: 0
        }))
      } as TreeNode;
    });
  }, [activeNetworks, weightEnumerators]);

  const cachedNodes: TreeNode[] = useMemo(() => {
    return cachedNetworks.map((network) => {
      const enumerators =
        weightEnumerators[network.tensorNetwork.signature] || [];
      const calculationCount = enumerators.length;

      return {
        id: network.tensorNetwork.signature,
        name: network.name,
        isActive: false,
        legoCount: network.tensorNetwork.legos.length,
        calculationCount,
        cachedTensorNetwork: network,
        children: enumerators.map((enumerator, index) => ({
          id: `${network.tensorNetwork.signature}-enumerator-${index}`,
          name: enumerator.taskId
            ? `Task ${enumerator.taskId.slice(0, 8)}...`
            : `Weight Enumerator ${index + 1}`,
          isActive: false,
          legoCount: 0,
          calculationCount: 0
        }))
      } as TreeNode;
    });
  }, [cachedNetworks, weightEnumerators]);

  const handleNetworkClick = (node: TreeNode) => {
    console.log("handleNetworkClick", {
      node
    });
    if (node.isActive && node.cachedTensorNetwork) {
      const sig = node.cachedTensorNetwork.tensorNetwork.signature;
      refreshActiveCachedTensorNetworkFromCanvasState(sig);
      node.cachedTensorNetwork = cachedTensorNetworks[sig];
      console.log(
        "node.cachedTensorNetwork",
        node.cachedTensorNetwork.tensorNetwork.legos.map(
          (lego) => lego.logicalPosition.x + "," + lego.logicalPosition.y
        )
      );
      setTensorNetwork(node.cachedTensorNetwork.tensorNetwork);
    }
    // For cached networks, do nothing as specified
  };

  const TreeNodeComponent: React.FC<{ node: TreeNode; level: number }> = ({
    node,
    level
  }) => {
    const [isExpanded, setIsExpanded] = React.useState(false);
    const hasChildren = node.children && node.children.length > 0;
    const isCurrentNetwork = currentTensorNetwork?.signature === node.id;

    const handleClick = () => {
      if (hasChildren) {
        setIsExpanded(!isExpanded);
      }
      handleNetworkClick(node);
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
          <Text fontSize="sm" flex={1}>
            {node.name}
          </Text>
          <HStack spacing={1}>
            <Badge size="sm" colorScheme="blue">
              {node.legoCount} legos
            </Badge>
            {node.calculationCount > 0 && (
              <Badge size="sm" colorScheme="green">
                {node.calculationCount} calcs
              </Badge>
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
            Active
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
