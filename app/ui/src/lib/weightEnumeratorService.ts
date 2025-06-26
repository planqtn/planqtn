import { TensorNetwork, TensorNetworkLeg } from "./TensorNetwork";
import { getApiUrl } from "../config";
import { getAccessToken } from "./auth";
import { config } from "../config";
import { User } from "@supabase/supabase-js";
import { useToast } from "@chakra-ui/react";

export interface WeightEnumeratorServiceOptions {
  currentUser: User;
  setTensorNetwork: (network: TensorNetwork | null) => void;
  setError: (error: string) => void;
  toast: ReturnType<typeof useToast>;
  weightEnumeratorCache: Map<
    string,
    {
      taskId: string;
      polynomial: string;
      normalizerPolynomial: string;
      truncateLength: number | null;
    }
  >;
}

export class WeightEnumeratorService {
  static async calculateWeightEnumerator(
    tensorNetwork: TensorNetwork,
    truncateLength: number | null,
    openLegs: TensorNetworkLeg[],
    options: WeightEnumeratorServiceOptions
  ): Promise<void> {
    const {
      currentUser,
      setTensorNetwork,
      setError,
      toast,
      weightEnumeratorCache
    } = options;

    if (!tensorNetwork) return;

    const signature = tensorNetwork.signature!;
    const cachedEnumerator = weightEnumeratorCache.get(signature);
    if (cachedEnumerator) {
      setTensorNetwork(
        TensorNetwork.fromObj({
          ...tensorNetwork,
          taskId: cachedEnumerator.taskId,
          weightEnumerator: cachedEnumerator.polynomial,
          normalizerPolynomial: cachedEnumerator.normalizerPolynomial,
          isCalculatingWeightEnumerator: cachedEnumerator.polynomial === ""
        })
      );
      return;
    }

    try {
      setTensorNetwork(
        TensorNetwork.fromObj({
          ...tensorNetwork,
          isCalculatingWeightEnumerator: true,
          weightEnumerator: undefined,
          taskId: undefined
        })
      );

      const accessToken = await getAccessToken();
      if (!accessToken) {
        throw new Error("Failed to get access token");
      }

      const response = await fetch(getApiUrl("planqtnJob"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`
        },
        body: JSON.stringify({
          user_id: currentUser?.id,
          request_time: new Date().toISOString(),
          job_type: "weightenumerator",
          task_store_url: config.userContextURL,
          task_store_anon_key: config.userContextAnonKey,
          payload: {
            legos: tensorNetwork.legos.reduce(
              (acc, lego) => {
                acc[lego.instanceId] = {
                  instanceId: lego.instanceId,
                  shortName: lego.shortName || "Generic Lego",
                  name: lego.shortName || "Generic Lego",
                  id: lego.id,
                  parity_check_matrix: lego.parity_check_matrix,
                  logical_legs: lego.logical_legs,
                  gauge_legs: lego.gauge_legs
                };
                return acc;
              },
              {} as Record<string, unknown>
            ),
            connections: tensorNetwork.connections,
            truncate_length: truncateLength,
            open_legs: openLegs || []
          }
        })
      });

      const data = await response.json();

      if (data.status === "error") {
        throw new Error(data.message);
      }

      const taskId = data.task_id;

      setTensorNetwork(
        TensorNetwork.fromObj({
          ...tensorNetwork,
          taskId: taskId
        })
      );

      weightEnumeratorCache.set(signature, {
        taskId: taskId,
        polynomial: "",
        normalizerPolynomial: "",
        truncateLength: null
      });

      toast({
        title: "Success starting the task!",
        description: "Weight enumerator calculation has been started.",
        status: "success",
        duration: 5000,
        isClosable: true
      });
    } catch (err) {
      console.error("Error calculating weight enumerator:", err);
      const errorMessage =
        err instanceof Error ? err.message : "Unknown error occurred";
      setError(`Failed to calculate weight enumerator: ${errorMessage}`);

      setTensorNetwork(
        TensorNetwork.fromObj({
          ...tensorNetwork,
          isCalculatingWeightEnumerator: false
        })
      );
    }
  }
}
