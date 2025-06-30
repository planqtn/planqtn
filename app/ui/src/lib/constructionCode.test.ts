import { Connection } from "./types";
import { exec } from "child_process";
import { TensorNetwork } from "./TensorNetwork";
import { DroppedLego } from "../stores/droppedLegoStore.ts";
describe("constructionCode", () => {
  it("should generate empty network for empty tensor network", () => {
    const tensorNetwork = new TensorNetwork({ legos: [], connections: [] });
    const code = tensorNetwork.generateConstructionCode();
    expect(code)
      .toBe(`from qlego.stabilizer_tensor_enumerator import StabilizerCodeTensorEnumerator
from qlego.tensor_network import TensorNetwork
from galois import GF2

# Create nodes
nodes = {
}

# Create tensor network
tn = TensorNetwork(nodes)

# Add traces`);
  });

  it("should generate construction code for a tensor network with one lego", () => {
    const tensorNetwork = new TensorNetwork({
      legos: [
        new DroppedLego(
          {
            id: "x_rep_code",
            name: "X-Repetition Code",
            shortName: "XREP3",
            description: "Phase flip code, XX stabilizers",
            is_dynamic: true,
            parameters: { d: 3 },
            parity_check_matrix: [
              [1, 1, 0, 0, 0, 0],
              [0, 1, 1, 0, 0, 0],
              [0, 0, 0, 1, 1, 1]
            ],
            logical_legs: [],
            gauge_legs: []
          },
          288.89581298828125,
          381.25,
          "7"
        )
      ],
      connections: []
    });
    const code = tensorNetwork.generateConstructionCode();
    expect(code)
      .toBe(`from qlego.stabilizer_tensor_enumerator import StabilizerCodeTensorEnumerator
from qlego.tensor_network import TensorNetwork
from galois import GF2

# Create nodes
nodes = {
    "7": StabilizerCodeTensorEnumerator(idx="7", h=GF2([
            [1, 1, 0, 0, 0, 0],
            [0, 1, 1, 0, 0, 0],
            [0, 0, 0, 1, 1, 1],
          ]),
    ),
}

# Create tensor network
tn = TensorNetwork(nodes)

# Add traces`);
  });

  it("should generate python runnable code with the right parity check matrix", async () => {
    const tensorNetwork = new TensorNetwork({
      legos: [
        new DroppedLego(
          {
            id: "x_rep_code",
            name: "X-Repetition Code",
            shortName: "XREP3",
            description: "Phase flip code, XX stabilizers",
            is_dynamic: true,
            parameters: { d: 3 },
            parity_check_matrix: [
              [1, 1, 0, 0, 0, 0],
              [0, 1, 1, 0, 0, 0],
              [0, 0, 0, 1, 1, 1]
            ],
            logical_legs: [],
            gauge_legs: []
          },
          288.89581298828125,
          381.25,
          "2"
        ),
        new DroppedLego(
          {
            id: "steane",
            name: "Steane Code",
            shortName: "STN",
            description: "Steane code encoding tensor",
            parity_check_matrix: [
              [0, 0, 0, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0],
              [0, 1, 1, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0],
              [1, 0, 1, 0, 1, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0],
              [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 0],
              [0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 1, 1, 0],
              [0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 1, 0, 1, 0, 1, 0],
              [1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0],
              [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1]
            ],
            logical_legs: [7],
            gauge_legs: []
          },
          477.89581298828125,
          308.25,
          "3"
        ),
        new DroppedLego(
          {
            id: "x_rep_code",
            name: "X-Repetition Code",
            shortName: "XREP3",
            description: "Phase flip code, XX stabilizers",
            is_dynamic: true,
            parameters: { d: 4 },
            parity_check_matrix: [
              [1, 1, 0, 0, 0, 0, 0, 0],
              [0, 1, 1, 0, 0, 0, 0, 0],
              [0, 0, 1, 1, 0, 0, 0, 0],
              [0, 0, 0, 0, 1, 1, 1, 1]
            ],
            logical_legs: [],
            gauge_legs: []
          },
          139.89581298828125,
          143.25,
          "4"
        ),
        new DroppedLego(
          {
            id: "z_rep_code",
            name: "Z-Repetition Code",
            shortName: "ZREP3",
            description: "Bitflip code, ZZ stabilizers",
            is_dynamic: true,
            parameters: { d: 3 },
            parity_check_matrix: [
              [0, 0, 0, 0, 1, 1, 0, 0],
              [0, 0, 0, 0, 0, 1, 1, 0],
              [0, 0, 0, 0, 0, 0, 1, 1],
              [1, 1, 1, 1, 0, 0, 0, 0]
            ],
            logical_legs: [],
            gauge_legs: []
          },
          311.89581298828125,
          187.25,
          "1"
        ),
        new DroppedLego(
          {
            id: "stopper_x",
            name: "X Stopper",
            shortName: "X",
            description: "X Stopper",
            parity_check_matrix: [[1, 0]],
            logical_legs: [],
            gauge_legs: []
          },
          411.89581298828125,
          187.25,
          "5"
        )
      ],
      connections: [
        new Connection(
          { legoId: "1", legIndex: 0 },
          { legoId: "3", legIndex: 7 }
        ),
        new Connection(
          { legoId: "1", legIndex: 1 },
          { legoId: "2", legIndex: 2 }
        ),
        new Connection(
          { legoId: "4", legIndex: 0 },
          { legoId: "1", legIndex: 2 }
        ),
        new Connection(
          { legoId: "1", legIndex: 3 },
          { legoId: "5", legIndex: 0 }
        )
      ]
    });
    const code = tensorNetwork.generateConstructionCode();
    expect(code).toBeDefined();

    const python_script = code + "\n\n" + "print(tn.conjoin_nodes().h)";
    // Execute Python script and handle output
    await new Promise<void>((resolve, reject) => {
      exec(`python3 -c '${python_script}'`, (error, stdout, stderr) => {
        if (error) {
          reject(error);
          return;
        }
        if (stderr) {
          reject(new Error(stderr));
          return;
        }

        // console.log("stdout: ", stdout);
        // Parse the output into a matrix
        const parity_check_matrix = stdout
          .trim()
          .split("\n")
          .map((line: string) =>
            line.trim().replace(/[[\]]/g, "").split(" ").map(Number)
          );

        // prettier-ignore
        const expected_parity_check_matrix = [
            [1, 0, 0, 0, 0, 1, 0, 1, 1, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 1, 1, 0, 1, 1],
            [0, 0, 0, 1, 0, 1, 0, 1, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 0, 0],
            [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 1, 0, 1, 1, 1],
            [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 1, 1, 1],
            [0, 0, 1, 0, 0, 1, 0, 1, 1, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
            [0, 1, 0, 0, 0, 1, 0, 1, 1, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 1, 1, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 1, 1]
        ];

        expect(parity_check_matrix).toEqual(expected_parity_check_matrix);
        resolve();
      });
    });
  }, 10000);
});
