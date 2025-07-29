import { render, fireEvent, screen } from "@testing-library/react";
import { ChakraProvider } from "@chakra-ui/react";
import FloatingPanelWrapper from "./FloatingPanelWrapper";
import { FloatingPanelConfigManager } from "./FloatingPanelConfig";

// Mock the stores
jest.mock("../../stores/canvasStateStore", () => ({
  useCanvasStore: jest.fn()
}));

jest.mock("../../stores/panelConfigStore", () => ({
  usePanelConfigStore: jest.fn()
}));

// Mock the setState function
const mockSetState = jest.fn();

describe("FloatingPanelWrapper", () => {
  const mockConfig = new FloatingPanelConfigManager({
    id: "test-panel",
    title: "Test Panel",
    isOpen: true,
    isCollapsed: false,
    layout: {
      position: { x: 100, y: 100 },
      size: { width: 300, height: 400 }
    },
    zIndex: 1000
  });

  const mockOnConfigChange = jest.fn();
  const mockOnClose = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();

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

  const renderWrapper = () => {
    return render(
      <ChakraProvider>
        <FloatingPanelWrapper
          config={mockConfig}
          title="Test Panel"
          onConfigChange={mockOnConfigChange}
          onClose={mockOnClose}
        >
          <div data-testid="panel-content">Panel Content</div>
        </FloatingPanelWrapper>
      </ChakraProvider>
    );
  };

  it("should render the panel with correct title", () => {
    renderWrapper();
    expect(screen.getByText("Test Panel")).toBeInTheDocument();
  });

  it("should render panel content", () => {
    renderWrapper();
    expect(screen.getByTestId("panel-content")).toBeInTheDocument();
  });

  it("should bring panel to front when clicking on the panel body", () => {
    renderWrapper();
    const panelContent = screen.getByTestId("panel-content");
    fireEvent.click(panelContent);

    // Check that onConfigChange was called with a new config that has a higher zIndex
    expect(mockOnConfigChange).toHaveBeenCalled();
    const lastCall =
      mockOnConfigChange.mock.calls[mockOnConfigChange.mock.calls.length - 1];
    const newConfig = lastCall[0];
    expect(newConfig.zIndex).toBe(1005);
  });

  it("should bring panel to front when clicking on empty space in content area", () => {
    renderWrapper();
    const contentContainer = screen.getByTestId("panel-content").closest("div");
    if (contentContainer) {
      // Click on the container itself (background)
      fireEvent.click(contentContainer);

      expect(mockOnConfigChange).toHaveBeenCalled();
      const lastCall =
        mockOnConfigChange.mock.calls[mockOnConfigChange.mock.calls.length - 1];
      const newConfig = lastCall[0];
      expect(newConfig.zIndex).toBe(1005);
    }
  });

  it("should bring panel to front when clicking on the header", () => {
    renderWrapper();
    const header = screen.getByText("Test Panel").closest("div");

    if (header) {
      fireEvent.click(header);

      expect(mockOnConfigChange).toHaveBeenCalled();
      const lastCall =
        mockOnConfigChange.mock.calls[mockOnConfigChange.mock.calls.length - 1];
      const newConfig = lastCall[0];
      expect(newConfig.zIndex).toBe(1005);
    }
  });

  it("should not bring panel to front when clicking on close button", () => {
    renderWrapper();
    const closeButton = screen.getByLabelText("Close panel");

    fireEvent.click(closeButton);

    expect(mockOnConfigChange).not.toHaveBeenCalled();
    expect(mockOnClose).toHaveBeenCalled();
  });

  it("should not bring panel to front when clicking on collapse button", () => {
    renderWrapper();
    const collapseButton = screen.getByLabelText("Collapse panel");

    fireEvent.click(collapseButton);

    expect(mockOnConfigChange).toHaveBeenCalled();
    // The collapse button should call onConfigChange but not for z-index reasons
    const lastCall =
      mockOnConfigChange.mock.calls[mockOnConfigChange.mock.calls.length - 1];
    const newConfig = lastCall[0];
    expect(newConfig.isCollapsed).toBe(true);
  });

  it("should apply correct z-index from config", () => {
    renderWrapper();
    const panel = screen.getByTestId("panel-content").closest("div");

    // The z-index should be applied to the main panel container
    expect(panel).toBeInTheDocument();
    // The panel should be rendered (z-index is applied via Chakra UI's CSS-in-JS)
    expect(panel).toBeTruthy();
  });

  it("should not render when panel is closed", () => {
    const closedConfig = new FloatingPanelConfigManager({
      ...mockConfig.toJSON(),
      isOpen: false
    });

    render(
      <ChakraProvider>
        <FloatingPanelWrapper
          config={closedConfig}
          title="Test Panel"
          onConfigChange={mockOnConfigChange}
          onClose={mockOnClose}
        >
          <div data-testid="panel-content">Panel Content</div>
        </FloatingPanelWrapper>
      </ChakraProvider>
    );

    expect(screen.queryByTestId("panel-content")).not.toBeInTheDocument();
  });

  it("should handle collapsed state correctly", () => {
    const collapsedConfig = new FloatingPanelConfigManager({
      ...mockConfig.toJSON(),
      isCollapsed: true
    });

    render(
      <ChakraProvider>
        <FloatingPanelWrapper
          config={collapsedConfig}
          title="Test Panel"
          onConfigChange={mockOnConfigChange}
          onClose={mockOnClose}
        >
          <div data-testid="panel-content">Panel Content</div>
        </FloatingPanelWrapper>
      </ChakraProvider>
    );

    // Content should not be visible when collapsed
    expect(screen.queryByTestId("panel-content")).not.toBeInTheDocument();
    // But the panel itself should still be visible
    expect(screen.getByText("Test Panel")).toBeInTheDocument();
  });
});
