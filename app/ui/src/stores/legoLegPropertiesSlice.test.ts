import { useCanvasStore } from "./canvasStateStore";
import { DroppedLego } from "./droppedLegoStore";
import { Connection } from "./connectionStore";
import { LogicalPoint } from "../types/coordinates";
import { LegStyle } from "../features/lego/LegoStyles";

describe("legoLegPropertiesSlice - shouldHideLeg method", () => {
  beforeEach(() => {
    // Reset the store to a clean state
    useCanvasStore.setState({
      droppedLegos: [],
      connections: [],
      hideConnectedLegs: true,
      hideDanglingLegs: true,
      legHideStates: {},
      legConnectionStates: {},
      connectionHighlightStates: {},
      legoConnectionMap: {}
    });
  });

  // Helper function to create a test lego
  const createTestLego = (
    instanceId: string,
    numLegs: number = 4,
    legStyles?: Array<{ is_highlighted: boolean; color?: string }>
  ): DroppedLego => {
    // Create a parity check matrix with the correct number of legs
    // Each leg requires 2 columns (X and Z parts), so for numLegs we need 2*numLegs columns
    const parity_check_matrix = Array(numLegs)
      .fill(0)
      .map((_, i) => {
        const row = Array(2 * numLegs).fill(0);
        row[i] = 1; // Set the X part for this leg
        row[i + numLegs] = 1; // Set the Z part for this leg
        return row;
      });

    const lego = new DroppedLego(
      {
        type_id: "1",
        name: "Test Lego",
        short_name: "TL",
        description: "Test Lego",
        parity_check_matrix,
        logical_legs: Array.from({ length: numLegs }, (_, i) => i),
        gauge_legs: []
      },
      new LogicalPoint(0, 0),
      instanceId
    );

    // Override the style if provided by directly setting the legStyles property
    if (legStyles && lego.style) {
      // Create proper LegStyle objects
      const properLegStyles: LegStyle[] = legStyles.map((style, index) => ({
        angle: index * 90,
        length: 40,
        width: "2",
        lineStyle: "solid" as const,
        color: style.color || "black",
        is_highlighted: style.is_highlighted,
        type: "logical" as const,
        position: {
          startX: 0,
          startY: 0,
          endX: 0,
          endY: -40,
          labelX: 0,
          labelY: -15,
          angle: index * 90
        },
        bodyOrder: "front" as const
      }));

      // Directly assign to the legStyles property
      (lego.style as any).legStyles = properLegStyles; // eslint-disable-line @typescript-eslint/no-explicit-any
    }

    return lego;
  };

  // Helper function to create a test connection
  const createTestConnection = (
    fromLegoId: string,
    fromLegIndex: number,
    toLegoId: string,
    toLegIndex: number
  ): Connection =>
    new Connection(
      { legoId: fromLegoId, leg_index: fromLegIndex },
      { legoId: toLegoId, leg_index: toLegIndex }
    );

  // Helper function to test shouldHideLeg through updateAllLegHideStates
  const testShouldHideLeg = (
    lego: DroppedLego,
    connections: Connection[],
    hideDanglingLegs: boolean,
    hideConnectedLegs: boolean,
    legIndex: number = 0
  ): boolean => {
    // Update store state
    useCanvasStore.setState({
      droppedLegos: [lego],
      connections,
      hideConnectedLegs,
      hideDanglingLegs
    });

    // Call updateAllLegHideStates which internally uses shouldHideLeg
    useCanvasStore.getState().updateAllLegHideStates();

    // Get the result for the specific leg
    const hideStates = useCanvasStore
      .getState()
      .getLegHideStates(lego.instance_id);
    return hideStates[legIndex];
  };

  describe("Dangling legs (not connected)", () => {
    it("should return true when hideDanglingLegs is true and leg is not connected", () => {
      const lego = createTestLego("lego1");
      const connections: Connection[] = [];

      const result = testShouldHideLeg(lego, connections, true, true);
      expect(result).toBe(true);
    });

    it("should return false when hideDanglingLegs is false and leg is not connected", () => {
      const lego = createTestLego("lego1");
      const connections: Connection[] = [];

      const result = testShouldHideLeg(lego, connections, false, true);
      expect(result).toBe(false);
    });
  });

  describe("Connected legs - hideConnectedLegs flag", () => {
    it("should return false when hideConnectedLegs is false and leg is connected", () => {
      const lego = createTestLego("lego1");
      const connections = [createTestConnection("lego1", 0, "lego2", 0)];

      const result = testShouldHideLeg(lego, connections, true, false);
      expect(result).toBe(false);
    });

    it("should return true when hideConnectedLegs is true and leg is connected (no highlights)", () => {
      const lego = createTestLego("lego1");
      const connections = [createTestConnection("lego1", 0, "lego2", 0)];

      const result = testShouldHideLeg(lego, connections, true, true);
      expect(result).toBe(true);
    });
  });

  describe("Connected legs with highlights - non-highlighted leg", () => {
    it("should return false when non-highlighted leg is connected to highlighted leg", () => {
      const lego1 = createTestLego("lego1", 4, [
        { is_highlighted: false }, // leg 0 - not highlighted
        { is_highlighted: false },
        { is_highlighted: false },
        { is_highlighted: false }
      ]);
      const lego2 = createTestLego("lego2", 4, [
        { is_highlighted: true, color: "red" }, // leg 0 - highlighted
        { is_highlighted: false },
        { is_highlighted: false },
        { is_highlighted: false }
      ]);
      const connections = [createTestConnection("lego1", 0, "lego2", 0)];

      // Update store state
      useCanvasStore.setState({
        droppedLegos: [lego1, lego2],
        connections,
        hideConnectedLegs: true,
        hideDanglingLegs: true
      });

      useCanvasStore.getState().updateAllLegHideStates();

      const result = useCanvasStore
        .getState()
        .getLegHideStates(lego1.instance_id)[0];
      expect(result).toBe(false);
    });

    it("should return true when non-highlighted leg is connected to non-highlighted leg", () => {
      const lego1 = createTestLego("lego1", 4, [
        { is_highlighted: false }, // leg 0 - not highlighted
        { is_highlighted: false },
        { is_highlighted: false },
        { is_highlighted: false }
      ]);
      const lego2 = createTestLego("lego2", 4, [
        { is_highlighted: false }, // leg 0 - not highlighted
        { is_highlighted: false },
        { is_highlighted: false },
        { is_highlighted: false }
      ]);
      const connections = [createTestConnection("lego1", 0, "lego2", 0)];

      useCanvasStore.setState({
        droppedLegos: [lego1, lego2],
        connections,
        hideConnectedLegs: true,
        hideDanglingLegs: true
      });

      useCanvasStore.getState().updateAllLegHideStates();

      const result = useCanvasStore
        .getState()
        .getLegHideStates(lego1.instance_id)[0];
      expect(result).toBe(true);
    });
  });

  describe("Connected legs with highlights - highlighted leg", () => {
    it("should return true when highlighted leg is connected to leg with same highlight color", () => {
      const lego1 = createTestLego("lego1", 4, [
        { is_highlighted: true, color: "red" }, // leg 0 - highlighted red
        { is_highlighted: false },
        { is_highlighted: false },
        { is_highlighted: false }
      ]);
      const lego2 = createTestLego("lego2", 4, [
        { is_highlighted: true, color: "red" }, // leg 0 - highlighted red (same color)
        { is_highlighted: true, color: "blue" }, // leg 1 - highlighted blue (different color)
        { is_highlighted: false }, // leg 2 - not highlighted
        { is_highlighted: false }
      ]);
      const connections = [createTestConnection("lego1", 0, "lego2", 0)]; // leg 0 is also red

      useCanvasStore.setState({
        droppedLegos: [lego1, lego2],
        connections,
        hideConnectedLegs: true,
        hideDanglingLegs: true
      });

      useCanvasStore.getState().updateAllLegHideStates();

      const result = useCanvasStore
        .getState()
        .getLegHideStates(lego1.instance_id)[0];
      expect(result).toBe(true);
    });

    it("should return false when highlighted leg is connected to leg with different highlight color", () => {
      const lego1 = createTestLego("lego1", 4, [
        { is_highlighted: true, color: "red" }, // leg 0 - highlighted red
        { is_highlighted: false },
        { is_highlighted: false },
        { is_highlighted: false }
      ]);
      const lego2 = createTestLego("lego2", 4, [
        { is_highlighted: true, color: "red" }, // leg 0 - highlighted red (same color)
        { is_highlighted: true, color: "blue" }, // leg 1 - highlighted blue (different color)
        { is_highlighted: false }, // leg 2 - not highlighted
        { is_highlighted: false }
      ]);
      const connections = [createTestConnection("lego1", 0, "lego2", 1)]; // leg 1 is blue

      useCanvasStore.setState({
        droppedLegos: [lego1, lego2],
        connections,
        hideConnectedLegs: true,
        hideDanglingLegs: true
      });

      useCanvasStore.getState().updateAllLegHideStates();

      const result = useCanvasStore
        .getState()
        .getLegHideStates(lego1.instance_id)[0];
      expect(result).toBe(false);
    });

    it("should return false when highlighted leg is connected to non-highlighted leg", () => {
      const lego1 = createTestLego("lego1", 4, [
        { is_highlighted: true, color: "red" }, // leg 0 - highlighted red
        { is_highlighted: false },
        { is_highlighted: false },
        { is_highlighted: false }
      ]);
      const lego2 = createTestLego("lego2", 4, [
        { is_highlighted: true, color: "red" }, // leg 0 - highlighted red (same color)
        { is_highlighted: true, color: "blue" }, // leg 1 - highlighted blue (different color)
        { is_highlighted: false }, // leg 2 - not highlighted
        { is_highlighted: false }
      ]);
      const connections = [createTestConnection("lego1", 0, "lego2", 2)]; // leg 2 is not highlighted

      useCanvasStore.setState({
        droppedLegos: [lego1, lego2],
        connections,
        hideConnectedLegs: true,
        hideDanglingLegs: true
      });

      useCanvasStore.getState().updateAllLegHideStates();

      const result = useCanvasStore
        .getState()
        .getLegHideStates(lego1.instance_id)[0];
      expect(result).toBe(false);
    });
  });

  describe("Edge cases", () => {
    it("should handle multiple connections to the same leg", () => {
      const lego = createTestLego("lego1");
      const connections = [
        createTestConnection("lego1", 0, "lego2", 0),
        createTestConnection("lego1", 0, "lego3", 0)
      ];

      const result = testShouldHideLeg(lego, connections, true, true);
      expect(result).toBe(true);
    });

    it("should handle connections in both directions (from and to)", () => {
      const lego = createTestLego("lego1");
      const connections = [
        createTestConnection("lego2", 0, "lego1", 0) // lego1 is the "to" leg
      ];

      const result = testShouldHideLeg(lego, connections, true, true);
      expect(result).toBe(true);
    });

    it("should handle lego with alwaysShowLegs=true (though this should be handled at a higher level)", () => {
      const lego = createTestLego("lego1");
      lego.alwaysShowLegs = true;
      const connections = [createTestConnection("lego1", 0, "lego2", 0)];

      const result = testShouldHideLeg(lego, connections, true, true);
      expect(result).toBe(false); // When alwaysShowLegs is true, legs are never hidden
    });
  });

  describe("Bug detection - hideConnectedLegs=false", () => {
    it("should return false when hideConnectedLegs is false, regardless of highlight state", () => {
      const lego = createTestLego("lego1", 4, [
        { is_highlighted: true, color: "red" }, // highlighted leg
        { is_highlighted: false }, // non-highlighted leg
        { is_highlighted: false }, // additional leg
        { is_highlighted: false } // additional leg
      ]);
      const connections = [createTestConnection("lego1", 0, "lego2", 0)];

      // Test with highlighted leg
      const resultHighlighted = testShouldHideLeg(
        lego,
        connections,
        true,
        false,
        0
      );
      expect(resultHighlighted).toBe(false);

      // Test with non-highlighted leg (leg index 1) - this leg is not connected, so it should follow hideDanglingLegs
      const resultNonHighlighted = testShouldHideLeg(
        lego,
        connections,
        true,
        false,
        1
      );
      expect(resultNonHighlighted).toBe(true); // Not connected, so follows hideDanglingLegs=true
    });

    it("should return false when hideConnectedLegs is false, regardless of connection details", () => {
      const lego = createTestLego("lego1");
      const connections = [createTestConnection("lego1", 0, "lego2", 0)];

      const result = testShouldHideLeg(lego, connections, true, false);
      expect(result).toBe(false);
    });
  });
});
