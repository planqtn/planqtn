import axios from "axios";

import { NetworkService } from "./networkService";
import * as cssNetworkResponse from "./test_data/css_network_response_bell_pair.json";

jest.mock("axios");

const mockedAxios = axios as jest.Mocked<typeof axios>;

// Create mock functions outside so Jest can track them
const mockAddDroppedLegos = jest.fn();
const mockAddConnections = jest.fn();
const mockAddOperation = jest.fn();
const mockNewInstanceId = jest.fn(() => "1");

jest.mock("../stores/canvasStateStore", () => ({
  useCanvasStore: {
    getState: jest.fn(() => ({
      newInstanceId: mockNewInstanceId,
      addDroppedLegos: mockAddDroppedLegos,
      addConnections: mockAddConnections,
      addOperation: mockAddOperation,
      openLoadingModal: jest.fn(),
      closeLoadingModal: jest.fn()
    }))
  }
}));

jest.mock("../config/config");
jest.mock("../features/auth/auth");

export const getApiUrl = (endpoint: string) => `mocked-api-url/${endpoint}`;

describe("NetworkService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("createCssTannerNetwork", () => {
    // repro https://github.com/planqtn/planqtn/issues/108
    it("should process the network response correctly", async () => {
      mockedAxios.post.mockResolvedValue({ data: cssNetworkResponse });

      const matrix = [
        [1, 0, 0, 1],
        [0, 1, 1, 0]
      ]; // Example matrix

      await NetworkService.createCssTannerNetwork(matrix);

      expect(mockAddDroppedLegos).toHaveBeenCalled();
      expect(mockAddConnections).toHaveBeenCalled();
      expect(mockAddOperation).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "add"
        })
      );
    });
  });
});
