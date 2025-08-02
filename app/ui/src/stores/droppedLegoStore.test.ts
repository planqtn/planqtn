import { DroppedLego } from "./droppedLegoStore";
import { LogicalPoint } from "../types/coordinates";
import { useCanvasStore } from "./canvasStateStore";
import { TensorNetwork } from "../lib/TensorNetwork";
import { CachedTensorNetwork } from "./tensorNetworkStore";

describe("DroppedLego state mutation interactions with cached networks", () => {
  let store: ReturnType<typeof useCanvasStore.getState>;

  const createMockLego = (
    instanceId: string,
    position: LogicalPoint
  ): DroppedLego => {
    return new DroppedLego(
      {
        type_id: "test",
        name: "Test Lego",
        short_name: "Test",
        description: "Test Description",
        parity_check_matrix: [
          [1, 0],
          [0, 1]
        ],
        logical_legs: [],
        gauge_legs: []
      },
      position,
      instanceId
    );
  };

  beforeEach(() => {
    // Reset the store state
    useCanvasStore.setState({
      droppedLegos: [],
      connections: [],
      tensorNetwork: null,
      cachedTensorNetworks: {}
    });
    store = useCanvasStore.getState();
  });

  it("deletion of all legos from a network should keep the network in the cache but set isActive to false", () => {
    const lego1 = createMockLego("lego1", new LogicalPoint(0, 0));
    const lego2 = createMockLego("lego2", new LogicalPoint(100, 0));

    // Add the legos to the store
    store.addDroppedLegos([lego1, lego2]);

    // Create a cached network for the locked network
    const mockCachedNetwork = {
      isActive: true,
      tensorNetwork: new TensorNetwork({
        legos: [lego1, lego2],
        connections: [],
        signature: "network1"
      }),
      svg: "<svg></svg>",
      name: "Test Locked Network",
      isLocked: false,
      lastUpdated: new Date()
    } as CachedTensorNetwork;

    store.cacheTensorNetwork(mockCachedNetwork);

    // Delete all legos - should succeed
    expect(() => {
      store.removeDroppedLegos(["lego1", "lego2"]);
    }).not.toThrow();

    // Verify the legos are deleted
    store = useCanvasStore.getState();
    expect(store.droppedLegos).toHaveLength(0);
    // Verify the cached network is still there, but is not active
    const cachedNetworkAfter = store.getCachedTensorNetwork("network1");
    expect(cachedNetworkAfter).toBeTruthy();
    expect(cachedNetworkAfter?.isActive).toBe(false);
  });

  it("should handle deletion of partial set of legos from cached networks correctly", () => {
    // Create legos for an unlocked network
    const lego1 = createMockLego("lego1", new LogicalPoint(0, 0));
    const lego2 = createMockLego("lego2", new LogicalPoint(100, 0));

    // Add the legos to the store
    store.addDroppedLegos([lego1, lego2]);

    // Create a cached network for the unlocked network
    const mockCachedNetwork = {
      isActive: true,
      tensorNetwork: new TensorNetwork({
        legos: [lego1, lego2],
        connections: [],
        signature: "network1"
      }),
      svg: "<svg></svg>",
      name: "Test Unlocked Network",
      isLocked: false,
      lastUpdated: new Date()
    } as CachedTensorNetwork;

    store.cacheTensorNetwork(mockCachedNetwork);

    // Verify the cached network exists and is unlocked
    store = useCanvasStore.getState();
    const cachedNetwork = store.getCachedTensorNetwork("network1");
    expect(cachedNetwork).toBeTruthy();
    expect(cachedNetwork?.isLocked).toBe(false);
    expect(cachedNetwork?.isActive).toBe(true);

    // Delete all legos in the unlocked network
    store.removeDroppedLego("lego1");

    // Verify the legos are deleted
    store = useCanvasStore.getState();
    expect(store.droppedLegos).toHaveLength(1);
    expect(store.droppedLegos[0].instance_id).toBe("lego2");

    // Verify the cached network is still there, but is not active
    const cachedNetworkAfter = store.getCachedTensorNetwork("network1");
    expect(cachedNetworkAfter).toBeTruthy();
    expect(cachedNetworkAfter?.isActive).toBe(false);
    expect(cachedNetworkAfter?.isLocked).toBe(false);
  });

  it("after deletion and readdition of all legos from a network should reactivate the network in the cache", () => {
    const lego1 = createMockLego("lego1", new LogicalPoint(0, 0));
    const lego2 = createMockLego("lego2", new LogicalPoint(100, 0));

    // Add the legos to the store
    store.addDroppedLegos([lego1, lego2]);

    // Create a cached network for the locked network, say the user named it "network1"
    const mockCachedNetwork = {
      isActive: true,
      tensorNetwork: new TensorNetwork({
        legos: [lego1, lego2],
        connections: [],
        signature: "network1"
      }),
      svg: "<svg></svg>",
      name: "Test Named Network",
      isLocked: false,
      lastUpdated: new Date()
    } as CachedTensorNetwork;

    store.cacheTensorNetwork(mockCachedNetwork);

    // Delete all legos
    store.removeDroppedLegos(["lego1", "lego2"]);

    // Add the legos back to the store
    store.addDroppedLegos([lego1, lego2]);

    // Verify the legos are added back
    store = useCanvasStore.getState();
    expect(store.droppedLegos).toHaveLength(2);

    // Verify the cached network is still there, and is active
    const cachedNetworkAfter = store.getCachedTensorNetwork("network1");
    expect(cachedNetworkAfter).toBeTruthy();
    expect(cachedNetworkAfter?.isActive).toBe(true);

    store.removeDroppedLegos(["lego1", "lego2"]);

    store.addDroppedLego(lego2);
    store.addDroppedLego(lego1);

    store = useCanvasStore.getState();
    expect(store.droppedLegos).toHaveLength(2);
    expect(store.droppedLegos[0].instance_id).toBe("lego2");
    expect(store.droppedLegos[1].instance_id).toBe("lego1");

    const cachedNetworkAfter2 = store.getCachedTensorNetwork("network1");
    expect(cachedNetworkAfter2).toBeTruthy();
    expect(cachedNetworkAfter2?.isActive).toBe(true);
  });

  it("a cached network reactivation should resync the lego positions in the cached network", () => {
    const lego1 = createMockLego("lego1", new LogicalPoint(0, 0));
    const lego2 = createMockLego("lego2", new LogicalPoint(100, 0));

    // Add the legos to the store
    store.addDroppedLegos([lego1, lego2]);

    // Create a cached network for the locked network, say the user named it "network1"
    const mockCachedNetwork = {
      isActive: true,
      tensorNetwork: new TensorNetwork({
        legos: [lego1, lego2],
        connections: [],
        signature: "network1"
      }),
      svg: "<svg></svg>",
      name: "Test Named Network",
      isLocked: false,
      lastUpdated: new Date()
    } as CachedTensorNetwork;

    store.cacheTensorNetwork(mockCachedNetwork);

    // Delete all legos
    store.removeDroppedLegos(["lego1", "lego2"]);

    const lego1_moved = lego1.with({
      logicalPosition: new LogicalPoint(100, 100)
    });
    const lego2_moved = lego2.with({
      logicalPosition: new LogicalPoint(200, 200)
    });

    // Add the legos back to the store
    store.addDroppedLegos([lego1_moved, lego2_moved]);

    // Verify the legos are moved
    store = useCanvasStore.getState();
    expect(store.droppedLegos).toHaveLength(2);
    expect(store.droppedLegos[0].logicalPosition).toEqual(
      new LogicalPoint(100, 100)
    );
    expect(store.droppedLegos[1].logicalPosition).toEqual(
      new LogicalPoint(200, 200)
    );

    // Verify the cached network is still there, and is active
    const cachedNetworkAfter = store.getCachedTensorNetwork("network1");
    expect(cachedNetworkAfter).toBeTruthy();
    expect(cachedNetworkAfter?.isActive).toBe(true);
    expect(cachedNetworkAfter?.tensorNetwork.legos[0].logicalPosition).toEqual(
      new LogicalPoint(100, 100)
    );
    expect(cachedNetworkAfter?.tensorNetwork.legos[1].logicalPosition).toEqual(
      new LogicalPoint(200, 200)
    );
  });

  it("should update the cached network when the lego positions are updated", () => {
    const lego1 = createMockLego("lego1", new LogicalPoint(0, 0));
    const lego2 = createMockLego("lego2", new LogicalPoint(100, 0));

    // Add the legos to the store
    store.addDroppedLegos([lego1, lego2]);

    // Create a cached network for the locked network, say the user named it "network1"
    const mockCachedNetwork = {
      isActive: true,
      tensorNetwork: new TensorNetwork({
        legos: [lego1, lego2],
        connections: [],
        signature: "network1"
      }),
      svg: "<svg></svg>",
      name: "Test Named Network",
      isLocked: false,
      lastUpdated: new Date()
    } as CachedTensorNetwork;

    store.cacheTensorNetwork(mockCachedNetwork);

    const lego1_moved = lego1.with({
      logicalPosition: new LogicalPoint(100, 100)
    });
    const lego2_moved = lego2.with({
      logicalPosition: new LogicalPoint(200, 200)
    });

    store.moveDroppedLegos([lego1_moved, lego2_moved]);

    store = useCanvasStore.getState();
    expect(store.droppedLegos[0].logicalPosition).toEqual(
      new LogicalPoint(100, 100)
    );
    expect(store.droppedLegos[1].logicalPosition).toEqual(
      new LogicalPoint(200, 200)
    );

    const cachedNetworkAfter = store.getCachedTensorNetwork("network1");
    expect(cachedNetworkAfter).toBeTruthy();
    expect(cachedNetworkAfter?.isActive).toBe(true);
    expect(cachedNetworkAfter?.tensorNetwork.legos[0].logicalPosition).toEqual(
      new LogicalPoint(100, 100)
    );
    expect(cachedNetworkAfter?.tensorNetwork.legos[1].logicalPosition).toEqual(
      new LogicalPoint(200, 200)
    );
  });
});
