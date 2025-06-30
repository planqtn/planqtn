import { DroppedLego } from "./droppedLegoStore";

describe("DroppedLego", () => {
  it("should create a new lego with the correct properties", () => {
    const lego = new DroppedLego(
      {
        id: "1",
        name: "Test Lego",
        shortName: "TL",
        description: "Test Lego",
        parity_check_matrix: [
          [1, 0],
          [0, 1]
        ],
        logical_legs: [0, 1],
        gauge_legs: [2, 3]
      },
      0,
      0,
      "1"
    );

    expect(lego.id).toBe("1");
    expect(lego.name).toBe("Test Lego");
    expect(lego.shortName).toBe("TL");
    expect(lego.description).toBe("Test Lego");
    expect(lego.parity_check_matrix).toEqual([
      [1, 0],
      [0, 1]
    ]);
    expect(lego.logical_legs).toEqual([0, 1]);
    expect(lego.gauge_legs).toEqual([2, 3]);
  });

  it("should create a new lego with the correct properties when overridden", () => {
    const lego = new DroppedLego(
      {
        id: "1",
        name: "Test Lego",
        shortName: "TL",
        description: "Test Lego",
        parity_check_matrix: [
          [1, 0],
          [0, 1]
        ],
        logical_legs: [0, 1],
        gauge_legs: [2, 3]
      },
      0,
      0,
      "1",
      {
        x: 10,
        y: 10,
        instanceId: "2"
      }
    );

    expect(lego.id).toBe("1");
    expect(lego.name).toBe("Test Lego");
    expect(lego.shortName).toBe("TL");
    expect(lego.description).toBe("Test Lego");
    expect(lego.selectedMatrixRows).toEqual([]);
    expect(lego.parity_check_matrix).toEqual([
      [1, 0],
      [0, 1]
    ]);
    expect(lego.logical_legs).toEqual([0, 1]);
    expect(lego.gauge_legs).toEqual([2, 3]);
    // we ignore the override for mandatory parameters passed to the constructor
    expect(lego.x).toBe(0);
    expect(lego.y).toBe(0);
    expect(lego.instanceId).toBe("1");

    // However, when used with the with method, the override is applied
    const lego2 = lego.with({ x: 10, y: 10, instanceId: "2" });
    expect(lego2.x).toBe(10);
    expect(lego2.y).toBe(10);
    expect(lego2.instanceId).toBe("2");
  });

  it("should create a new lego with the correct properties when overridden with the with method", () => {
    const lego = new DroppedLego(
      {
        id: "1",
        name: "Test Lego",
        shortName: "TL",
        description: "Test Lego",
        parity_check_matrix: [
          [1, 0],
          [0, 1]
        ],
        logical_legs: [0, 1],
        gauge_legs: [2, 3]
      },
      0,
      0,
      "1",
      {
        selectedMatrixRows: [0, 1]
      }
    );

    expect(lego.selectedMatrixRows).toEqual([0, 1]);

    const lego2 = lego.with({ x: 10, y: 10, instanceId: "2" });
    expect(lego2.x).toBe(10);
    expect(lego2.y).toBe(10);
    expect(lego2.instanceId).toBe("2");
    expect(lego2.selectedMatrixRows).toEqual([0, 1]);
  });
});
