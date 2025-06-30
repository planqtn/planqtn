import { Connection } from "../lib/types.ts";
import { simpleAutoFlow } from "./AutoPauliFlow.ts";
import { TensorNetwork } from "../lib/TensorNetwork.ts";
import { DroppedLego } from "../stores/droppedLegoStore.ts";
describe("simple auto flow", () => {
  const makeLego = ({
    id,
    name,
    parityMatrix,
    selectedRows = [] as number[],
    x = 0,
    y = 0
  }: {
    id: string;
    name: string;
    parityMatrix: number[][];
    selectedRows?: number[];
    x?: number;
    y?: number;
  }): DroppedLego =>
    new DroppedLego(
      {
        id: id,
        name: name,
        shortName: name,
        description: name,
        parity_check_matrix: parityMatrix,
        logical_legs: [],
        gauge_legs: []
      },
      x,
      y,
      id,
      { selectedMatrixRows: selectedRows }
    );

  const makeConn = (
    fromId: string,
    fromIdx: number,
    toId: string,
    toIdx: number
  ) =>
    new Connection(
      { legoId: fromId, legIndex: fromIdx },
      { legoId: toId, legIndex: toIdx }
    );

  // Helper function to test simpleAutoFlow
  const testSimpleAutoFlow = (
    changedLego: DroppedLego,
    tensorNetwork: TensorNetwork
  ): {
    updatedLegos: DroppedLego[];
    updatedTensorNetwork: TensorNetwork | null;
  } => {
    let updatedLegos = [...tensorNetwork.legos];
    let updatedTensorNetwork: TensorNetwork | null = tensorNetwork;

    const setDroppedLegos = (
      updater: (prev: DroppedLego[]) => DroppedLego[]
    ) => {
      updatedLegos = updater(updatedLegos);
    };

    const setTensorNetwork = (
      updater: (prev: TensorNetwork | null) => TensorNetwork | null
    ) => {
      updatedTensorNetwork = updater(updatedTensorNetwork);
    };

    simpleAutoFlow(
      changedLego,
      updatedLegos,
      tensorNetwork.connections,
      setDroppedLegos,
      setTensorNetwork
    );

    return { updatedLegos, updatedTensorNetwork };
  };

  it("do nothing if no highlights", () => {
    const connections: Connection[] = [makeConn("lego1", 0, "lego2", 3)];
    const tensorNetwork: TensorNetwork = new TensorNetwork({
      legos: [
        makeLego({
          id: "lego1",
          name: "x stopper",
          parityMatrix: [[1, 0]],
          selectedRows: []
        }),
        makeLego({
          id: "lego2",
          name: "tensor 512",
          parityMatrix: [
            [1, 1, 1, 1, 0, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 1, 1, 1, 1, 0],
            [1, 1, 0, 0, 1, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0, 1, 1, 0, 1]
          ],
          selectedRows: []
        })
      ],
      connections: connections
    });

    const { updatedLegos } = testSimpleAutoFlow(
      tensorNetwork.legos[0],
      tensorNetwork
    );

    const updatedX = updatedLegos.find(
      (lego: DroppedLego) => lego.instanceId === "lego1"
    );
    expect(updatedX!.selectedMatrixRows).toHaveLength(0);

    const updatedT5 = updatedLegos.find(
      (lego: DroppedLego) => lego.instanceId === "lego2"
    );
    expect(updatedT5!.selectedMatrixRows).toHaveLength(0);
  });

  it("highlight single connected stopper", () => {
    const connections: Connection[] = [makeConn("lego1", 0, "lego2", 3)];
    const tensorNetwork: TensorNetwork = new TensorNetwork({
      legos: [
        makeLego({
          id: "lego1",
          name: "x stopper",
          parityMatrix: [[1, 0]],
          selectedRows: []
        }),
        makeLego({
          id: "lego2",
          name: "tensor 512",
          parityMatrix: [
            [1, 1, 1, 1, 0, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 1, 1, 1, 1, 0],
            [1, 1, 0, 0, 1, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0, 1, 1, 0, 1]
          ],
          selectedRows: [0]
        })
      ],
      connections: connections
    });

    const { updatedLegos } = testSimpleAutoFlow(
      tensorNetwork.legos[1],
      tensorNetwork
    );

    const updatedX = updatedLegos.find(
      (lego: DroppedLego) => lego.instanceId === "lego1"
    );
    expect(updatedX!.selectedMatrixRows).toEqual(expect.arrayContaining([0]));
    expect(updatedX!.selectedMatrixRows).toHaveLength(1);

    const updatedT5 = updatedLegos.find(
      (lego: DroppedLego) => lego.instanceId === "lego2"
    );
    expect(updatedT5!.selectedMatrixRows).toEqual(expect.arrayContaining([0]));
    expect(updatedT5!.selectedMatrixRows).toHaveLength(1);
  });

  it("highlight single connected hadamard", () => {
    const connections: Connection[] = [makeConn("lego1", 1, "lego2", 0)];
    const tensorNetwork: TensorNetwork = new TensorNetwork({
      legos: [
        makeLego({
          id: "lego1",
          name: "hadmard",
          parityMatrix: [
            [1, 0, 0, 1],
            [0, 1, 1, 0]
          ],
          selectedRows: []
        }),
        makeLego({
          id: "lego2",
          name: "tensor 512",
          parityMatrix: [
            [1, 1, 1, 1, 0, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 1, 1, 1, 1, 0],
            [1, 1, 0, 0, 1, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0, 1, 1, 0, 1]
          ],
          selectedRows: [0]
        })
      ],
      connections: connections
    });

    const { updatedLegos: firstResult } = testSimpleAutoFlow(
      tensorNetwork.legos[1],
      tensorNetwork
    );

    const updatedX = firstResult.find(
      (lego: DroppedLego) => lego.instanceId === "lego1"
    );
    expect(updatedX!.selectedMatrixRows).toEqual(expect.arrayContaining([1]));
    expect(updatedX!.selectedMatrixRows).toHaveLength(1);

    const updatedT5 = firstResult.find(
      (lego: DroppedLego) => lego.instanceId === "lego2"
    );
    expect(updatedT5!.selectedMatrixRows).toEqual(expect.arrayContaining([0]));
    expect(updatedT5!.selectedMatrixRows).toHaveLength(1);

    // Switch legs of 5,1,2 tensor to make sure hadamard switches too
    tensorNetwork.legos[1] = tensorNetwork.legos[1].with({
      selectedMatrixRows: [1]
    });
    const { updatedLegos: secondResult } = testSimpleAutoFlow(
      tensorNetwork.legos[1],
      tensorNetwork
    );

    const updatedX2 = secondResult.find(
      (lego: DroppedLego) => lego.instanceId === "lego1"
    );
    expect(updatedX2!.selectedMatrixRows).toEqual(expect.arrayContaining([0]));
    expect(updatedX2!.selectedMatrixRows).toHaveLength(1);

    const updatedT52 = secondResult.find(
      (lego: DroppedLego) => lego.instanceId === "lego2"
    );
    expect(updatedT52!.selectedMatrixRows).toEqual(expect.arrayContaining([1]));
    expect(updatedT52!.selectedMatrixRows).toHaveLength(1);
  });

  it("do not highlight single connected complex lego", () => {
    const connections: Connection[] = [makeConn("lego1", 0, "lego2", 3)];
    const tensorNetwork: TensorNetwork = new TensorNetwork({
      legos: [
        makeLego({
          id: "lego1",
          name: "x stopper",
          parityMatrix: [[1, 0]],
          selectedRows: [0]
        }),
        makeLego({
          id: "lego2",
          name: "tensor 512",
          parityMatrix: [
            [1, 1, 1, 1, 0, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 1, 1, 1, 1, 0],
            [1, 1, 0, 0, 1, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0, 1, 1, 0, 1]
          ],
          selectedRows: []
        })
      ],
      connections: connections
    });

    const { updatedLegos } = testSimpleAutoFlow(
      tensorNetwork.legos[0],
      tensorNetwork
    );

    const updatedX = updatedLegos.find(
      (lego: DroppedLego) => lego.instanceId === "lego1"
    );
    expect(updatedX!.selectedMatrixRows).toEqual(expect.arrayContaining([0]));
    expect(updatedX!.selectedMatrixRows).toHaveLength(1);

    const updatedT5 = updatedLegos.find(
      (lego: DroppedLego) => lego.instanceId === "lego2"
    );
    expect(updatedT5!.selectedMatrixRows).toHaveLength(0);
  });

  it("remove highlight from simple lego that does not match", () => {
    const connections: Connection[] = [makeConn("lego1", 0, "lego2", 3)];
    const tensorNetwork: TensorNetwork = new TensorNetwork({
      legos: [
        makeLego({
          id: "lego1",
          name: "x stopper",
          parityMatrix: [[1, 0]],
          selectedRows: [0]
        }),
        makeLego({
          id: "lego2",
          name: "tensor 512",
          parityMatrix: [
            [1, 1, 1, 1, 0, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 1, 1, 1, 1, 0],
            [1, 1, 0, 0, 1, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0, 1, 1, 0, 1]
          ],
          selectedRows: [1]
        })
      ],
      connections: connections
    });

    const { updatedLegos } = testSimpleAutoFlow(
      tensorNetwork.legos[1],
      tensorNetwork
    );

    const updatedX = updatedLegos.find(
      (lego: DroppedLego) => lego.instanceId === "lego1"
    );
    expect(updatedX!.selectedMatrixRows).toHaveLength(0);

    const updatedT5 = updatedLegos.find(
      (lego: DroppedLego) => lego.instanceId === "lego2"
    );
    expect(updatedT5!.selectedMatrixRows).toEqual(expect.arrayContaining([1]));
    expect(updatedT5!.selectedMatrixRows).toHaveLength(1);
  });

  it("highlight hadamard and stoppers", () => {
    const connections: Connection[] = [
      makeConn("lego1", 0, "lego2", 3),
      makeConn("lego2", 0, "lego3", 1),
      makeConn("lego3", 0, "lego4", 0)
    ];
    const tensorNetwork: TensorNetwork = new TensorNetwork({
      legos: [
        makeLego({
          id: "lego1",
          name: "x stopper",
          parityMatrix: [[1, 0]],
          selectedRows: []
        }),
        makeLego({
          id: "lego2",
          name: "tensor 512",
          parityMatrix: [
            [1, 1, 1, 1, 0, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 1, 1, 1, 1, 0],
            [1, 1, 0, 0, 1, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0, 1, 1, 0, 1]
          ],
          selectedRows: [0]
        }),
        makeLego({
          id: "lego3",
          name: "hadmard",
          parityMatrix: [
            [1, 0, 0, 1],
            [0, 1, 1, 0]
          ],
          selectedRows: []
        }),
        makeLego({
          id: "lego4",
          name: "z stopper",
          parityMatrix: [[0, 1]],
          selectedRows: []
        })
      ],
      connections: connections
    });

    const { updatedLegos } = testSimpleAutoFlow(
      tensorNetwork.legos[1],
      tensorNetwork
    );

    const updatedX = updatedLegos.find(
      (lego: DroppedLego) => lego.instanceId === "lego1"
    );
    expect(updatedX!.selectedMatrixRows).toHaveLength(1);

    const updatedT5 = updatedLegos.find(
      (lego: DroppedLego) => lego.instanceId === "lego2"
    );
    expect(updatedT5!.selectedMatrixRows).toEqual(expect.arrayContaining([0]));
    expect(updatedT5!.selectedMatrixRows).toHaveLength(1);

    const updatedH = updatedLegos.find(
      (lego: DroppedLego) => lego.instanceId === "lego3"
    );
    expect(updatedH!.selectedMatrixRows).toEqual(expect.arrayContaining([1]));
    expect(updatedH!.selectedMatrixRows).toHaveLength(1);

    const updatedZ = updatedLegos.find(
      (lego: DroppedLego) => lego.instanceId === "lego4"
    );
    expect(updatedZ!.selectedMatrixRows).toHaveLength(1);
  });

  it("change highlights on hadamard and stoppers", () => {
    const connections: Connection[] = [
      makeConn("lego1", 0, "lego2", 3),
      makeConn("lego2", 0, "lego3", 1),
      makeConn("lego3", 0, "lego4", 0)
    ];
    const tensorNetwork: TensorNetwork = new TensorNetwork({
      legos: [
        makeLego({
          id: "lego1",
          name: "x stopper",
          parityMatrix: [[1, 0]],
          selectedRows: [0]
        }),
        makeLego({
          id: "lego2",
          name: "tensor 512",
          parityMatrix: [
            [1, 1, 1, 1, 0, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 1, 1, 1, 1, 0],
            [1, 1, 0, 0, 1, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0, 1, 1, 0, 1]
          ],
          selectedRows: [1]
        }),
        makeLego({
          id: "lego3",
          name: "hadmard",
          parityMatrix: [
            [1, 0, 0, 1],
            [0, 1, 1, 0]
          ],
          selectedRows: [1]
        }),
        makeLego({
          id: "lego4",
          name: "z stopper",
          parityMatrix: [[0, 1]],
          selectedRows: [0]
        })
      ],
      connections: connections
    });

    const { updatedLegos } = testSimpleAutoFlow(
      tensorNetwork.legos[1],
      tensorNetwork
    );

    const updatedX = updatedLegos.find(
      (lego: DroppedLego) => lego.instanceId === "lego1"
    );
    expect(updatedX!.selectedMatrixRows).toHaveLength(0);

    const updatedT5 = updatedLegos.find(
      (lego: DroppedLego) => lego.instanceId === "lego2"
    );
    expect(updatedT5!.selectedMatrixRows).toEqual(expect.arrayContaining([1]));
    expect(updatedT5!.selectedMatrixRows).toHaveLength(1);

    const updatedH = updatedLegos.find(
      (lego: DroppedLego) => lego.instanceId === "lego3"
    );
    expect(updatedH!.selectedMatrixRows).toEqual(expect.arrayContaining([0]));
    expect(updatedH!.selectedMatrixRows).toHaveLength(1);

    const updatedZ = updatedLegos.find(
      (lego: DroppedLego) => lego.instanceId === "lego4"
    );
    expect(updatedZ!.selectedMatrixRows).toHaveLength(0);
  });

  it("do not highlight complex legos", () => {
    const connections: Connection[] = [
      makeConn("lego1", 0, "lego2", 3),
      makeConn("lego2", 2, "lego3", 0),
      makeConn("lego2", 1, "lego4", 7),
      makeConn("lego2", 2, "lego5", 0)
    ];
    const tensorNetwork: TensorNetwork = new TensorNetwork({
      legos: [
        makeLego({
          id: "lego1",
          name: "x stopper",
          parityMatrix: [[1, 0]],
          selectedRows: []
        }),
        makeLego({
          id: "lego2",
          name: "tensor 512",
          parityMatrix: [
            [1, 1, 1, 1, 0, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 1, 1, 1, 1, 0],
            [1, 1, 0, 0, 1, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0, 1, 1, 0, 1]
          ],
          selectedRows: [1]
        }),
        makeLego({
          id: "lego3",
          name: "tensor 40",
          parityMatrix: [
            [1, 1, 1, 1, 0, 0, 0, 0],
            [0, 0, 0, 0, 1, 1, 1, 1],
            [1, 1, 0, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0, 1, 1]
          ],
          selectedRows: []
        }),
        makeLego({
          id: "lego4",
          name: "steane",
          parityMatrix: [
            [0, 0, 0, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0],
            [0, 1, 1, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0],
            [1, 0, 1, 0, 1, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 0],
            [0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 1, 1, 0],
            [0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 1, 0, 1, 0, 1, 0],
            [1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1, 1, 1]
          ],
          selectedRows: []
        }),
        makeLego({
          id: "lego5",
          name: "tensor 512",
          parityMatrix: [
            [1, 1, 1, 1, 0, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 1, 1, 1, 1, 0],
            [1, 1, 0, 0, 1, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0, 1, 1, 0, 1]
          ],
          selectedRows: []
        })
      ],
      connections: connections
    });

    const { updatedLegos } = testSimpleAutoFlow(
      tensorNetwork.legos[1],
      tensorNetwork
    );

    const updatedX = updatedLegos.find(
      (lego: DroppedLego) => lego.instanceId === "lego1"
    );
    expect(updatedX!.selectedMatrixRows).toHaveLength(0);

    const updatedT5 = updatedLegos.find(
      (lego: DroppedLego) => lego.instanceId === "lego2"
    );
    expect(updatedT5!.selectedMatrixRows).toEqual(expect.arrayContaining([1]));
    expect(updatedT5!.selectedMatrixRows).toHaveLength(1);

    const updatedH = updatedLegos.find(
      (lego: DroppedLego) => lego.instanceId === "lego3"
    );
    expect(updatedH!.selectedMatrixRows).toHaveLength(0);

    const updatedZ = updatedLegos.find(
      (lego: DroppedLego) => lego.instanceId === "lego4"
    );
    expect(updatedZ!.selectedMatrixRows).toHaveLength(0);

    const updatedT52 = updatedLegos.find(
      (lego: DroppedLego) => lego.instanceId === "lego5"
    );
    expect(updatedT52!.selectedMatrixRows).toHaveLength(0);
  });

  it("highlight updates shared lego", () => {
    const connections: Connection[] = [
      makeConn("lego1", 0, "lego3", 1),
      makeConn("lego2", 2, "lego3", 0)
    ];
    const tensorNetwork: TensorNetwork = new TensorNetwork({
      legos: [
        makeLego({
          id: "lego1",
          name: "tensor 512",
          parityMatrix: [
            [1, 1, 1, 1, 0, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 1, 1, 1, 1, 0],
            [1, 1, 0, 0, 1, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0, 1, 1, 0, 1]
          ],
          selectedRows: [1]
        }),
        makeLego({
          id: "lego2",
          name: "tensor 512",
          parityMatrix: [
            [1, 1, 1, 1, 0, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 1, 1, 1, 1, 0],
            [1, 1, 0, 0, 1, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0, 1, 1, 0, 1]
          ],
          selectedRows: [1]
        }),
        makeLego({
          id: "lego3",
          name: "hadmard",
          parityMatrix: [
            [1, 0, 0, 1],
            [0, 1, 1, 0]
          ],
          selectedRows: [0]
        })
      ],
      connections: connections
    });

    const { updatedLegos } = testSimpleAutoFlow(
      tensorNetwork.legos[1],
      tensorNetwork
    );

    const updatedT51 = updatedLegos.find(
      (lego: DroppedLego) => lego.instanceId === "lego1"
    );
    expect(updatedT51!.selectedMatrixRows).toEqual(expect.arrayContaining([1]));
    expect(updatedT51!.selectedMatrixRows).toHaveLength(1);

    const updatedT52 = updatedLegos.find(
      (lego: DroppedLego) => lego.instanceId === "lego2"
    );
    expect(updatedT52!.selectedMatrixRows).toEqual(expect.arrayContaining([1]));
    expect(updatedT52!.selectedMatrixRows).toHaveLength(1);

    const updatedH = updatedLegos.find(
      (lego: DroppedLego) => lego.instanceId === "lego3"
    );
    expect(updatedH!.selectedMatrixRows).toEqual(expect.arrayContaining([1]));
    expect(updatedH!.selectedMatrixRows).toHaveLength(1);
  });

  it("do not remove highlight on shared lego", () => {
    const connections: Connection[] = [
      makeConn("lego1", 0, "lego3", 1),
      makeConn("lego2", 2, "lego3", 0)
    ];
    const tensorNetwork: TensorNetwork = new TensorNetwork({
      legos: [
        makeLego({
          id: "lego1",
          name: "tensor 512",
          parityMatrix: [
            [1, 1, 1, 1, 0, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 1, 1, 1, 1, 0],
            [1, 1, 0, 0, 1, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0, 1, 1, 0, 1]
          ],
          selectedRows: [1]
        }),
        makeLego({
          id: "lego2",
          name: "tensor 512",
          parityMatrix: [
            [1, 1, 1, 1, 0, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 1, 1, 1, 1, 0],
            [1, 1, 0, 0, 1, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0, 1, 1, 0, 1]
          ],
          selectedRows: [2]
        }),
        makeLego({
          id: "lego3",
          name: "hadmard",
          parityMatrix: [
            [1, 0, 0, 1],
            [0, 1, 1, 0]
          ],
          selectedRows: [1]
        })
      ],
      connections: connections
    });

    const { updatedLegos } = testSimpleAutoFlow(
      tensorNetwork.legos[1],
      tensorNetwork
    );

    const updatedT51 = updatedLegos.find(
      (lego: DroppedLego) => lego.instanceId === "lego1"
    );
    expect(updatedT51!.selectedMatrixRows).toEqual(expect.arrayContaining([1]));
    expect(updatedT51!.selectedMatrixRows).toHaveLength(1);

    const updatedT52 = updatedLegos.find(
      (lego: DroppedLego) => lego.instanceId === "lego2"
    );
    expect(updatedT52!.selectedMatrixRows).toEqual(expect.arrayContaining([2]));
    expect(updatedT52!.selectedMatrixRows).toHaveLength(1);

    const updatedH = updatedLegos.find(
      (lego: DroppedLego) => lego.instanceId === "lego3"
    );
    expect(updatedH!.selectedMatrixRows).toEqual(expect.arrayContaining([0]));
    expect(updatedH!.selectedMatrixRows).toHaveLength(1);
  });

  it("highlight multiple rows in simple lego", () => {
    const connections: Connection[] = [
      makeConn("lego1", 3, "lego3", 0),
      makeConn("lego1", 0, "lego2", 0),
      makeConn("lego2", 1, "lego3", 1)
    ];
    const tensorNetwork: TensorNetwork = new TensorNetwork({
      legos: [
        makeLego({
          id: "lego1",
          name: "tensor 512",
          parityMatrix: [
            [1, 1, 1, 1, 0, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 1, 1, 1, 1, 0],
            [1, 1, 0, 0, 1, 0, 0, 0, 0, 0],
            [0, 0, 0, 0, 0, 0, 1, 1, 0, 1]
          ],
          selectedRows: [0, 1]
        }),
        makeLego({
          id: "lego2",
          name: "hadmard",
          parityMatrix: [
            [1, 0, 0, 1],
            [0, 1, 1, 0]
          ],
          selectedRows: []
        }),
        makeLego({
          id: "lego3",
          name: "hadmard",
          parityMatrix: [
            [1, 0, 0, 1],
            [0, 1, 1, 0]
          ],
          selectedRows: []
        })
      ],
      connections: connections
    });

    const { updatedLegos } = testSimpleAutoFlow(
      tensorNetwork.legos[0],
      tensorNetwork
    );

    const updatedT5 = updatedLegos.find(
      (lego: DroppedLego) => lego.instanceId === "lego1"
    );
    expect(updatedT5!.selectedMatrixRows).toEqual(
      expect.arrayContaining([0, 1])
    );
    expect(updatedT5!.selectedMatrixRows).toHaveLength(2);

    const updatedH1 = updatedLegos.find(
      (lego: DroppedLego) => lego.instanceId === "lego2"
    );
    expect(updatedH1!.selectedMatrixRows).toEqual(
      expect.arrayContaining([0, 1])
    );
    expect(updatedH1!.selectedMatrixRows).toHaveLength(2);

    const updatedH2 = updatedLegos.find(
      (lego: DroppedLego) => lego.instanceId === "lego3"
    );
    expect(updatedH2!.selectedMatrixRows).toEqual(
      expect.arrayContaining([0, 1])
    );
    expect(updatedH2!.selectedMatrixRows).toHaveLength(2);
  });
});
