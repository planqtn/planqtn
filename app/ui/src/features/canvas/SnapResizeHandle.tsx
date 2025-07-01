import { Center, Icon, useColorModeValue } from "@chakra-ui/react";
import { FiChevronsLeft, FiChevronsRight } from "react-icons/fi";

interface SnapResizeHandleProps {
  onClick: () => void;
  panelMode: "extended" | "icons";
}

export const SnapResizeHandle: React.FC<SnapResizeHandleProps> = ({
  onClick,
  panelMode
}) => {
  const bgColor = useColorModeValue("gray.200", "gray.600");
  const hoverBgColor = useColorModeValue("gray.300", "gray.500");

  return (
    <Center
      onClick={onClick}
      cursor="pointer"
      bg={bgColor}
      _hover={{ bg: hoverBgColor }}
      w="12px"
      h="100%"
      transition="background-color 0.2s"
    >
      <Icon as={panelMode === "extended" ? FiChevronsLeft : FiChevronsRight} />
    </Center>
  );
};
