import { Box, Progress, Text, VStack, HStack, Spinner } from "@chakra-ui/react";

interface IterationStatus {
  desc: string;
  total_size: number;
  current_item: number;
  start_time: number;
  end_time: number | null;
  duration: number;
  avg_time_per_item: number;
}

interface ProgressBarsProps {
  iterationStatus: IterationStatus[];
  waiting: boolean;
}

const formatDuration = (seconds: number): string => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours}h ${minutes}m ${secs}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${secs}s`;
  } else {
    return `${secs}s`;
  }
};

const formatTime = (timestamp: number): string => {
  return new Date(timestamp * 1000).toLocaleTimeString();
};

const formatAverageTime = (avgTime: number): string => {
  if (avgTime < 1) {
    return `${(1 / avgTime).toFixed(2)} it/s`;
  } else {
    return `${avgTime.toFixed(2)} s/it`;
  }
};

const calculateETA = (status: IterationStatus): string => {
  const remainingItems = status.total_size - status.current_item;
  const estimatedTime = remainingItems * status.avg_time_per_item;
  return formatDuration(estimatedTime);
};

const ProgressBars: React.FC<ProgressBarsProps> = ({
  iterationStatus,
  waiting
}) => {
  if (waiting && (!iterationStatus || iterationStatus.length === 0)) {
    return (
      <HStack>
        <Spinner size="sm" />
        <Text>Waiting for update...</Text>
      </HStack>
    );
  }

  return (
    <VStack align="stretch" spacing={4} width="100%">
      {iterationStatus.map((status, index) => (
        <Box key={index} pl={index > 0 ? 4 : 0}>
          <VStack align="stretch" spacing={1}>
            <HStack justify="space-between">
              <Text fontSize="sm" fontWeight="medium">
                {status.desc}
              </Text>
              <Text fontSize="xs" color="gray.500">
                {status.current_item - 1}/{status.total_size}
              </Text>
            </HStack>
            <Progress
              value={((status.current_item - 1) / status.total_size) * 100}
              size="sm"
              colorScheme="blue"
            />
            <HStack justify="space-between" fontSize="xs" color="gray.500">
              <Text>Started: {formatTime(status.start_time)}</Text>
              <Text>Duration: {formatDuration(status.duration)}</Text>
              <Text>
                ETA: {calculateETA(status)} (
                {formatAverageTime(status.avg_time_per_item)})
              </Text>
            </HStack>
          </VStack>
        </Box>
      ))}
    </VStack>
  );
};

export default ProgressBars;
