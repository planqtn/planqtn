import { useCanvasStore } from "./canvasStateStore";
import { WeightEnumerator, CachedTensorNetwork } from "./tensorNetworkStore";
import { TensorNetworkLeg, TensorNetwork } from "../lib/TensorNetwork";
import { Connection } from "./connectionStore";
import { DroppedLego } from "./droppedLegoStore";
import { LogicalPoint } from "../types/coordinates";

// Helper function to create a test store instance
const createTestStore = () => {
  // Reset the store to a clean state using Zustand's setState
  useCanvasStore.setState({ weightEnumerators: {} });
  return useCanvasStore.getState();
};

describe("Weight Enumerator Store Behavior", () => {
  let store: ReturnType<typeof useCanvasStore.getState>;

  beforeEach(() => {
    store = createTestStore();
  });

  it("should set a weight enumerator", () => {
    const enumerator = new WeightEnumerator({
      taskId: "test",
      polynomial: "test",
      normalizerPolynomial: "test",
      truncateLength: 10,
      openLegs: []
    });

    store.setWeightEnumerator("test", "test", enumerator);

    const enumerators = store.listWeightEnumerators("test");
    expect(enumerators).toHaveLength(1);
    expect(enumerators[0].taskId).toBe("test");
  });

  it("should append new weight enumerators to existing list for tensor network signature", () => {
    const networkSignature = "test-network-signature";

    // Create first weight enumerator
    const firstEnumerator = new WeightEnumerator({
      taskId: "task-1",
      polynomial: "x + y",
      normalizerPolynomial: "1",
      truncateLength: 5,
      openLegs: []
    });

    // Create second weight enumerator with different taskId
    const secondEnumerator = new WeightEnumerator({
      taskId: "task-2",
      polynomial: "x^2 + y^2",
      normalizerPolynomial: "2",
      truncateLength: 10,
      openLegs: []
    });

    // Create third weight enumerator with different taskId
    const thirdEnumerator = new WeightEnumerator({
      taskId: "task-3",
      polynomial: "x^3 + y^3",
      normalizerPolynomial: "2",
      truncateLength: 11,
      openLegs: []
    });

    // Add first enumerator
    store.setWeightEnumerator(networkSignature, "task-1", firstEnumerator);

    // Verify first enumerator is in the list
    let enumerators = store.listWeightEnumerators(networkSignature);
    expect(enumerators).toHaveLength(1);
    expect(enumerators[0].taskId).toBe("task-1");
    expect(enumerators[0].polynomial).toBe("x + y");

    // Add second enumerator
    store.setWeightEnumerator(networkSignature, "task-2", secondEnumerator);

    // Verify both enumerators are in the list
    enumerators = store.listWeightEnumerators(networkSignature);
    expect(enumerators).toHaveLength(2);

    // Add third enumerator
    store.setWeightEnumerator(networkSignature, "task-3", thirdEnumerator);

    // Verify third enumerator is in the list
    enumerators = store.listWeightEnumerators(networkSignature);
    expect(enumerators).toHaveLength(3);

    // Verify first enumerator is still there
    expect(enumerators[0].taskId).toBe("task-1");
    expect(enumerators[0].polynomial).toBe("x + y");

    // Verify second enumerator was appended
    expect(enumerators[1].taskId).toBe("task-2");
    expect(enumerators[1].polynomial).toBe("x^2 + y^2");

    // Verify third enumerator was appended
    expect(enumerators[2].taskId).toBe("task-3");
    expect(enumerators[2].polynomial).toBe("x^3 + y^3");
  });

  it("should update existing weight enumerator when same taskId is provided", () => {
    const networkSignature = "test-network-signature";

    // Create initial enumerator
    const initialEnumerator = new WeightEnumerator({
      taskId: "task-1",
      polynomial: undefined, // No result yet
      normalizerPolynomial: undefined,
      truncateLength: 5,
      openLegs: []
    });

    // Create updated enumerator with same taskId but with results
    const updatedEnumerator = new WeightEnumerator({
      taskId: "task-1",
      polynomial: "x + y + z", // Now has result
      normalizerPolynomial: "1 + x",
      truncateLength: 5,
      openLegs: []
    });

    // Add initial enumerator
    store.setWeightEnumerator(networkSignature, "task-1", initialEnumerator);

    // Verify initial state
    let enumerators = store.listWeightEnumerators(networkSignature);
    expect(enumerators).toHaveLength(1);
    expect(enumerators[0].polynomial).toBeUndefined();

    // Update the enumerator with same taskId
    store.setWeightEnumerator(networkSignature, "task-1", updatedEnumerator);

    // Verify enumerator was updated, not appended
    enumerators = store.listWeightEnumerators(networkSignature);
    expect(enumerators).toHaveLength(1); // Still only one enumerator
    expect(enumerators[0].taskId).toBe("task-1");
    expect(enumerators[0].polynomial).toBe("x + y + z"); // Now has result
    expect(enumerators[0].normalizerPolynomial).toBe("1 + x");
  });

  it("should update existing weight enumerator with partial results using with() method", () => {
    const networkSignature = "test-network";
    const taskId = "test-task";

    // Create initial enumerator without results
    const initialEnumerator = new WeightEnumerator({
      taskId: taskId,
      polynomial: undefined,
      normalizerPolynomial: undefined,
      truncateLength: 10,
      openLegs: []
    });

    // Add to store
    store.setWeightEnumerator(networkSignature, taskId, initialEnumerator);

    // Verify initial state
    let found = store.getWeightEnumerator(networkSignature, taskId);
    expect(found?.polynomial).toBeUndefined();
    expect(found?.normalizerPolynomial).toBeUndefined();

    // Update with results using with() method
    const updatedEnumerator = initialEnumerator.with({
      polynomial: "x^2 + y^2 + z^2",
      normalizerPolynomial: "1 + x + y"
    });
    store.setWeightEnumerator(networkSignature, taskId, updatedEnumerator);

    // Verify results were updated
    found = store.getWeightEnumerator(networkSignature, taskId);
    expect(found?.polynomial).toBe("x^2 + y^2 + z^2");
    expect(found?.normalizerPolynomial).toBe("1 + x + y");

    // Verify other properties remain unchanged
    expect(found?.taskId).toBe(taskId);
    expect(found?.truncateLength).toBe(10);
    expect(found?.openLegs).toEqual([]);
  });

  it("should handle partial updates with setWeightEnumerator", () => {
    const networkSignature = "test-network";
    const taskId = "test-task";

    // Create initial enumerator with some results
    const initialEnumerator = new WeightEnumerator({
      taskId: taskId,
      polynomial: "existing-poly",
      normalizerPolynomial: undefined,
      truncateLength: 5,
      openLegs: []
    });

    // Add to store
    store.setWeightEnumerator(networkSignature, taskId, initialEnumerator);

    // Update only normalizer polynomial
    const updatedEnumerator = initialEnumerator.with({
      normalizerPolynomial: "new-norm-poly"
    });
    store.setWeightEnumerator(networkSignature, taskId, updatedEnumerator);

    // Verify only normalizer was updated
    const found = store.getWeightEnumerator(networkSignature, taskId);
    expect(found?.polynomial).toBe("existing-poly"); // Unchanged
    expect(found?.normalizerPolynomial).toBe("new-norm-poly"); // Updated
  });

  it("should handle multiple tensor network signatures independently", () => {
    const networkSignature1 = "network-1";
    const networkSignature2 = "network-2";

    // Create enumerators for different networks
    const enumerator1 = new WeightEnumerator({
      taskId: "task-1",
      polynomial: "network-1-poly",
      normalizerPolynomial: "1",
      truncateLength: 5,
      openLegs: []
    });

    const enumerator2 = new WeightEnumerator({
      taskId: "task-2",
      polynomial: "network-2-poly",
      normalizerPolynomial: "2",
      truncateLength: 10,
      openLegs: []
    });

    // Add enumerators to different networks
    store.setWeightEnumerator(networkSignature1, "task-1", enumerator1);
    store.setWeightEnumerator(networkSignature2, "task-2", enumerator2);

    // Verify each network has its own enumerators
    const enumerators1 = store.listWeightEnumerators(networkSignature1);
    const enumerators2 = store.listWeightEnumerators(networkSignature2);

    expect(enumerators1).toHaveLength(1);
    expect(enumerators1[0].taskId).toBe("task-1");
    expect(enumerators1[0].polynomial).toBe("network-1-poly");

    expect(enumerators2).toHaveLength(1);
    expect(enumerators2[0].taskId).toBe("task-2");
    expect(enumerators2[0].polynomial).toBe("network-2-poly");
  });

  it("should return empty array for non-existent network signature", () => {
    const enumerators = store.listWeightEnumerators("non-existent");
    expect(enumerators).toEqual([]);
  });

  it("should get specific weight enumerator by taskId", () => {
    const networkSignature = "test-network";
    const enumerator = new WeightEnumerator({
      taskId: "specific-task",
      polynomial: "specific-poly",
      normalizerPolynomial: "specific-norm",
      truncateLength: 5,
      openLegs: []
    });

    store.setWeightEnumerator(networkSignature, "specific-task", enumerator);

    const found = store.getWeightEnumerator(networkSignature, "specific-task");
    expect(found).not.toBeNull();
    expect(found?.taskId).toBe("specific-task");
    expect(found?.polynomial).toBe("specific-poly");
  });

  it("should return null for non-existent weight enumerator", () => {
    const found = store.getWeightEnumerator(
      "test-network",
      "non-existent-task"
    );
    expect(found).toBeNull();
  });

  it("should delete weight enumerator by taskId", () => {
    const networkSignature = "test-network";
    const enumerator = new WeightEnumerator({
      taskId: "to-delete",
      polynomial: "delete-me",
      normalizerPolynomial: "delete-me",
      truncateLength: 5,
      openLegs: []
    });

    store.setWeightEnumerator(networkSignature, "to-delete", enumerator);

    // Verify it was added
    expect(store.listWeightEnumerators(networkSignature)).toHaveLength(1);

    // Delete it
    store.deleteWeightEnumerator(networkSignature, "to-delete");

    // Verify it was deleted
    expect(store.listWeightEnumerators(networkSignature)).toHaveLength(0);
  });

  it("should handle WeightEnumerator with openLegs", () => {
    const networkSignature = "test-network";
    const openLegs: TensorNetworkLeg[] = [
      { instance_id: "lego1", leg_index: 0 },
      { instance_id: "lego2", leg_index: 1 }
    ];

    const enumerator = new WeightEnumerator({
      taskId: "with-legs",
      polynomial: "legs-poly",
      normalizerPolynomial: "legs-norm",
      truncateLength: 10,
      openLegs: openLegs
    });

    store.setWeightEnumerator(networkSignature, "with-legs", enumerator);

    const found = store.getWeightEnumerator(networkSignature, "with-legs");
    expect(found).not.toBeNull();
    expect(found?.openLegs).toEqual(openLegs);
    expect(found?.openLegs).toHaveLength(2);
  });

  it("should test WeightEnumerator.equalArgs method", () => {
    const openLegs1: TensorNetworkLeg[] = [
      { instance_id: "lego1", leg_index: 0 }
    ];
    const openLegs2: TensorNetworkLeg[] = [
      { instance_id: "lego1", leg_index: 0 }
    ];
    const openLegs3: TensorNetworkLeg[] = [
      { instance_id: "lego1", leg_index: 1 }
    ];

    const enumerator1 = new WeightEnumerator({
      truncateLength: 5,
      openLegs: openLegs1
    });

    const enumerator2 = new WeightEnumerator({
      truncateLength: 5,
      openLegs: openLegs2
    });

    const enumerator3 = new WeightEnumerator({
      truncateLength: 10,
      openLegs: openLegs1
    });

    const enumerator4 = new WeightEnumerator({
      truncateLength: 5,
      openLegs: openLegs3
    });

    // Same truncateLength and openLegs
    expect(enumerator1.equalArgs(enumerator2)).toBe(true);

    // Different truncateLength
    expect(enumerator1.equalArgs(enumerator3)).toBe(false);

    // Different openLegs
    expect(enumerator1.equalArgs(enumerator4)).toBe(false);
  });

  it("should test WeightEnumerator.with method", () => {
    const original = new WeightEnumerator({
      taskId: "original",
      polynomial: "original-poly",
      normalizerPolynomial: "original-norm",
      truncateLength: 5,
      openLegs: []
    });

    const updated = original.with({
      polynomial: "updated-poly",
      normalizerPolynomial: "updated-norm"
    });

    // Original should be unchanged
    expect(original.polynomial).toBe("original-poly");
    expect(original.normalizerPolynomial).toBe("original-norm");

    // Updated should have new values
    expect(updated.polynomial).toBe("updated-poly");
    expect(updated.normalizerPolynomial).toBe("updated-norm");

    // Other properties should remain the same
    expect(updated.taskId).toBe("original");
    expect(updated.truncateLength).toBe(5);
    expect(updated.openLegs).toEqual([]);
  });
});

describe("updateIsActiveForCachedTensorNetworks", () => {
  let store: ReturnType<typeof useCanvasStore.getState>;

  // Helper function to create a test tensor network
  const createTestTensorNetwork = (
    signature: string,
    legos: DroppedLego[],
    connections: Connection[]
  ): TensorNetwork => {
    return new TensorNetwork({
      signature,
      legos,
      connections
    });
  };

  // Helper function to create a test cached tensor network
  const createTestCachedTensorNetwork = (
    signature: string,
    legos: DroppedLego[],
    connections: Connection[],
    isActive: boolean = true
  ): CachedTensorNetwork => {
    return {
      isActive,
      tensorNetwork: createTestTensorNetwork(signature, legos, connections),
      svg: "<svg></svg>",
      name: `Test Network ${signature}`,
      isLocked: false,
      lastUpdated: new Date()
    };
  };

  // Helper function to create test legos
  const createTestLego = (
    instanceId: string,
    x: number = 0,
    y: number = 0
  ): DroppedLego => {
    const lego = new DroppedLego(
      {
        type_id: "h",
        name: "Hadamard",
        short_name: "H",
        description: "Test lego",
        parity_check_matrix: [
          [1, 0],
          [0, 1]
        ],
        logical_legs: [0, 1],
        gauge_legs: []
      },
      new LogicalPoint(x, y),
      instanceId,
      { selectedMatrixRows: [] }
    );

    // Add the style property that legoLegPropertiesSlice expects
    (lego as any).style = {
      legStyles: [
        { is_highlighted: false, is_hidden: false },
        { is_highlighted: false, is_hidden: false }
      ]
    };

    return lego;
  };

  // Helper function to create test connections
  const createTestConnection = (
    fromId: string,
    toId: string,
    fromLeg: number = 0,
    toLeg: number = 1
  ): Connection => {
    return new Connection(
      { legoId: fromId, leg_index: fromLeg },
      { legoId: toId, leg_index: toLeg }
    );
  };

  beforeEach(() => {
    // Reset the store to a clean state
    useCanvasStore.setState({
      cachedTensorNetworks: {},
      droppedLegos: [],
      connections: [],
      legHideStates: {},
      legConnectionStates: {},
      connectionHighlightStates: {},
      legoConnectionMap: {}
    });
    store = useCanvasStore.getState();
  });

  describe("when a lego is removed from canvas", () => {
    it("should set isActive to false for cached tensor networks containing that lego", () => {
      // Create test legos
      const lego1 = createTestLego("lego1");
      const lego2 = createTestLego("lego2");
      const lego3 = createTestLego("lego3");

      // Create test connections
      const conn1 = createTestConnection("lego1", "lego2");
      const conn2 = createTestConnection("lego2", "lego3");

      // Create a cached tensor network with all three legos
      const cachedNetwork = createTestCachedTensorNetwork(
        "test-network",
        [lego1, lego2, lego3],
        [conn1, conn2],
        true // Initially active
      );

      // Set up the store state
      store.cacheTensorNetwork(cachedNetwork);
      store.setDroppedLegos([lego1, lego2, lego3]);
      store.setConnections([conn1, conn2]);

      // Verify the network is initially active
      expect(store.getCachedTensorNetwork("test-network")?.isActive).toBe(true);

      // Remove lego2 from the canvas
      store.setDroppedLegos([lego1, lego3]);

      // Update active status
      store.updateIsActiveForCachedTensorNetworks(["lego2"], []);

      // Verify the network is now inactive
      expect(store.getCachedTensorNetwork("test-network")?.isActive).toBe(
        false
      );
    });

    it("should reactivate when the lego is added back", () => {
      // Create test legos
      const lego1 = createTestLego("lego1");
      const lego2 = createTestLego("lego2");
      const lego3 = createTestLego("lego3");

      // Create test connections
      const conn1 = createTestConnection("lego1", "lego2");
      const conn2 = createTestConnection("lego2", "lego3");

      // Create a cached tensor network
      const cachedNetwork = createTestCachedTensorNetwork(
        "test-network",
        [lego1, lego2, lego3],
        [conn1, conn2],
        true
      );

      // Set up the store state
      store.cacheTensorNetwork(cachedNetwork);
      store.setDroppedLegos([lego1, lego2, lego3]);
      store.setConnections([conn1, conn2]);

      // Remove lego2 and verify it becomes inactive
      store.setDroppedLegos([lego1, lego3]);
      expect(store.getCachedTensorNetwork("test-network")?.isActive).toBe(
        false
      );

      // Add lego2 back and verify it becomes active again
      store.setDroppedLegos([lego1, lego2, lego3]);
      expect(store.getCachedTensorNetwork("test-network")?.isActive).toBe(true);
    });
  });

  describe("when a connection is removed from canvas", () => {
    it("should set isActive to false for cached tensor networks containing that connection", () => {
      // Create test legos
      const lego1 = createTestLego("lego1");
      const lego2 = createTestLego("lego2");
      const lego3 = createTestLego("lego3");

      // Create test connections
      const conn1 = createTestConnection("lego1", "lego2");
      const conn2 = createTestConnection("lego2", "lego3");

      // Create a cached tensor network
      const cachedNetwork = createTestCachedTensorNetwork(
        "test-network",
        [lego1, lego2, lego3],
        [conn1, conn2],
        true
      );

      // Set up the store state
      store.cacheTensorNetwork(cachedNetwork);
      store.setDroppedLegos([lego1, lego2, lego3]);
      store.setConnections([conn1, conn2]);

      // Verify the network is initially active
      expect(store.getCachedTensorNetwork("test-network")?.isActive).toBe(true);

      // Remove conn1 from the canvas
      store.setConnections([conn2]);

      // Verify the network is now inactive
      expect(store.getCachedTensorNetwork("test-network")?.isActive).toBe(
        false
      );
    });

    it("should reactivate when the connection is added back", () => {
      // Create test legos
      const lego1 = createTestLego("lego1");
      const lego2 = createTestLego("lego2");
      const lego3 = createTestLego("lego3");

      // Create test connections
      const conn1 = createTestConnection("lego1", "lego2");
      const conn2 = createTestConnection("lego2", "lego3");

      // Create a cached tensor network
      const cachedNetwork = createTestCachedTensorNetwork(
        "test-network",
        [lego1, lego2, lego3],
        [conn1, conn2],
        true
      );

      // Set up the store state
      store.cacheTensorNetwork(cachedNetwork);
      store.setDroppedLegos([lego1, lego2, lego3]);
      store.setConnections([conn1, conn2]);

      // Remove conn1 and verify it becomes inactive
      store.setConnections([conn2]);
      expect(store.getCachedTensorNetwork("test-network")?.isActive).toBe(
        false
      );

      // Add conn1 back and verify it becomes active again
      store.setConnections([conn1, conn2]);
      store.updateIsActiveForCachedTensorNetworks([], [conn1]);
      expect(store.getCachedTensorNetwork("test-network")?.isActive).toBe(true);
    });
  });

  describe("when a new connection is added between subnet legos", () => {
    it("should set isActive to false for cached tensor networks that don't include the new connection", () => {
      // Create test legos
      const lego1 = createTestLego("lego1");
      const lego2 = createTestLego("lego2");
      const lego3 = createTestLego("lego3");

      // Create test connections
      const conn1 = createTestConnection("lego1", "lego2");
      const conn2 = createTestConnection("lego2", "lego3");
      const newConn = createTestConnection("lego1", "lego3"); // New connection

      // Create a cached tensor network with only conn1 and conn2
      const cachedNetwork = createTestCachedTensorNetwork(
        "test-network",
        [lego1, lego2, lego3],
        [conn1, conn2],
        true
      );

      // Set up the store state
      store.cacheTensorNetwork(cachedNetwork);
      store.setDroppedLegos([lego1, lego2, lego3]);
      store.setConnections([conn1, conn2]);

      // Verify the network is initially active
      expect(store.getCachedTensorNetwork("test-network")?.isActive).toBe(true);

      // Add the new connection
      store.setConnections([conn1, conn2, newConn]);

      // Verify the network is now inactive (because it has extra connections)
      expect(store.getCachedTensorNetwork("test-network")?.isActive).toBe(
        false
      );
    });

    it("should remain active if the cached network includes the new connection", () => {
      // Create test legos
      const lego1 = createTestLego("lego1");
      const lego2 = createTestLego("lego2");
      const lego3 = createTestLego("lego3");

      // Create test connections
      const conn1 = createTestConnection("lego1", "lego2");
      const conn2 = createTestConnection("lego2", "lego3");
      const conn3 = createTestConnection("lego1", "lego3");

      // Create a cached tensor network that includes all three connections
      const cachedNetwork = createTestCachedTensorNetwork(
        "test-network",
        [lego1, lego2, lego3],
        [conn1, conn2, conn3],
        true
      );

      // Set up the store state
      store.cacheTensorNetwork(cachedNetwork);
      store.setDroppedLegos([lego1, lego2, lego3]);
      store.setConnections([conn1, conn2, conn3]);

      // Verify the network is initially active
      expect(store.getCachedTensorNetwork("test-network")?.isActive).toBe(true);

      // Verify the network remains active
      expect(store.getCachedTensorNetwork("test-network")?.isActive).toBe(true);
    });
  });

  describe("when multiple changes occur simultaneously", () => {
    it("should handle lego removal and connection addition together", () => {
      // Create test legos
      const lego1 = createTestLego("lego1");
      const lego2 = createTestLego("lego2");
      const lego3 = createTestLego("lego3");
      const lego4 = createTestLego("lego4");

      // Create test connections
      const conn1 = createTestConnection("lego1", "lego2");
      const conn2 = createTestConnection("lego2", "lego3");
      const newConn = createTestConnection("lego1", "lego4");

      // Create a cached tensor network
      const cachedNetwork = createTestCachedTensorNetwork(
        "test-network",
        [lego1, lego2, lego3],
        [conn1, conn2],
        true
      );

      // Set up the store state
      store.cacheTensorNetwork(cachedNetwork);
      store.setDroppedLegos([lego1, lego2, lego3, lego4]);
      store.setConnections([conn1, conn2, newConn]);

      // Verify the network is initially active
      expect(store.getCachedTensorNetwork("test-network")?.isActive).toBe(true);

      // Remove lego3 and add newConn simultaneously
      store.setDroppedLegos([lego1, lego2, lego4]);

      // Verify the network is now inactive
      expect(store.getCachedTensorNetwork("test-network")?.isActive).toBe(
        false
      );
    });

    it("should handle undo operations correctly", () => {
      // Create test legos
      const lego1 = createTestLego("lego1");
      const lego2 = createTestLego("lego2");
      const lego3 = createTestLego("lego3");

      // Create test connections
      const conn1 = createTestConnection("lego1", "lego2");
      const conn2 = createTestConnection("lego2", "lego3");

      // Create a cached tensor network
      const cachedNetwork = createTestCachedTensorNetwork(
        "test-network",
        [lego1, lego2, lego3],
        [conn1, conn2],
        true
      );

      // Set up the store state
      store.cacheTensorNetwork(cachedNetwork);
      store.setDroppedLegos([lego1, lego2, lego3]);
      store.setConnections([conn1, conn2]);

      // Verify the network is initially active
      expect(store.getCachedTensorNetwork("test-network")?.isActive).toBe(true);

      // Simulate an operation that removes lego2 and conn2
      store.setDroppedLegos([lego1, lego3]);
      store.setConnections([conn1]);

      // Verify the network is now inactive
      expect(store.getCachedTensorNetwork("test-network")?.isActive).toBe(
        false
      );

      // Simulate undo operation - restore lego2 and conn2
      store.setDroppedLegos([lego1, lego2, lego3]);
      store.setConnections([conn1, conn2]);

      // Verify the network is active again
      expect(store.getCachedTensorNetwork("test-network")?.isActive).toBe(true);
    });
  });

  describe("edge cases", () => {
    it("should handle empty cached tensor networks", () => {
      // No cached networks
      store.updateIsActiveForCachedTensorNetworks(["lego1"], []);

      // Should not throw any errors
      expect(store.cachedTensorNetworks).toEqual({});
    });

    it("should handle cached networks with no legos", () => {
      const emptyNetwork = createTestCachedTensorNetwork(
        "empty-network",
        [],
        [],
        true
      );

      store.cacheTensorNetwork(emptyNetwork);
      store.updateIsActiveForCachedTensorNetworks([], []);

      // Should remain active since there are no legos to check
      expect(store.getCachedTensorNetwork("empty-network")?.isActive).toBe(
        true
      );
    });

    it("should handle cached networks with no connections", () => {
      const lego1 = createTestLego("lego1");
      const lego2 = createTestLego("lego2");

      const networkWithoutConnections = createTestCachedTensorNetwork(
        "no-connections-network",
        [lego1, lego2],
        [],
        true
      );

      store.cacheTensorNetwork(networkWithoutConnections);
      store.setDroppedLegos([lego1, lego2]);

      // Should remain active since there are no connections to check
      expect(
        store.getCachedTensorNetwork("no-connections-network")?.isActive
      ).toBe(true);
    });

    it("should not affect unrelated cached networks", () => {
      // Create two separate networks
      const lego1 = createTestLego("lego1");
      const lego2 = createTestLego("lego2");
      const lego3 = createTestLego("lego3");
      const lego4 = createTestLego("lego4");

      const conn1 = createTestConnection("lego1", "lego2");
      const conn2 = createTestConnection("lego3", "lego4");

      const network1 = createTestCachedTensorNetwork(
        "network1",
        [lego1, lego2],
        [conn1],
        true
      );

      const network2 = createTestCachedTensorNetwork(
        "network2",
        [lego3, lego4],
        [conn2],
        true
      );

      // Set up the store state
      store.cacheTensorNetwork(network1);
      store.cacheTensorNetwork(network2);
      store.setDroppedLegos([lego1, lego2, lego3, lego4]);
      store.setConnections([conn1, conn2]);

      // Remove lego3 (part of network2)
      store.setDroppedLegos([lego1, lego2, lego4]);

      // Network1 should remain active, network2 should be inactive
      expect(store.getCachedTensorNetwork("network1")?.isActive).toBe(true);
      expect(store.getCachedTensorNetwork("network2")?.isActive).toBe(false);
    });
  });
});
