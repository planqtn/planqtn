import { OperationHistory } from "./OperationHistory";
import { Connection } from "../../stores/connectionStore";
import { Operation } from "./OperationHistory.ts";
import { DroppedLego } from "../../stores/droppedLegoStore.ts";
import { describe, it, expect, beforeEach } from "@jest/globals";
import { LogicalPoint } from "../../types/coordinates.ts";

describe("OperationHistory", () => {
  let operationHistory: OperationHistory;

  beforeEach(() => {
    operationHistory = new OperationHistory([]);
  });

  describe("undo and redo", () => {
    it("should return to original state after undo and redo of add operation", () => {
      const lego: DroppedLego = new DroppedLego(
        {
          typeId: "lego1",
          name: "Test Lego",
          shortName: "TL",
          description: "Test Description",
          parityCheckMatrix: [
            [1, 0],
            [0, 1]
          ],
          logicalLegs: [0],
          gaugeLegs: [1]
        },
        new LogicalPoint(0, 0),
        "instance1"
      );

      const operation: Operation = {
        type: "add",
        data: {
          legosToAdd: [lego]
        }
      };

      // Initial state with the lego
      const initialState = { connections: [], droppedLegos: [lego] };

      // Add operation and perform undo
      operationHistory.addOperation(operation);
      const afterUndo = operationHistory.undo(
        initialState.connections,
        initialState.droppedLegos
      );

      // Verify undo removed the lego
      expect(afterUndo.droppedLegos).toHaveLength(0);
      expect(afterUndo.connections).toHaveLength(0);

      // Perform redo
      const afterRedo = operationHistory.redo(
        afterUndo.connections,
        afterUndo.droppedLegos
      );

      // Verify redo restored the original state
      expect(afterRedo.droppedLegos).toHaveLength(1);
      expect(afterRedo.droppedLegos[0]).toEqual(lego);
      expect(afterRedo.connections).toHaveLength(0);
    });

    it("should handle multiple undos after add and move operations", () => {
      const lego: DroppedLego = new DroppedLego(
        {
          typeId: "lego1",
          name: "Test Lego",
          shortName: "TL",
          description: "Test Description",
          parityCheckMatrix: [
            [1, 0],
            [0, 1]
          ],
          logicalLegs: [0],
          gaugeLegs: [1]
        },
        new LogicalPoint(0, 0),
        "instance1"
      );

      // Add operation
      const addOperation: Operation = {
        type: "add",
        data: {
          legosToAdd: [lego]
        }
      };

      // Move operation
      const moveOperation: Operation = {
        type: "move",
        data: {
          legosToUpdate: [
            {
              oldLego: lego,
              newLego: lego.with({
                logicalPosition: new LogicalPoint(10, 10)
              })
            }
          ]
        }
      };

      // Add the lego
      operationHistory.addOperation(addOperation);
      // Move the lego
      operationHistory.addOperation(moveOperation);

      // Current state: lego at (10,10)
      let currentState: {
        connections: Connection[];
        droppedLegos: DroppedLego[];
      } = {
        connections: [],
        droppedLegos: [
          lego.with({
            logicalPosition: new LogicalPoint(10, 10)
          })
        ]
      };

      // First undo: should move lego back to (0,0)
      currentState = operationHistory.undo(
        currentState.connections,
        currentState.droppedLegos
      );
      expect(currentState.droppedLegos[0].logicalPosition.x).toBe(0);
      expect(currentState.droppedLegos[0].logicalPosition.y).toBe(0);

      // Second undo: should remove the lego completely
      currentState = operationHistory.undo(
        currentState.connections,
        currentState.droppedLegos
      );
      expect(currentState.droppedLegos).toHaveLength(0);
      expect(currentState.connections).toHaveLength(0);
    });

    it("should handle multiple undos after fuse and unfuse operations", () => {
      // Create initial legos
      const hadamard: DroppedLego = new DroppedLego(
        {
          typeId: "hadamard",
          name: "Hadamard",
          shortName: "H",
          description: "Hadamard Gate",
          parityCheckMatrix: [
            [1, 0],
            [0, 1]
          ],
          logicalLegs: [],
          gaugeLegs: []
        },
        new LogicalPoint(0, 0),
        "h1"
      );

      const zRep1: DroppedLego = new DroppedLego(
        {
          typeId: "z-rep",
          name: "Z-Rep Code",
          shortName: "Z",
          description: "Z-Repetition Code",
          parityCheckMatrix: [
            [0, 0, 0, 1, 1, 0],
            [0, 0, 0, 0, 1, 1],
            [1, 1, 1, 0, 0, 0]
          ],
          logicalLegs: [],
          gaugeLegs: []
        },
        new LogicalPoint(100, 0),
        "1"
      );

      const zRep2: DroppedLego = zRep1.with({
        instanceId: "2",
        logicalPosition: new LogicalPoint(200, 0)
      });

      // Create initial connections
      const initialConnections: Connection[] = [
        new Connection(
          {
            legoId: "hadamard",
            legIndex: 0
          },
          {
            legoId: "1",
            legIndex: 0
          }
        ),
        new Connection(
          {
            legoId: "1",
            legIndex: 1
          },
          {
            legoId: "2",
            legIndex: 0
          }
        )
      ];

      // Initial state

      const initialState = {
        connections: initialConnections,
        droppedLegos: [hadamard, zRep1, zRep2]
      };

      // Fuse operation
      const fusedLego: DroppedLego = zRep1.with({
        instanceId: "fused",
        parityCheckMatrix: [
          [1, 1, 1, 1, 0, 0, 0, 0],
          [0, 0, 0, 0, 1, 1, 0, 0],
          [0, 0, 0, 0, 0, 1, 1, 0],
          [0, 0, 0, 0, 0, 0, 1, 1]
        ],
        logicalLegs: [],
        gaugeLegs: []
      });
      const fuseOperation: Operation = {
        type: "fuse",
        data: {
          legosToRemove: [zRep1, zRep2],
          connectionsToRemove: initialState.connections,
          legosToAdd: [fusedLego],
          connectionsToAdd: [
            new Connection(
              {
                legoId: "h1",
                legIndex: 0
              },
              {
                legoId: "fused",
                legIndex: 0
              }
            )
          ]
        }
      };

      // Add fuse operation
      operationHistory.addOperation(fuseOperation);

      // Update state after fuse
      const stateAfterFuse = {
        connections: [
          new Connection(
            {
              legoId: "h1",
              legIndex: 0
            },
            {
              legoId: "fused",
              legIndex: 0
            }
          )
        ],
        droppedLegos: [hadamard, fusedLego]
      };

      const zRep1_2: DroppedLego = zRep1.with({
        instanceId: "zRep12",
        logicalPosition: new LogicalPoint(150, 0)
      });

      const zRep2_2: DroppedLego = zRep2.with({
        instanceId: "zRep22",
        logicalPosition: new LogicalPoint(250, 0)
      });

      // Update state after fuse
      const stateAfterUnfuse = {
        connections: [
          new Connection(
            {
              legoId: "h1",
              legIndex: 0
            },
            {
              legoId: "zRep12",
              legIndex: 0
            }
          ),
          new Connection(
            {
              legoId: "zRep12",
              legIndex: 2
            },
            {
              legoId: "zRep22",
              legIndex: 2
            }
          )
        ],
        droppedLegos: [hadamard, zRep1_2, zRep2_2]
      };

      // Unfuse operation
      const unfuseOperation: Operation = {
        type: "unfuseInto2Legos",
        data: {
          legosToRemove: stateAfterFuse.droppedLegos,
          connectionsToRemove: stateAfterFuse.connections,
          legosToAdd: stateAfterUnfuse.droppedLegos,
          connectionsToAdd: stateAfterUnfuse.connections
        }
      };

      // Add unfuse operation
      operationHistory.addOperation(unfuseOperation);

      // First undo: should unfuse the legos
      let currentState = operationHistory.undo(
        stateAfterUnfuse.connections,
        stateAfterUnfuse.droppedLegos
      );
      expect(currentState).toEqual(stateAfterFuse);

      // Second undo: should unfuse back to original state

      currentState = operationHistory.undo(
        currentState.connections,
        currentState.droppedLegos
      );
      // console.log("currentState", currentState);
      // console.log("initialState", initialState);
      expect(currentState).toEqual(initialState);
    });
  });

  describe("undo", () => {
    it("should handle empty history", () => {
      const result = operationHistory.undo([], []);
      expect(result).toEqual({ connections: [], droppedLegos: [] });
    });

    it("should undo an add operation", () => {
      const lego: DroppedLego = new DroppedLego(
        {
          typeId: "lego1",
          name: "Test Lego",
          shortName: "TL",
          description: "Test Description",
          parityCheckMatrix: [
            [1, 0],
            [0, 1]
          ],
          logicalLegs: [0],
          gaugeLegs: [1]
        },
        new LogicalPoint(0, 0),
        "instance1"
      );

      const operation: Operation = {
        type: "add",
        data: {
          legosToAdd: [lego]
        }
      };

      operationHistory.addOperation(operation);
      const result = operationHistory.undo([], [lego]);

      expect(result.droppedLegos).toHaveLength(0);
    });

    it("should undo a move operation", () => {
      const lego: DroppedLego = new DroppedLego(
        {
          typeId: "lego1",
          name: "Test Lego",
          shortName: "TL",
          description: "Test Description",
          parityCheckMatrix: [
            [1, 0],
            [0, 1]
          ],
          logicalLegs: [0],
          gaugeLegs: [1]
        },
        new LogicalPoint(0, 0),
        "instance1"
      );

      const operation: Operation = {
        type: "move",
        data: {
          legosToUpdate: [
            {
              oldLego: lego,
              newLego: lego.with({ logicalPosition: new LogicalPoint(10, 10) })
            }
          ]
        }
      };

      operationHistory.addOperation(operation);
      const result = operationHistory.undo([], [lego]);

      expect(result.droppedLegos[0].logicalPosition.x).toBe(0);
      expect(result.droppedLegos[0].logicalPosition.y).toBe(0);
    });

    it("should undo a connect operation", () => {
      const connection: Connection = new Connection(
        { legoId: "instance1", legIndex: 0 },
        { legoId: "instance2", legIndex: 1 }
      );

      const operation: Operation = {
        type: "connect",
        data: {
          connectionsToAdd: [connection]
        }
      };

      operationHistory.addOperation(operation);
      const result = operationHistory.undo([connection], []);

      expect(result.connections).toHaveLength(0);
    });
  });

  describe("redo", () => {
    it("should handle empty redo history", () => {
      const result = operationHistory.redo([], []);
      expect(result).toEqual({ connections: [], droppedLegos: [] });
    });

    it("should redo an add operation", () => {
      const lego: DroppedLego = new DroppedLego(
        {
          typeId: "lego1",
          name: "Test Lego",
          shortName: "TL",
          description: "Test Description",
          parityCheckMatrix: [
            [1, 0],
            [0, 1]
          ],
          logicalLegs: [0],
          gaugeLegs: [1]
        },
        new LogicalPoint(0, 0),
        "instance1"
      );

      const operation: Operation = {
        type: "add",
        data: {
          legosToAdd: [lego]
        }
      };

      operationHistory.addOperation(operation);
      operationHistory.undo([], [lego]);
      const result = operationHistory.redo([], []);

      expect(result.droppedLegos).toHaveLength(1);
      expect(result.droppedLegos[0].instanceId).toBe("instance1");
    });

    it("should redo a move operation", () => {
      const lego: DroppedLego = new DroppedLego(
        {
          typeId: "lego1",
          name: "Test Lego",
          shortName: "TL",
          description: "Test Description",
          parityCheckMatrix: [
            [1, 0],
            [0, 1]
          ],
          logicalLegs: [0],
          gaugeLegs: [1]
        },
        new LogicalPoint(0, 0),
        "instance1"
      );

      const operation: Operation = {
        type: "move",
        data: {
          legosToUpdate: [
            {
              oldLego: lego,
              newLego: lego.with({ logicalPosition: new LogicalPoint(10, 10) })
            }
          ]
        }
      };

      operationHistory.addOperation(operation);
      operationHistory.undo([], [lego]);
      const result = operationHistory.redo([], [lego]);

      expect(result.droppedLegos[0].logicalPosition.x).toBe(10);
      expect(result.droppedLegos[0].logicalPosition.y).toBe(10);
    });

    it("should redo a connect operation", () => {
      const connection: Connection = new Connection(
        { legoId: "instance1", legIndex: 0 },
        { legoId: "instance2", legIndex: 1 }
      );

      const operation: Operation = {
        type: "connect",
        data: {
          connectionsToAdd: [connection]
        }
      };

      operationHistory.addOperation(operation);
      operationHistory.undo([connection], []);
      const result = operationHistory.redo([], []);

      expect(result.connections).toHaveLength(1);
      expect(result.connections[0]).toEqual(connection);
    });
  });
});
