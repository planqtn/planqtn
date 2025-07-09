import { FuseLegos } from "./FuseLegos";
import { Connection } from "../stores/connectionStore";
import {
  createHadamardLego,
  createZRepCodeLego,
  DroppedLego
} from "../stores/droppedLegoStore";
import { LogicalPoint } from "../types/coordinates";
import { Legos } from "../features/lego/Legos";

// Mock data for testing
const testDroppedLegos = [
  new DroppedLego(
    {
      typeId: "lego1",
      shortName: "L1",
      name: "Lego 1",
      description: "Test Lego 1",
      parity_check_matrix: [[1, 0]],
      logical_legs: [],
      gauge_legs: []
    },
    new LogicalPoint(0, 0),
    "instance1"
  ),
  new DroppedLego(
    {
      typeId: "lego2",
      shortName: "L2",
      name: "Lego 2",
      description: "Test Lego 2",
      parity_check_matrix: [[1, 0]],
      logical_legs: [],
      gauge_legs: []
    },
    new LogicalPoint(1, 1),
    "instance2"
  ),
  new DroppedLego(
    {
      typeId: "stopper_x",
      shortName: "X",
      name: "X-Phase Flip Stopper",
      description: "X-Phase Flip Stopper",
      parity_check_matrix: [[0, 1]],
      logical_legs: [],
      gauge_legs: []
    },
    new LogicalPoint(1, 1),
    "stopper3"
  )
];

const invalidDroppedLegos = [
  new DroppedLego(
    {
      typeId: "lego3",
      shortName: "L3",
      name: "Lego 3",
      description: "Test Lego 3",
      parity_check_matrix: [[1, 0]],
      logical_legs: [],
      gauge_legs: []
    },
    new LogicalPoint(2, 2),
    "instance3"
  )
];

// Repro for bug https://github.com/planqtn/planqtn/issues/100
it("should successfully fuse two Z stopper legos into a single scalar one", async () => {
  const fuseLegos = new FuseLegos(
    [
      new Connection(
        { legoId: "instance1", legIndex: 0 },
        { legoId: "instance2", legIndex: 0 }
      )
    ],
    testDroppedLegos,
    () => {
      return "newInstanceId";
    }
  );
  const result = await fuseLegos.apply(testDroppedLegos.slice(0, 2));

  expect(result.droppedLegos).toHaveLength(2);
  const fusedLego = result.droppedLegos.find(
    (l) => l.instanceId === "newInstanceId"
  );
  expect(fusedLego).toBeTruthy();
  expect(fusedLego?.parity_check_matrix).toEqual([[1]]);
  expect(result.connections).toHaveLength(0);
  expect(result.operation.type).toBe("fuse");
  expect(result.operation.data.legosToAdd).toHaveLength(1);
  expect(result.operation.data.legosToRemove).toHaveLength(2);
});

// Repro for bug https://github.com/planqtn/planqtn/issues/100
it("should successfully fuse an X and Z stopper legos into a single scalar one", async () => {
  const fuseLegos = new FuseLegos(
    [
      new Connection(
        { legoId: "instance2", legIndex: 0 },
        { legoId: "stopper3", legIndex: 0 }
      )
    ],
    testDroppedLegos,
    () => {
      return "newInstanceId";
    }
  );
  const result = await fuseLegos.apply(testDroppedLegos.slice(1, 3));

  expect(result.droppedLegos).toHaveLength(2);
  const fusedLego = result.droppedLegos.find(
    (l) => l.instanceId === "newInstanceId"
  );
  expect(fusedLego).toBeTruthy();

  expect(fusedLego?.parity_check_matrix).toEqual([[0]]);
  expect(result.connections).toHaveLength(0);
  expect(result.operation.type).toBe("fuse");
  expect(result.operation.data.legosToAdd).toHaveLength(1);
  expect(result.operation.data.legosToRemove).toHaveLength(2);
});
// Test for failed fusion
it("should throw an error when legos cannot be fused", async () => {
  const fuseLegos = new FuseLegos([], testDroppedLegos);
  await expect(fuseLegos.apply(invalidDroppedLegos)).rejects.toThrow(
    "Failed to fuse legos"
  );
});

// Repro for bug https://github.com/planqtn/planqtn/issues/109
it("should be able to fuse two independent legos with an external connection", async () => {
  const droppedLegos = [
    createHadamardLego(new LogicalPoint(0, 0), "4"),
    createZRepCodeLego(new LogicalPoint(2, 2), "5", 3),
    createHadamardLego(new LogicalPoint(1, 1), "6")
  ];
  const fuseLegos = new FuseLegos(
    [
      new Connection({ legoId: "5", legIndex: 0 }, { legoId: "6", legIndex: 0 })
    ],
    droppedLegos,
    () => {
      return "newInstanceId";
    }
  );
  const result = await fuseLegos.apply([droppedLegos[0], droppedLegos[2]]);

  expect(result.droppedLegos).toHaveLength(2);
  const fusedLego = result.droppedLegos.find(
    (l) => l.instanceId === "newInstanceId"
  );
  expect(fusedLego).toBeTruthy();
});

it("should tensor the identity stopper with a regular lego", async () => {
  const droppedLegos = [
    createHadamardLego(new LogicalPoint(2, 2), "9"),
    // this should only add a single "unstabilized" leg
    new DroppedLego(Legos.stopper_i(), new LogicalPoint(1, 1), "8")
  ];
  const fuseLegos = new FuseLegos([], droppedLegos, () => {
    return "newInstanceId";
  });
  const result = await fuseLegos.apply(droppedLegos);
  expect(result.droppedLegos).toHaveLength(1);
  const fusedLego = result.droppedLegos.find(
    (l) => l.instanceId === "newInstanceId"
  );
  expect(fusedLego).toBeTruthy();
  expect(fusedLego?.parity_check_matrix).toEqual([
    [1, 0, 0, 0, 1, 0],
    [0, 1, 0, 1, 0, 0]
  ]);
});

it("should be able to fuse a scalar lego a stopper and a regular lego", async () => {
  const droppedLegos = [
    createHadamardLego(new LogicalPoint(2, 2), "9"),
    new DroppedLego(
      {
        typeId: "scalar",
        shortName: "S",
        name: "Scalar",
        description: "Scalar",
        parity_check_matrix: [[1]],
        logical_legs: [],
        gauge_legs: []
      },
      new LogicalPoint(1, 1),
      "8"
    ),
    new DroppedLego(Legos.stopper_i(), new LogicalPoint(1, 1), "10")
  ];
  const fuseLegos = new FuseLegos([], droppedLegos, () => {
    return "newInstanceId";
  });
  const result = await fuseLegos.apply(droppedLegos);
  expect(result.droppedLegos).toHaveLength(1);
  const fusedLego = result.droppedLegos.find(
    (l) => l.instanceId === "newInstanceId"
  );
  expect(fusedLego).toBeTruthy();
  expect(fusedLego?.parity_check_matrix).toEqual([
    [1, 0, 0, 0, 1, 0],
    [0, 1, 0, 1, 0, 0]
  ]);
});
