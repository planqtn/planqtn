import { Box, useColorModeValue } from "@chakra-ui/react";
import { PanelResizeHandle } from "react-resizable-panels";

interface ResizeHandleProps {
  id: string;
  position?: "left" | "right";
}

export const ResizeHandle: React.FC<ResizeHandleProps> = ({
  id,
  position = "right"
}) => {
  const bgColor = useColorModeValue("gray.200", "gray.600");

  return (
    <PanelResizeHandle style={{ position: "relative" }} id={id}>
      <Box
        w="5px"
        h="100%"
        bg={bgColor}
        cursor="col-resize"
        transition="background-color 0.2s"
        _hover={{ bg: "blue.500" }}
        style={{
          position: "absolute",
          [position]: "-2px",
          top: 0
        }}
      />
    </PanelResizeHandle>
  );
};
