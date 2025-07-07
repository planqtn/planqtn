import axios from "axios";
import { Connection } from "../stores/connectionStore";
import { useCanvasStore } from "../stores/canvasStateStore";
import { config, getApiUrl } from "../config/config";
import { getAccessToken } from "./auth";
import { getAxiosErrorMessage } from "./errors";
import { useModalStore } from "../stores/modalStore";
import { DroppedLego } from "../stores/droppedLegoStore";
import { LogicalPoint } from "../types/coordinates";

export class NetworkService {
  private static async requestTensorNetwork(
    matrix: number[][],
    networkType: string
  ) {
    const { openLoadingModal, closeLoadingModal } = useModalStore.getState();
    const { newInstanceId } = useCanvasStore.getState();

    try {
      openLoadingModal("Generating network...");

      const accessToken = await getAccessToken();
      const key = !accessToken ? config.runtimeStoreAnonKey : accessToken;

      const response = await axios.post(
        getApiUrl("tensorNetwork"),
        {
          matrix,
          networkType: networkType,
          start_node_index: newInstanceId()
        },
        {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${key}`
          }
        }
      );

      return response;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(
          `Failed to create ${networkType} network: ${getAxiosErrorMessage(error)}`
        );
      } else {
        throw new Error(`Failed to create ${networkType} network`);
      }
    } finally {
      closeLoadingModal();
    }
  }

  static async createCssTannerNetwork(matrix: number[][]): Promise<void> {
    const response = await this.requestTensorNetwork(matrix, "CSS_TANNER");
    const { legos, connections } = response.data;

    await this.processNetworkResponse(legos, connections, "CSS Tanner");
  }

  static async createTannerNetwork(matrix: number[][]): Promise<void> {
    const response = await this.requestTensorNetwork(matrix, "TANNER");
    const { legos, connections } = response.data;

    await this.processNetworkResponse(legos, connections, "Tanner");
  }

  static async createMspNetwork(matrix: number[][]): Promise<void> {
    const response = await this.requestTensorNetwork(matrix, "MSP");
    const { legos, connections } = response.data;

    await this.processNetworkResponse(legos, connections, "MSP");
  }

  private static async processNetworkResponse(
    legos: DroppedLego[],
    connections: Connection[],
    networkType: string
  ): Promise<void> {
    const { addDroppedLegos, addConnections, addOperation } =
      useCanvasStore.getState();

    // Convert connections to proper Connection instances
    const newConnections = connections.map((conn: Connection) => {
      return new Connection(conn.from, conn.to);
    });

    // Position legos based on network type
    const positionedLegos = this.positionLegos(legos, networkType);

    // Add to stores
    addDroppedLegos(positionedLegos);
    addConnections(newConnections);

    addOperation({
      type: "add",
      data: {
        legosToAdd: positionedLegos,
        connectionsToAdd: newConnections
      }
    });
  }

  private static positionLegos(
    legos: DroppedLego[],
    networkType: string
  ): DroppedLego[] {
    const canvasWidth = 800;
    const nodeSpacing = 100;
    const margin = 50;

    switch (networkType) {
      case "CSS Tanner":
        return this.positionCssTannerLegos(legos, canvasWidth, nodeSpacing);
      case "Tanner":
        return this.positionTannerLegos(legos, canvasWidth, nodeSpacing);
      case "MSP":
        return this.positionMspLegos(legos, canvasWidth, margin);
      default:
        return legos;
    }
  }

  private static positionCssTannerLegos(
    legos: DroppedLego[],
    canvasWidth: number,
    nodeSpacing: number
  ): DroppedLego[] {
    // Group legos by type
    const zNodes = legos.filter((lego: DroppedLego) =>
      lego.shortName.startsWith("z")
    );
    const qNodes = legos.filter((lego: DroppedLego) =>
      lego.shortName.startsWith("q")
    );
    const xNodes = legos.filter((lego: DroppedLego) =>
      lego.shortName.startsWith("x")
    );

    return legos.map((lego: DroppedLego) => {
      let nodesInRow: DroppedLego[];
      let y: number;

      if (lego.shortName.startsWith("z")) {
        nodesInRow = zNodes;
        y = 100; // Top row
      } else if (lego.shortName.startsWith("q")) {
        nodesInRow = qNodes;
        y = 250; // Middle row
      } else {
        nodesInRow = xNodes;
        y = 400; // Bottom row
      }

      const indexInRow = nodesInRow.findIndex(
        (l) => l.instanceId === lego.instanceId
      );
      const x =
        (canvasWidth - (nodesInRow.length - 1) * nodeSpacing) / 2 +
        indexInRow * nodeSpacing;

      return lego.with({ logicalPosition: new LogicalPoint(x, y) });
    });
  }

  private static positionTannerLegos(
    legos: DroppedLego[],
    canvasWidth: number,
    nodeSpacing: number
  ): DroppedLego[] {
    // Group legos by type
    const checkNodes = legos.filter(
      (lego: DroppedLego) => !lego.shortName.startsWith("q")
    );
    const qNodes = legos.filter((lego: DroppedLego) =>
      lego.shortName.startsWith("q")
    );

    return legos.map((lego: DroppedLego) => {
      let nodesInRow: DroppedLego[];
      let y: number;

      if (lego.shortName.startsWith("q")) {
        nodesInRow = qNodes;
        y = 300; // Bottom row
      } else {
        nodesInRow = checkNodes;
        y = 150; // Top row
      }

      const indexInRow = nodesInRow.findIndex(
        (l) => l.instanceId === lego.instanceId
      );
      const x =
        (canvasWidth - (nodesInRow.length - 1) * nodeSpacing) / 2 +
        indexInRow * nodeSpacing;

      return lego.with({ logicalPosition: new LogicalPoint(x, y) });
    });
  }

  private static positionMspLegos(
    legos: DroppedLego[],
    canvasWidth: number,
    margin: number
  ): DroppedLego[] {
    // Find min/max x and y to determine scale
    const xValues = legos.map((lego: DroppedLego) => lego.logicalPosition.x);
    const yValues = legos.map((lego: DroppedLego) => lego.logicalPosition.y);
    const minX = Math.min(...xValues);
    const maxX = Math.max(...xValues);
    const minY = Math.min(...yValues);

    // Calculate scale to fit width with margins
    const xScale = ((canvasWidth - 2 * margin) / (maxX - minX || 1)) * 1.2;

    return legos.map((lego: DroppedLego) => {
      const x = margin + (lego.logicalPosition.x - minX) * xScale;
      const y = margin + (lego.logicalPosition.y - minY) * xScale;
      return lego.with({ logicalPosition: new LogicalPoint(x, y) });
    });
  }
}
