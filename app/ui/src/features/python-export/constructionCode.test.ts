import { Connection } from "../../stores/connectionStore";
import { exec } from "child_process";
import { TensorNetwork } from "../../lib/TensorNetwork.ts";
import { DroppedLego } from "../../stores/droppedLegoStore.ts";
import { LogicalPoint } from "../../types/coordinates.ts";
describe("constructionCode", () => {
  it("should generate empty network for empty tensor network", () => {
    const tensorNetwork = new TensorNetwork({ legos: [], connections: [] });
    const code = tensorNetwork.generateConstructionCode();
    expect(code)
      .toBe(`from planqtn.stabilizer_tensor_enumerator import StabilizerCodeTensorEnumerator
from planqtn.tensor_network import TensorNetwork
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
            type_id: "x_rep_code",
            name: "X-Repetition Code",
            short_name: "XREP3",
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
          new LogicalPoint(288.89581298828125, 381.25),
          "7"
        )
      ],
      connections: []
    });
    const code = tensorNetwork.generateConstructionCode();
    expect(code)
      .toBe(`from planqtn.stabilizer_tensor_enumerator import StabilizerCodeTensorEnumerator
from planqtn.tensor_network import TensorNetwork
from galois import GF2

# Create nodes
nodes = {
    "7": StabilizerCodeTensorEnumerator(tensor_id="7", h=GF2([
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
            type_id: "x_rep_code",
            name: "X-Repetition Code",
            short_name: "XREP3",
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
          new LogicalPoint(288.89581298828125, 381.25),
          "2"
        ),
        new DroppedLego(
          {
            type_id: "steane",
            name: "Steane Code",
            short_name: "STN",
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
          new LogicalPoint(477.89581298828125, 308.25),
          "3"
        ),
        new DroppedLego(
          {
            type_id: "x_rep_code",
            name: "X-Repetition Code",
            short_name: "XREP3",
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
          new LogicalPoint(139.89581298828125, 143.25),
          "4"
        ),
        new DroppedLego(
          {
            type_id: "z_rep_code",
            name: "Z-Repetition Code",
            short_name: "ZREP3",
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
          new LogicalPoint(311.89581298828125, 187.25),
          "1"
        ),
        new DroppedLego(
          {
            type_id: "stopper_x",
            name: "X Stopper",
            short_name: "X",
            description: "X Stopper",
            parity_check_matrix: [[1, 0]],
            logical_legs: [],
            gauge_legs: []
          },
          new LogicalPoint(411.89581298828125, 187.25),
          "5"
        )
      ],
      connections: [
        new Connection(
          { legoId: "1", leg_index: 0 },
          { legoId: "3", leg_index: 7 }
        ),
        new Connection(
          { legoId: "1", leg_index: 1 },
          { legoId: "2", leg_index: 2 }
        ),
        new Connection(
          { legoId: "4", leg_index: 0 },
          { legoId: "1", leg_index: 2 }
        ),
        new Connection(
          { legoId: "1", leg_index: 3 },
          { legoId: "5", leg_index: 0 }
        )
      ]
    });
    const code = tensorNetwork.generateConstructionCode();
    expect(code).toBeDefined();

    const python_script = code + "\n\n" + "print(tn.conjoin_nodes().h)";
    // Execute Python script and handle output
    console.log("this file", process.env.PYTHONPATH);
    await new Promise<void>((resolve, reject) => {
      exec(`python3 -c '${python_script}'`, (error, stdout) => {
        if (error) {
          reject(error);
          return;
        }
        // if (stderr) {
        //   reject(new Error(stderr));
        //   return;
        // }

        // Parse the output into a matrix
        const parity_check_matrix = stdout
          .trim()
          .split("\n")
          .map((line: string) =>
            line.trim().replace(/[[\]]/g, "").split(" ").map(Number)
          );

        // prettier-ignore
        const expected_parityCheckMatrix = [
          [
            0, 1, 0, 0, 1, 0, 1, 1,
            0, 0, 0, 1, 0, 0, 0, 0,
            0, 0, 0, 0, 0, 0, 0, 0
          ],
          [
            0, 0, 0, 0, 0, 1, 1, 1,
            1, 0, 0, 0, 0, 0, 0, 0,
            0, 0, 0, 0, 0, 0, 0, 0
          ],
          [
            0, 0, 1, 0, 1, 0, 1, 0,
            1, 0, 0, 0, 0, 0, 0, 0,
            0, 0, 0, 0, 0, 0, 0, 0
          ],
          [
            0, 0, 0, 0, 0, 0, 0, 0,
            0, 0, 0, 0, 0, 0, 0, 0,
            0, 1, 1, 1, 1, 0, 0, 0
          ],
          [
            1, 0, 0, 0, 1, 0, 1, 1,
            0, 0, 0, 1, 0, 0, 0, 0,
            0, 0, 0, 0, 0, 0, 0, 0
          ],
          [
            0, 0, 0, 0, 0, 0, 0, 0,
            0, 0, 0, 0, 0, 0, 0, 1,
            0, 0, 1, 0, 1, 1, 1, 1
          ],
          [
            0, 0, 0, 1, 1, 0, 0, 1,
            1, 0, 0, 0, 0, 0, 0, 0,
            0, 0, 0, 0, 0, 0, 0, 0
          ],
          [
            0, 0, 0, 0, 0, 0, 0, 0,
            0, 0, 0, 0, 1, 1, 0, 0,
            0, 0, 0, 0, 0, 1, 1, 1
          ],
          [
            0, 0, 0, 0, 0, 0, 0, 0,
            0, 1, 0, 1, 0, 0, 0, 0,
            0, 0, 0, 0, 0, 0, 0, 0
          ],
          [
            0, 0, 0, 0, 0, 0, 0, 0,
            0, 0, 1, 1, 0, 0, 0, 0,
            0, 0, 0, 0, 0, 0, 0, 0
          ],
          [
            0, 0, 0, 0, 0, 0, 0, 0,
            0, 0, 0, 0, 0, 0, 0, 0,
            1, 0, 1, 1, 0, 1, 1, 1
          ],
          [
            0, 0, 0, 0, 0, 0, 0, 0,
            0, 0, 0, 0, 0, 0, 1, 0,
            0, 0, 0, 1, 1, 1, 1, 1
          ]
        ];
        // console.log("parity_check_matrix", parity_check_matrix);

        expect(parity_check_matrix).toEqual(expected_parityCheckMatrix);
        resolve();
      });
    });
  }, 10000);
});
