import { generateConstructionCode } from "./constructionCode";
import { Connection, TensorNetwork } from "../types";
import { getLegoStyle } from "../LegoStyles";
import { exec } from "child_process";

describe("constructionCode", () => {
  it("should generate empty network for empty tensor network", () => {
    const tensorNetwork = {
      legos: [],
      connections: [],
    } as TensorNetwork;
    const code = generateConstructionCode(tensorNetwork);
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
    const tensorNetwork = {
      legos: [
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
            [0, 0, 0, 1, 1, 1],
          ],
          logical_legs: [],
          gauge_legs: [],
          x: 288.89581298828125,
          y: 381.25,
          instanceId: "7",
          style: getLegoStyle("x_rep_code", 3),
          selectedMatrixRows: [],
        },
      ],
      connections: [],
    } as TensorNetwork;
    const code = generateConstructionCode(tensorNetwork);
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
    const code = generateConstructionCode({
      legos: [
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
            [0, 0, 0, 1, 1, 1],
          ],
          logical_legs: [],
          gauge_legs: [],
          x: 288.89581298828125,
          y: 381.25,
          instanceId: "2",
          style: getLegoStyle("x_rep_code", 3),
          selectedMatrixRows: [],
        },
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
            [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1],
          ],
          logical_legs: [7],
          gauge_legs: [],
          instanceId: "3",
          x: 477.89581298828125,
          y: 308.25,
          style: getLegoStyle("steane", 8),
          selectedMatrixRows: [],
        },
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
            [0, 0, 0, 0, 1, 1, 1, 1],
          ],
          logical_legs: [],
          gauge_legs: [],
          x: 139.89581298828125,
          y: 143.25,
          instanceId: "4",
          style: getLegoStyle("x_rep_code", 4),
          selectedMatrixRows: [],
        },
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
            [1, 1, 1, 1, 0, 0, 0, 0],
          ],
          logical_legs: [],
          gauge_legs: [],
          x: 311.89581298828125,
          y: 187.25,
          instanceId: "1",
          style: getLegoStyle("z_rep_code", 4),
          selectedMatrixRows: [],
        },
        {
          id: "stopper_x",
          name: "X Stopper",
          shortName: "X",
          description: "X Stopper",
          instanceId: "5",
          x: 411.89581298828125,
          y: 187.25,
          parity_check_matrix: [[1, 0]],
          logical_legs: [],
          gauge_legs: [],
          style: getLegoStyle("stopper_x", 1),
          selectedMatrixRows: [],
        },
      ],
      connections: [
        new Connection(
          { legoId: "1", legIndex: 0 },
          { legoId: "3", legIndex: 7 },
        ),
        new Connection(
          { legoId: "1", legIndex: 1 },
          { legoId: "2", legIndex: 2 },
        ),
        new Connection(
          { legoId: "4", legIndex: 0 },
          { legoId: "1", legIndex: 2 },
        ),
        new Connection(
          { legoId: "1", legIndex: 3 },
          { legoId: "5", legIndex: 0 },
        ),
      ],
    } as TensorNetwork);
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
            line.trim().replace(/[[\]]/g, "").split(" ").map(Number),
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
  });
});
