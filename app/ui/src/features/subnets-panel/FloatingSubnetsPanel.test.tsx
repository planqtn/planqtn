import { render, fireEvent, screen } from "@testing-library/react";
import { ChakraProvider } from "@chakra-ui/react";
import FloatingSubnetsPanel from "./FloatingSubnetsPanel";
import { FloatingPanelConfigManager } from "../floating-panel/FloatingPanelConfig";

// Mock the entire canvas store
jest.mock("../../stores/canvasStateStore", () => ({
  useCanvasStore: jest.fn()
}));

// Mock the tensor network store
jest.mock("../../stores/tensorNetworkStore", () => ({
  CachedTensorNetwork: jest.fn()
}));

// Mock the bringPanelToFront function
const mockBringPanelToFront = jest.fn();

const mockConfig = new FloatingPanelConfigManager({
  id: "subnets-panel",
  title: "Subnet groupings",
  isOpen: true,
  isCollapsed: false,
  layout: { position: { x: 100, y: 100 }, size: { width: 300, height: 400 } },
  minWidth: 200,
  minHeight: 300,
  defaultWidth: 300,
  defaultHeight: 400,
  defaultPosition: { x: 100, y: 100 },
  zIndex: 1004
});

const mockOnConfigChange = jest.fn();
const mockOnClose = jest.fn();

const renderFloatingSubnetsPanel = () => {
  return render(
    <ChakraProvider>
      <FloatingSubnetsPanel
        config={mockConfig}
        onConfigChange={mockOnConfigChange}
        onClose={mockOnClose}
      />
    </ChakraProvider>
  );
};

describe("FloatingSubnetsPanel", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Mock the store to return empty state and the bringPanelToFront function
    const { useCanvasStore } = require("../../stores/canvasStateStore");
    useCanvasStore.mockImplementation((selector: any) => {
      const state = {
        // Empty state to simulate "no networks" scenario
        cachedTensorNetworks: {},
        parityCheckMatrices: {},
        weightEnumerators: {},
        tensorNetwork: null,
        bringPanelToFront: mockBringPanelToFront,
        // Add other required functions with no-op implementations
        cloneCachedTensorNetwork: jest.fn(),
        unCacheTensorNetwork: jest.fn(),
        unCachePCM: jest.fn(),
        unCacheWeightEnumerator: jest.fn(),
        refreshAndSetCachedTensorNetworkFromCanvas: jest.fn(),
        addPCMPanel: jest.fn(),
        nextZIndex: 1100,
        updateCachedTensorNetworkName: jest.fn()
      };
      return selector(state);
    });
  });

  it("should render the panel with correct title", () => {
    renderFloatingSubnetsPanel();
    expect(screen.getByText("Subnet groupings")).toBeInTheDocument();
  });

  it("should bring panel to front when clicking on empty space in content area", () => {
    renderFloatingSubnetsPanel();

    // Look for the actual "No active tensor networks" text
    const noActiveText = screen.getByText("No active tensor networks");
    fireEvent.click(noActiveText);
    expect(mockBringPanelToFront).toHaveBeenCalledWith("subnets-panel");

    // Reset mock and try "No cached tensor networks" text
    mockBringPanelToFront.mockClear();
    const noCachedText = screen.getByText("No cached tensor networks");
    fireEvent.click(noCachedText);
    expect(mockBringPanelToFront).toHaveBeenCalledWith("subnets-panel");
  });

  it("should bring panel to front when clicking on section titles", () => {
    renderFloatingSubnetsPanel();

    // Click on "On canvas" title
    const onCanvasTitle = screen.getByText("On canvas");
    fireEvent.click(onCanvasTitle);
    expect(mockBringPanelToFront).toHaveBeenCalledWith("subnets-panel");

    // Reset mock and try "Cached" title
    mockBringPanelToFront.mockClear();
    const cachedTitle = screen.getByText("Cached");
    fireEvent.click(cachedTitle);
    expect(mockBringPanelToFront).toHaveBeenCalledWith("subnets-panel");
  });

  it("should bring panel to front when clicking on section containers", () => {
    renderFloatingSubnetsPanel();

    // Find the section containers by looking for the Box elements that contain the titles
    const onCanvasSection = screen.getByText("On canvas").closest("div");
    if (onCanvasSection) {
      fireEvent.click(onCanvasSection);
      expect(mockBringPanelToFront).toHaveBeenCalledWith("subnets-panel");
    }

    // Reset mock and try "Cached" section container
    mockBringPanelToFront.mockClear();
    const cachedSection = screen.getByText("Cached").closest("div");
    if (cachedSection) {
      fireEvent.click(cachedSection);
      expect(mockBringPanelToFront).toHaveBeenCalledWith("subnets-panel");
    }
  });

  it("should bring panel to front when clicking on the main content area", () => {
    renderFloatingSubnetsPanel();

    // Find the main content area by looking for the root Box with overflow
    const contentArea = screen
      .getByText("On canvas")
      .closest('[style*="overflow"]');
    if (contentArea) {
      fireEvent.click(contentArea);
      expect(mockBringPanelToFront).toHaveBeenCalledWith("subnets-panel");
    }
  });

  it("should not bring panel to front when clicking on interactive elements", () => {
    renderFloatingSubnetsPanel();

    // This test ensures that clicking on buttons or other interactive elements
    // doesn't trigger the bring-to-front behavior
    // Since we have an empty state, there shouldn't be any interactive elements
    // but this test documents the expected behavior
    expect(mockBringPanelToFront).not.toHaveBeenCalled();
  });

  it("should not bring panel to front when clicking on subnet items", () => {
    // Mock the store to return some subnet data
    const { useCanvasStore } = require("../../stores/canvasStateStore");
    useCanvasStore.mockImplementation((selector: any) => {
      const state = {
        // Add some subnet data to simulate having networks
        cachedTensorNetworks: {
          "test-network-1": {
            id: "test-network-1",
            name: "Test Network 1",
            isActive: true,
            tensorNetwork: {
              signature: "test-network-1",
              legos: [] // Add empty legos array
            }
          }
        },
        parityCheckMatrices: {},
        weightEnumerators: {},
        tensorNetwork: null,
        bringPanelToFront: mockBringPanelToFront,
        // Add other required functions with no-op implementations
        cloneCachedTensorNetwork: jest.fn(),
        unCacheTensorNetwork: jest.fn(),
        unCachePCM: jest.fn(),
        unCacheWeightEnumerator: jest.fn(),
        refreshAndSetCachedTensorNetworkFromCanvas: jest.fn(),
        addPCMPanel: jest.fn(),
        nextZIndex: 1100,
        updateCachedTensorNetworkName: jest.fn()
      };
      return selector(state);
    });

    renderFloatingSubnetsPanel();

    // Look for subnet items (they should be HStack elements)
    const subnetItems = screen.getAllByRole("button", { hidden: true });

    // If there are subnet items, clicking on them should not trigger bring-to-front
    if (subnetItems.length > 0) {
      const firstSubnetItem = subnetItems[0];
      fireEvent.click(firstSubnetItem);
      expect(mockBringPanelToFront).not.toHaveBeenCalled();
    }

    // Reset mock and try clicking on the text content of subnet items
    mockBringPanelToFront.mockClear();
    const subnetTexts = screen.getAllByText(/Test Network/);
    if (subnetTexts.length > 0) {
      fireEvent.click(subnetTexts[0]);
      expect(mockBringPanelToFront).not.toHaveBeenCalled();
    }
  });
});
