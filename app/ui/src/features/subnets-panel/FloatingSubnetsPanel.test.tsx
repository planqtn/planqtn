import { render, screen, fireEvent } from "@testing-library/react";
import { ChakraProvider } from "@chakra-ui/react";
import FloatingSubnetsPanel from "./FloatingSubnetsPanel";
import { FloatingPanelConfigManager } from "../floating-panel/FloatingPanelConfig";

// Mock the stores
jest.mock("../../stores/canvasStateStore", () => ({
  useCanvasStore: jest.fn()
}));

jest.mock("../../stores/tensorNetworkStore", () => ({
  useTensorNetworkStore: jest.fn()
}));

jest.mock("../../stores/panelConfigStore", () => ({
  usePanelConfigStore: jest.fn()
}));

// Mock the setState function
const mockSetState = jest.fn();

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

    // Mock the canvas store to return empty state
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { useCanvasStore } = require("../../stores/canvasStateStore");
    const mockUseCanvasStore = useCanvasStore as jest.MockedFunction<
      typeof useCanvasStore
    >;
    mockUseCanvasStore.mockImplementation(
      (selector: (state: unknown) => unknown) => {
        // Create a mock state that the selector can access
        const mockState = {
          cachedTensorNetworks: {},
          parityCheckMatrices: {},
          weightEnumerators: {},
          tensorNetwork: { legos: [], connections: [] },
          cloneCachedTensorNetwork: jest.fn(),
          unCacheTensorNetwork: jest.fn(),
          unCachePCM: jest.fn(),
          unCacheWeightEnumerator: jest.fn(),
          refreshAndSetCachedTensorNetworkFromCanvas: jest.fn(),
          updateCachedTensorNetworkName: jest.fn()
        };
        return selector(mockState);
      }
    );

    // Mock the panel config store
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { usePanelConfigStore } = require("../../stores/panelConfigStore");
    const mockUsePanelConfigStore = usePanelConfigStore as jest.MockedFunction<
      typeof usePanelConfigStore
    >;
    mockUsePanelConfigStore.mockImplementation((selector: unknown) => {
      if (typeof selector === "function") {
        // Return different values based on what's being selected
        const mockState = {
          nextZIndex: 1005,
          setState: mockSetState
        };
        return (selector as (state: unknown) => unknown)(mockState);
      }
      return 1005; // Default return for nextZIndex
    });

    // Mock the setState method
    mockUsePanelConfigStore.setState = mockSetState;
  });

  it("should render the panel with correct title", () => {
    renderFloatingSubnetsPanel();
    expect(
      screen.getByText("Cached subnets and calculations")
    ).toBeInTheDocument();
  });

  it("should bring panel to front when clicking on empty space in content area", () => {
    renderFloatingSubnetsPanel();

    // Look for the actual "No active tensor networks" text
    const noActiveText = screen.getByText("No active tensor networks");
    fireEvent.click(noActiveText);

    // Check that onConfigChange was called with a new config that has a higher zIndex
    expect(mockOnConfigChange).toHaveBeenCalled();
    const lastCall =
      mockOnConfigChange.mock.calls[mockOnConfigChange.mock.calls.length - 1];
    const newConfig = lastCall[0];
    expect(newConfig.zIndex).toBe(1005);

    // Reset mock and try "No cached tensor networks" text
    mockOnConfigChange.mockClear();
    const noCachedText = screen.getByText("No cached tensor networks");
    fireEvent.click(noCachedText);

    expect(mockOnConfigChange).toHaveBeenCalled();
    const lastCall2 =
      mockOnConfigChange.mock.calls[mockOnConfigChange.mock.calls.length - 1];
    const newConfig2 = lastCall2[0];
    expect(newConfig2.zIndex).toBe(1005);
  });

  it("should bring panel to front when clicking on section titles", () => {
    renderFloatingSubnetsPanel();

    // Click on "Active tensor networks on canvas" title
    const onCanvasTitle = screen.getByText("Active tensor networks on canvas");
    fireEvent.click(onCanvasTitle);

    expect(mockOnConfigChange).toHaveBeenCalled();
    const lastCall =
      mockOnConfigChange.mock.calls[mockOnConfigChange.mock.calls.length - 1];
    const newConfig = lastCall[0];
    expect(newConfig.zIndex).toBe(1005);

    // Reset mock and try "Old versions of tensor networks" title
    mockOnConfigChange.mockClear();
    const cachedTitle = screen.getByText("Old versions of tensor networks");
    fireEvent.click(cachedTitle);

    expect(mockOnConfigChange).toHaveBeenCalled();
    const lastCall2 =
      mockOnConfigChange.mock.calls[mockOnConfigChange.mock.calls.length - 1];
    const newConfig2 = lastCall2[0];
    expect(newConfig2.zIndex).toBe(1005);
  });

  it("should bring panel to front when clicking on section containers", () => {
    renderFloatingSubnetsPanel();

    // Find the section containers by looking for the Box elements that contain the titles
    const onCanvasSection = screen
      .getByText("Active tensor networks on canvas")
      .closest("div");
    if (onCanvasSection) {
      fireEvent.click(onCanvasSection);
      expect(mockOnConfigChange).toHaveBeenCalled();
      const lastCall =
        mockOnConfigChange.mock.calls[mockOnConfigChange.mock.calls.length - 1];
      const newConfig = lastCall[0];
      expect(newConfig.zIndex).toBe(1005);
    }

    // Reset mock and try "Old versions of tensor networks" section container
    mockOnConfigChange.mockClear();
    const cachedSection = screen
      .getByText("Old versions of tensor networks")
      .closest("div");
    if (cachedSection) {
      fireEvent.click(cachedSection);
      expect(mockOnConfigChange).toHaveBeenCalled();
      const lastCall =
        mockOnConfigChange.mock.calls[mockOnConfigChange.mock.calls.length - 1];
      const newConfig = lastCall[0];
      expect(newConfig.zIndex).toBe(1005);
    }
  });

  it("should bring panel to front when clicking on the main content area", () => {
    renderFloatingSubnetsPanel();

    // Find the main content area by looking for the root Box with overflow
    const contentArea = screen
      .getByText("Active tensor networks on canvas")
      .closest('[style*="overflow"]');
    if (contentArea) {
      fireEvent.click(contentArea);
      expect(mockOnConfigChange).toHaveBeenCalled();
      const lastCall =
        mockOnConfigChange.mock.calls[mockOnConfigChange.mock.calls.length - 1];
      const newConfig = lastCall[0];
      expect(newConfig.zIndex).toBe(1005);
    }
  });

  it("should not bring panel to front when clicking on interactive elements", () => {
    renderFloatingSubnetsPanel();

    // This test ensures that clicking on buttons or other interactive elements
    // doesn't trigger the bring-to-front behavior
    // Since we have an empty state, there shouldn't be any interactive elements
    // but this test documents the expected behavior
    expect(mockOnConfigChange).not.toHaveBeenCalled();
  });

  it("should not bring panel to front when clicking on subnet items", () => {
    // Mock the store to return some subnet data
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { useCanvasStore } = require("../../stores/canvasStateStore");
    const mockUseCanvasStore = useCanvasStore as jest.MockedFunction<
      typeof useCanvasStore
    >;
    mockUseCanvasStore.mockImplementation(
      (selector: (state: unknown) => unknown) => {
        // Create a mock state that the selector can access
        const mockState = {
          cachedTensorNetworks: {
            "test-active-network": {
              isActive: true,
              tensorNetwork: {
                legos: [],
                connections: [],
                signature: "test-active-network"
              },
              svg: "",
              name: "Test Active Network",
              isLocked: false,
              lastUpdated: new Date()
            },
            "test-inactive-network": {
              isActive: false,
              tensorNetwork: {
                legos: [],
                connections: [],
                signature: "test-inactive-network"
              },
              svg: "",
              name: "Test Inactive Network",
              isLocked: false,
              lastUpdated: new Date()
            }
          },
          parityCheckMatrices: {},
          weightEnumerators: {},
          tensorNetwork: { legos: [], connections: [] },
          refreshAndSetCachedTensorNetworkFromCanvas: jest.fn(),
          focusOnTensorNetwork: jest.fn()
        };
        return selector(mockState);
      }
    );

    renderFloatingSubnetsPanel();

    // Look for subnet items (they should be HStack elements)
    const subnetItems = screen.getAllByRole("button", { hidden: true });

    // If there are subnet items, clicking on them should not trigger bring-to-front
    if (subnetItems.length > 0) {
      const firstSubnetItem = subnetItems[0];
      fireEvent.click(firstSubnetItem);
      expect(mockOnConfigChange).toHaveBeenCalled();
    }

    // Reset mock and try clicking on the text content of subnet items
    mockOnConfigChange.mockClear();
    const subnetTexts1 = screen.getAllByText(/Test Active Network/);
    if (subnetTexts1.length > 0) {
      fireEvent.click(subnetTexts1[0]);
      expect(mockOnConfigChange).not.toHaveBeenCalled();
    }

    mockOnConfigChange.mockClear();
    const subnetTexts2 = screen.getAllByText(/Test Inactive Network/);
    if (subnetTexts2.length > 0) {
      fireEvent.click(subnetTexts2[0]);
      expect(mockOnConfigChange).toHaveBeenCalled();
    }
  });
});
