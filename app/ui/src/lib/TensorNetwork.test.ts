import { TensorNetwork } from "./TensorNetwork";
import { DroppedLego, Connection } from "./types";
import { getLegoStyle } from "../LegoStyles";
import { GF2 } from "./GF2";

describe("TensorNetwork", () => {
  it("should correctly conjoin nodes after double tracing 602 with identity stoppers", () => {
    // Create the nodes
    const nodes: DroppedLego[] = [
      {
        id: "encoding_tensor_602",
        name: "Encoding Tensor 602",
        shortName: "602",
        description: "Encoding Tensor 602",
        instanceId: "0",
        x: 0,
        y: 0,
        style: getLegoStyle("encoding_tensor_602", 6),
        parity_check_matrix: [
          [1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0],
          [0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 0, 0],
          [1, 1, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0],
          [0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 1, 0],
          [0, 1, 1, 0, 0, 1, 0, 0, 0, 0, 0, 0],
          [0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 1]
        ],
        logical_legs: [],
        gauge_legs: [],
        selectedMatrixRows: []
      },
      {
        id: "stopper_i",
        name: "Identity Stopper",
        shortName: "I",
        description: "Identity Stopper",
        instanceId: "stop1",
        x: 0,
        y: 0,
        style: getLegoStyle("stopper_i", 1),
        parity_check_matrix: [[0, 0]],
        logical_legs: [],
        gauge_legs: [],
        selectedMatrixRows: []
      },
      {
        id: "stopper_i",
        name: "Identity Stopper",
        shortName: "I",
        description: "Identity Stopper",
        instanceId: "stop2",
        x: 0,
        y: 0,
        style: getLegoStyle("stopper_i", 1),
        parity_check_matrix: [[0, 0]],
        logical_legs: [],
        gauge_legs: [],
        selectedMatrixRows: []
      }
    ];

    // Create the connections
    const connections: Connection[] = [
      new Connection(
        { legoId: "stop1", legIndex: 0 },
        { legoId: "0", legIndex: 4 }
      ),
      new Connection(
        { legoId: "stop2", legIndex: 0 },
        { legoId: "0", legIndex: 5 }
      )
    ];

    // Create the tensor network
    const tn = new TensorNetwork(nodes, connections);

    // Get the conjoined tensor
    const conjoined = tn.conjoin_nodes();

    // Expected 422 parity check matrix
    const expected422Matrix = [
      [1, 1, 1, 1, 0, 0, 0, 0],
      [0, 0, 0, 0, 1, 1, 1, 1]
    ];

    // Compare the matrices
    expect(conjoined.h.getMatrix()).toEqual(expected422Matrix);
  });

  it("should calculate 6 lego TN parity check matrix", () => {
    // console.log(
    //   "=================6 lego TN parity check matrix=====================",
    // );
    const tn = TensorNetwork.fromObj({
      legos: [
        {
          id: "t5",
          name: "[[5,1,2]] tensor",
          shortName: "T5",
          description: "[[5,1,2]] encoding tensor",
          parity_check_matrix: [
            [1, 1, 1, 1, 0, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 1, 1, 1, 1, 0],
            [1, 1, 0, 0, 1, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0, 1, 1, 0, 1]
          ],
          logical_legs: [4],
          gauge_legs: [],
          is_dynamic: false,
          parameters: {},
          instanceId: "1",
          x: 894.7999877929688,
          y: 339.20000076293945,
          style: getLegoStyle("t5", 5),
          selectedMatrixRows: []
        },
        {
          id: "t5",
          name: "[[5,1,2]] tensor",
          shortName: "T5",
          description: "[[5,1,2]] encoding tensor",
          parity_check_matrix: [
            [1, 1, 1, 1, 0, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 1, 1, 1, 1, 0],
            [1, 1, 0, 0, 1, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0, 1, 1, 0, 1]
          ],
          logical_legs: [4],
          gauge_legs: [],
          is_dynamic: false,
          parameters: {},
          instanceId: "2",
          x: 750.7999877929688,
          y: 334.20000076293945,
          style: getLegoStyle("t5", 5),
          selectedMatrixRows: []
        },
        {
          id: "t5",
          name: "[[5,1,2]] tensor",
          shortName: "T5",
          description: "[[5,1,2]] encoding tensor",
          parity_check_matrix: [
            [1, 1, 1, 1, 0, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 1, 1, 1, 1, 0],
            [1, 1, 0, 0, 1, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0, 1, 1, 0, 1]
          ],
          logical_legs: [4],
          gauge_legs: [],
          is_dynamic: false,
          parameters: {},
          instanceId: "3",
          x: 625.7999877929688,
          y: 332.20000076293945,
          style: getLegoStyle("t5", 5),
          selectedMatrixRows: []
        },
        {
          id: "t5",
          name: "[[5,1,2]] tensor",
          shortName: "T5",
          description: "[[5,1,2]] encoding tensor",
          parity_check_matrix: [
            [1, 1, 1, 1, 0, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 1, 1, 1, 1, 0],
            [1, 1, 0, 0, 1, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0, 1, 1, 0, 1]
          ],
          logical_legs: [4],
          gauge_legs: [],
          is_dynamic: false,
          parameters: {},
          instanceId: "4",
          x: 624.7999877929688,
          y: 141.20000076293945,
          style: getLegoStyle("t5", 5),
          selectedMatrixRows: []
        },
        {
          id: "t5",
          name: "[[5,1,2]] tensor",
          shortName: "T5",
          description: "[[5,1,2]] encoding tensor",
          parity_check_matrix: [
            [1, 1, 1, 1, 0, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 1, 1, 1, 1, 0],
            [1, 1, 0, 0, 1, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0, 1, 1, 0, 1]
          ],
          logical_legs: [4],
          gauge_legs: [],
          is_dynamic: false,
          parameters: {},
          instanceId: "5",
          x: 749.7999877929688,
          y: 143.20000076293945,
          style: getLegoStyle("t5", 5),
          selectedMatrixRows: []
        },
        {
          id: "t5",
          name: "[[5,1,2]] tensor",
          shortName: "T5",
          description: "[[5,1,2]] encoding tensor",
          parity_check_matrix: [
            [1, 1, 1, 1, 0, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 1, 1, 1, 1, 0],
            [1, 1, 0, 0, 1, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0, 1, 1, 0, 1]
          ],
          logical_legs: [4],
          gauge_legs: [],
          is_dynamic: false,
          parameters: {},
          instanceId: "6",
          x: 893.7999877929688,
          y: 148.20000076293945,
          style: getLegoStyle("t5", 5),
          selectedMatrixRows: []
        }
      ],
      connections: [
        new Connection(
          { legoId: "5", legIndex: 0 },
          { legoId: "6", legIndex: 3 }
        ),
        new Connection(
          { legoId: "4", legIndex: 0 },
          { legoId: "5", legIndex: 3 }
        ),
        new Connection(
          { legoId: "4", legIndex: 2 },
          { legoId: "3", legIndex: 3 }
        ),
        new Connection(
          { legoId: "4", legIndex: 1 },
          { legoId: "3", legIndex: 0 }
        ),
        new Connection(
          { legoId: "5", legIndex: 2 },
          { legoId: "2", legIndex: 3 }
        ),
        new Connection(
          { legoId: "6", legIndex: 1 },
          { legoId: "1", legIndex: 0 }
        ),
        new Connection(
          { legoId: "2", legIndex: 1 },
          { legoId: "1", legIndex: 2 }
        ),
        new Connection(
          { legoId: "1", legIndex: 3 },
          { legoId: "2", legIndex: 0 }
        )
      ]
    });
    const conjoined = tn.conjoin_nodes();

    // prettier-ignore
    const expectedMatrix = GF2.gauss(new GF2([
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 1, 1, 0, 0, 0, 0, 1, 0, 1],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0],
      [0, 1, 0, 1, 0, 0, 0, 1, 0, 1, 1, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 1, 1, 0, 1, 0, 0, 1, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 0, 0, 0, 0],
      [0, 0, 1, 1, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1],
      [1, 0, 0, 1, 0, 0, 0, 1, 1, 0, 1, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
    ]));

    // console.log(sstr(GF2.gauss(conjoined.h)));
    // console.log(sstr(expectedMatrix));
    expect(GF2.gauss(conjoined.h)).toEqual(expectedMatrix);
  });
});
