import { TensorNetwork } from "./TensorNetwork";
import { Connection } from "./types";
import { DroppedLego } from "../stores/droppedLegoStore.ts";
import { GF2 } from "./GF2";

describe("TensorNetwork", () => {
  it("should correctly conjoin nodes after double tracing 602 with identity stoppers", () => {
    // Create the nodes
    const nodes: DroppedLego[] = [
      new DroppedLego(
        {
          id: "encoding_tensor_602",
          name: "Encoding Tensor 602",
          shortName: "602",
          description: "Encoding Tensor 602",

          parity_check_matrix: [
            [1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 0, 0],
            [1, 1, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 1, 0],
            [0, 1, 1, 0, 0, 1, 0, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 1]
          ],
          logical_legs: [],
          gauge_legs: []
        },
        0,
        0,
        "0"
      ),
      new DroppedLego(
        {
          id: "stopper_i",
          name: "Identity Stopper",
          shortName: "I",
          description: "Identity Stopper",

          parity_check_matrix: [[0, 0]],
          logical_legs: [],
          gauge_legs: []
        },
        0,
        0,
        "stop1"
      ),
      new DroppedLego(
        {
          id: "stopper_i",
          name: "Identity Stopper",
          shortName: "I",
          description: "Identity Stopper",

          parity_check_matrix: [[0, 0]],
          logical_legs: [],
          gauge_legs: []
        },
        0,
        0,
        "stop2"
      )
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
    const tn = new TensorNetwork({
      legos: nodes,
      connections: connections
    });

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
    const tn = new TensorNetwork({
      legos: [
        new DroppedLego(
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
            parameters: {}
          },
          0,
          0,
          "1"
        ),
        new DroppedLego(
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
            parameters: {}
          },
          0,
          0,
          "2"
        ),
        new DroppedLego(
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
            parameters: {}
          },
          0,
          0,
          "3"
        ),
        new DroppedLego(
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
            parameters: {}
          },
          0,
          0,
          "4"
        ),
        new DroppedLego(
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
            parameters: {}
          },
          0,
          0,
          "5"
        ),
        new DroppedLego(
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
            parameters: {}
          },
          0,
          0,
          "6"
        )
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
