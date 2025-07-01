import { Badge } from "@chakra-ui/react";

const TaskStateLabel: React.FC<{ state: number }> = ({ state }) => {
  const getStateInfo = (state: number) => {
    switch (state) {
      case 0:
        return { label: "PENDING", color: "yellow" };
      case 1:
        return { label: "RUNNING", color: "blue" };
      case 2:
        return { label: "SUCCESS", color: "green" };
      case 3:
        return { label: "FAILED", color: "red" };
      case 4:
        return { label: "CANCELLED", color: "gray" };
      default:
        return { label: "UNKNOWN", color: "gray" };
    }
  };

  const { label, color } = getStateInfo(state);
  return (
    <Badge colorScheme={color} fontSize="sm" px={2} py={1} borderRadius="md">
      {label}
    </Badge>
  );
};

export default TaskStateLabel;
