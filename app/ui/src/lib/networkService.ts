import axios from "axios";
import { Connection } from "../stores/connectionStore";
import { useCanvasStore } from "../stores/canvasStateStore";
import { config, getApiUrl } from "../config/config";
import { getAccessToken } from "../features/auth/auth";
import { getAxiosErrorMessage } from "./errors";
import { DroppedLego } from "../stores/droppedLegoStore";
import { LogicalPoint } from "../types/coordinates";

interface ResponseLego {
  instance_id: string;
  type_id: string;
  short_name: string;
  description: string;
  x: number;
  y: number;
  parity_check_matrix: number[][];
  logical_legs: number[];
  gauge_legs: number[];
}

interface ResponseConnection {
  from: {
    legoId: string;
    leg_index: number;
  };
  to: {
    legoId: string;
    leg_index: number;
  };
}

interface NetworkResponse {
  legos: ResponseLego[];
  connections: ResponseConnection[];
}

export class NetworkService {
  private static async requestTensorNetwork(
    matrix: number[][],
    networkType: string
  ) {
    const openLoadingModal = useCanvasStore((state) => state.openLoadingModal);
    const closeLoadingModal = useCanvasStore(
      (state) => state.closeLoadingModal
    );
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
    await this.processNetworkResponse(response.data, "CSS Tanner");
  }

  static async createTannerNetwork(matrix: number[][]): Promise<void> {
    const response = await this.requestTensorNetwork(matrix, "TANNER");
    await this.processNetworkResponse(response.data, "Tanner");
  }

  static async createMspNetwork(matrix: number[][]): Promise<void> {
    const response = await this.requestTensorNetwork(matrix, "MSP");
    await this.processNetworkResponse(response.data, "MSP");
  }

  private static async processNetworkResponse(
    response: NetworkResponse,
    networkType: string
  ): Promise<void> {
    const { legos: rawLegos, connections: rawConnections } = response;
    const legos = rawLegos.map(
      (lego: ResponseLego) =>
        new DroppedLego(
          {
            type_id: lego.type_id,
            name: lego.short_name,
            short_name: lego.short_name,
            description: lego.short_name,
            parity_check_matrix: lego.parity_check_matrix,
            logical_legs: lego.logical_legs,
            gauge_legs: lego.gauge_legs
          },
          new LogicalPoint(lego.x, lego.y),
          lego.instance_id
        )
    );
    const connections = rawConnections.map(
      (connection: ResponseConnection) =>
        new Connection(connection.from, connection.to)
    );
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
      lego.short_name.startsWith("z")
    );
    const qNodes = legos.filter((lego: DroppedLego) =>
      lego.short_name.startsWith("q")
    );
    const xNodes = legos.filter((lego: DroppedLego) =>
      lego.short_name.startsWith("x")
    );

    return legos.map((lego: DroppedLego) => {
      let nodesInRow: DroppedLego[];
      let y: number;

      if (lego.short_name.startsWith("z")) {
        nodesInRow = zNodes;
        y = 100; // Top row
      } else if (lego.short_name.startsWith("q")) {
        nodesInRow = qNodes;
        y = 250; // Middle row
      } else {
        nodesInRow = xNodes;
        y = 400; // Bottom row
      }

      const indexInRow = nodesInRow.findIndex(
        (l) => l.instance_id === lego.instance_id
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
      (lego: DroppedLego) => !lego.short_name.startsWith("q")
    );
    const qNodes = legos.filter((lego: DroppedLego) =>
      lego.short_name.startsWith("q")
    );

    return legos.map((lego: DroppedLego) => {
      let nodesInRow: DroppedLego[];
      let y: number;

      if (lego.short_name.startsWith("q")) {
        nodesInRow = qNodes;
        y = 300; // Bottom row
      } else {
        nodesInRow = checkNodes;
        y = 150; // Top row
      }

      const indexInRow = nodesInRow.findIndex(
        (l) => l.instance_id === lego.instance_id
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
