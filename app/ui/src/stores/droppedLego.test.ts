import { DroppedLego } from "./droppedLegoStore";
import { LogicalPoint } from "../types/coordinates";

describe("DroppedLego", () => {
  it("should create a new lego with the correct properties", () => {
    const lego = new DroppedLego(
      {
        typeId: "1",
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
      new LogicalPoint(0, 0),
      "1"
    );

    expect(lego.typeId).toBe("1");
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
        typeId: "1",
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
      new LogicalPoint(0, 0),
      "1",
      {
        logicalPosition: new LogicalPoint(10, 10),
        instanceId: "2"
      }
    );

    expect(lego.typeId).toBe("1");
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
    expect(lego.logicalPosition.x).toBe(0);
    expect(lego.logicalPosition.y).toBe(0);
    expect(lego.instanceId).toBe("1");

    // However, when used with the with method, the override is applied
    const lego2 = lego.with({
      logicalPosition: new LogicalPoint(10, 10),
      instanceId: "2"
    });
    expect(lego2.logicalPosition.x).toBe(10);
    expect(lego2.logicalPosition.y).toBe(10);
    expect(lego2.instanceId).toBe("2");
  });

  it("should create a new lego with the correct properties when overridden with the with method", () => {
    const lego = new DroppedLego(
      {
        typeId: "1",
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
      new LogicalPoint(0, 0),
      "1",
      {
        selectedMatrixRows: [0, 1]
      }
    );

    expect(lego.selectedMatrixRows).toEqual([0, 1]);

    const lego2 = lego.with({
      logicalPosition: new LogicalPoint(10, 10),
      instanceId: "2"
    });
    expect(lego2.logicalPosition.x).toBe(10);
    expect(lego2.logicalPosition.y).toBe(10);
    expect(lego2.instanceId).toBe("2");
    expect(lego2.selectedMatrixRows).toEqual([0, 1]);
  });
});
