import { useCanvasStore } from "./canvasStateStore";
import { WeightEnumerator } from "./tensorNetworkStore";
import { TensorNetworkLeg } from "../lib/TensorNetwork";

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
