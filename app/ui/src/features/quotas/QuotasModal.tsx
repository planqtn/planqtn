import React, { useEffect, useState } from "react";
import {
  Modal,
  ModalOverlay,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalCloseButton,
  VStack,
  HStack,
  Text,
  Progress,
  Box,
  useColorModeValue,
  Spinner,
  Alert,
  AlertIcon,
  Badge
} from "@chakra-ui/react";
import { userContextSupabase } from "../../config/supabaseClient";

interface Quota {
  id: string;
  user_id: string;
  quota_type: string;
  monthly_limit: number;
  created_at: string;
}

interface QuotasModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const QuotasModal: React.FC<QuotasModalProps> = ({
  isOpen,
  onClose
}) => {
  const [quotas, setQuotas] = useState<Quota[]>([]);
  const [quotaUsage, setQuotaUsage] = useState<Map<string, number>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const bgColor = useColorModeValue("white", "gray.800");
  const borderColor = useColorModeValue("gray.200", "gray.600");

  useEffect(() => {
    if (isOpen && userContextSupabase) {
      fetchQuotas();
    }
  }, [isOpen]);

  const fetchQuotas = async () => {
    if (!userContextSupabase) {
      setError("No Supabase client available");
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Get current user
      const {
        data: { user },
        error: userError
      } = await userContextSupabase.auth.getUser();
      if (userError || !user) {
        setError("Failed to get user information");
        setLoading(false);
        return;
      }

      // Fetch quotas for the user
      const { data: quotasData, error: quotasError } = await userContextSupabase
        .from("quotas")
        .select("*")
        .eq("user_id", user.id);

      if (quotasError) {
        setError(`Failed to fetch quotas: ${quotasError.message}`);
        setLoading(false);
        return;
      }

      setQuotas(quotasData || []);

      // Fetch usage for each quota for the current month
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);

      const usageMap = new Map<string, number>();

      for (const quota of quotasData || []) {
        const { data: usageData, error: usageError } = await userContextSupabase
          .from("quota_usage")
          .select("amount_used.sum()")
          .eq("quota_id", quota.id)
          .gte("usage_ts", startOfMonth.toISOString())
          .lte("usage_ts", endOfMonth.toISOString())
          .single();

        if (usageError) {
          console.error(
            `Failed to fetch usage for quota ${quota.id}:`,
            usageError
          );
          usageMap.set(quota.id, 0);
        } else {
          usageMap.set(quota.id, usageData?.sum ?? 0);
        }
      }

      setQuotaUsage(usageMap);
    } catch (err) {
      setError(
        `Unexpected error: ${err instanceof Error ? err.message : "Unknown error"}`
      );
    } finally {
      setLoading(false);
    }
  };

  const getQuotaTypeDisplayName = (quotaType: string): string => {
    switch (quotaType) {
      case "cloud-run-minutes":
        return "Cloud Run Minutes";
      default:
        return quotaType
          .replace(/-/g, " ")
          .replace(/\b\w/g, (l) => l.toUpperCase());
    }
  };

  const getProgressColor = (usage: number, limit: number): string => {
    const percentage = (usage / limit) * 100;
    if (percentage >= 90) return "red";
    if (percentage >= 75) return "orange";
    if (percentage >= 50) return "yellow";
    return "green";
  };

  const formatUsage = (usage: number, quotaType: string): string => {
    switch (quotaType) {
      case "cloud-run-minutes":
        return `${usage} minutes`;
      default:
        return usage.toString();
    }
  };

  const formatLimit = (limit: number, quotaType: string): string => {
    switch (quotaType) {
      case "cloud-run-minutes":
        return `${limit} minutes`;
      default:
        return limit.toString();
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="md">
      <ModalOverlay />
      <ModalContent bg={bgColor} borderColor={borderColor}>
        <ModalHeader>My Quotas</ModalHeader>
        <ModalCloseButton />
        <ModalBody pb={6}>
          {loading ? (
            <VStack spacing={4} py={8}>
              <Spinner size="lg" />
              <Text>Loading quota information...</Text>
            </VStack>
          ) : error ? (
            <Alert status="error">
              <AlertIcon />
              {error}
            </Alert>
          ) : quotas.length === 0 ? (
            <VStack spacing={4} py={8}>
              <Text>No quotas found for your account.</Text>
            </VStack>
          ) : (
            <VStack spacing={4} align="stretch">
              {quotas.map((quota) => {
                const usage = quotaUsage.get(quota.id) || 0;
                const percentage = Math.min(
                  (usage / quota.monthly_limit) * 100,
                  100
                );
                const progressColor = getProgressColor(
                  usage,
                  quota.monthly_limit
                );

                return (
                  <Box
                    key={quota.id}
                    p={4}
                    border="1px"
                    borderColor={borderColor}
                    borderRadius="md"
                    bg={useColorModeValue("gray.50", "gray.700")}
                  >
                    <VStack spacing={3} align="stretch">
                      <HStack justify="space-between">
                        <Text fontWeight="semibold">
                          {getQuotaTypeDisplayName(quota.quota_type)}
                        </Text>
                        <Badge
                          colorScheme={progressColor === "red" ? "red" : "blue"}
                        >
                          {percentage.toFixed(1)}%
                        </Badge>
                      </HStack>

                      <Box>
                        <Progress
                          value={percentage}
                          colorScheme={progressColor}
                          size="lg"
                          borderRadius="md"
                        />
                      </Box>

                      <HStack
                        justify="space-between"
                        fontSize="sm"
                        color="gray.600"
                      >
                        <Text>
                          Used: {formatUsage(usage, quota.quota_type)}
                        </Text>
                        <Text>
                          Limit:{" "}
                          {formatLimit(quota.monthly_limit, quota.quota_type)}
                        </Text>
                      </HStack>

                      <Text fontSize="xs" color="gray.500">
                        Resets monthly
                      </Text>
                    </VStack>
                  </Box>
                );
              })}
            </VStack>
          )}
        </ModalBody>
      </ModalContent>
    </Modal>
  );
};
