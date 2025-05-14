import { simpleAutoFlow } from './AutoPauliFlow';
//import { Connection, DroppedLego, TensorNetwork } from '../types';
//import { GenericStyle } from '../LegoStyles';


describe('simple auto flow', () => {
    let mockSetDroppedLegos: jest.Mock;
    let mockSetTensorNetwork: jest.Mock;

    beforeEach(() => {
        mockSetDroppedLegos = jest.fn();
        mockSetTensorNetwork = jest.fn();
    });
    /*
    const makeLego = ({
        id,
        name,
        parityMatrix,
        selectedRows = [] as number[],
        x = 0,
        y = 0,
      }: {
        id: string;
        name: string;
        parityMatrix: number[][];
        selectedRows?: number[];
        x?: number;
        y?: number;
      }): DroppedLego => ({
        id,
        name: name,
        shortName: name,
        description: name,
        parity_check_matrix: parityMatrix,
        logical_legs: [],
        gauge_legs: [],
        x,
        y,
        instanceId : id,
        style: new GenericStyle(id),
        selectedMatrixRows: selectedRows,
      });
    
    const makeConn = (
        fromId: string,
        fromIdx: number,
        toId: string,
        toIdx: number
    ) => new Connection({ legoId: fromId, legIndex: fromIdx }, { legoId: toId, legIndex: toIdx });
    */
    it('do nothing if tensor network is null', () => {
        simpleAutoFlow(null, null, [], mockSetDroppedLegos, mockSetTensorNetwork);

        expect(mockSetDroppedLegos).not.toHaveBeenCalled();
        expect(mockSetTensorNetwork).not.toHaveBeenCalled();
    });
    /*
    it('do nothing if everything is highlighted', () => {
        const connections: Connection[] = [makeConn('lego1', 0, 'lego2', 3)];
        const tensorNetwork: TensorNetwork = {
            legos: [
                makeLego({id: 'lego1', name: 'x stopper', parityMatrix: [[1, 0]], selectedRows: [0]}),
                makeLego({id: 'lego2', name: 'tensor 512', parityMatrix: [
                        [1, 1, 1, 1, 0, 0, 0, 0, 0, 0],
                        [0, 0, 0, 0, 0, 1, 1, 1, 1, 0], 
                        [1, 1, 0, 0, 1, 0, 0, 0, 0, 0],
                        [0, 0, 0, 0, 0, 0, 1, 1, 0, 1]
                    ], selectedRows: [1]})],
            connections: connections,
        };

        simpleAutoFlow(tensorNetwork, connections, mockSetDroppedLegos, mockSetTensorNetwork);

        expect(mockSetDroppedLegos).not.toHaveBeenCalled();
        expect(mockSetTensorNetwork).not.toHaveBeenCalled();
    });

    it('do nothing if no highlights', () => {
        const connections: Connection[] = [makeConn('lego1', 0, 'lego2', 3)];
        const tensorNetwork: TensorNetwork = {
            legos: [ 
                makeLego({id: 'lego1', name: 'x stopper', parityMatrix: [[1, 0]], selectedRows: []}),
                makeLego({id: 'lego2', name: 'tensor 512', parityMatrix: [
                        [1, 1, 1, 1, 0, 0, 0, 0, 0, 0],
                        [0, 0, 0, 0, 0, 1, 1, 1, 1, 0], 
                        [1, 1, 0, 0, 1, 0, 0, 0, 0, 0],
                        [0, 0, 0, 0, 0, 0, 1, 1, 0, 1]
                    ], selectedRows: []})],
            connections: connections,
        };

        simpleAutoFlow(tensorNetwork, connections, mockSetDroppedLegos, mockSetTensorNetwork);

        expect(mockSetDroppedLegos).not.toHaveBeenCalled();
        expect(mockSetTensorNetwork).not.toHaveBeenCalled();
    });

    it('do not highlight if >1 option', () => {
        const connections: Connection[] = [makeConn('lego1', 0, 'lego2', 1)];
        
        const tensorNetwork: TensorNetwork = {
            legos: [makeLego({id: 'lego1', name: 'x stopper', parityMatrix: [[1, 0]], selectedRows: [0]}),
                makeLego({id: 'lego2', name: 'tensor 512', parityMatrix: [
                    [1, 1, 1, 1, 0, 0, 0, 0, 0, 0],
                    [0, 0, 0, 0, 0, 1, 1, 1, 1, 0], 
                    [1, 1, 0, 0, 1, 0, 0, 0, 0, 0],
                    [0, 0, 0, 0, 0, 0, 1, 1, 0, 1]
                ], selectedRows: []})],
            connections: connections,
        };

        simpleAutoFlow(tensorNetwork, connections, mockSetDroppedLegos, mockSetTensorNetwork);

        expect(mockSetDroppedLegos).not.toHaveBeenCalled();
        expect(mockSetTensorNetwork).not.toHaveBeenCalled();
    });

    it('highlights single neighbor option', () => {
        const connections: Connection[] = [makeConn('lego1', 0, 'lego2', 3)];
        const tensorNetwork: TensorNetwork = {
            legos: [
                makeLego({id: 'lego1', name: 'x stopper', parityMatrix: [[1, 0]], selectedRows: [0]}),
                makeLego({id: 'lego2', name: 'tensor 512', parityMatrix: [
                    [1, 1, 1, 1, 0, 0, 0, 0, 0, 0],
                    [0, 0, 0, 0, 0, 1, 1, 1, 1, 0], 
                    [1, 1, 0, 0, 1, 0, 0, 0, 0, 0],
                    [0, 0, 0, 0, 0, 0, 1, 1, 0, 1]
                ], selectedRows: []})],
            connections: connections,
        };

        simpleAutoFlow(tensorNetwork, connections, mockSetDroppedLegos, mockSetTensorNetwork);

        expect(mockSetDroppedLegos).toHaveBeenCalled();
        expect(mockSetTensorNetwork).toHaveBeenCalled();

        const updatedLegos = mockSetDroppedLegos.mock.calls[0][0](tensorNetwork.legos);
        const updatedLego2 = updatedLegos.find((lego: any) => lego.instanceId === 'lego2');
        expect(updatedLego2.selectedMatrixRows).toEqual([0]);
    });

    it('highlights multiple rows in a lego', () => {
        const connections: Connection[] = [
            makeConn('lego1', 0, 'lego3', 0),
            makeConn('lego2', 0, 'lego3', 2),
            makeConn('lego3', 1, 'lego4', 1),
            makeConn('lego4', 0, 'lego5', 4)
        ];

        const tensorNetwork: TensorNetwork = {
            legos: [makeLego({id: 'lego1', name: 'x stopper', parityMatrix: [[1, 0]], selectedRows: []}),
                makeLego({id: 'lego2', name: 'z stopper', parityMatrix: [[0,1]], selectedRows: []}),
                makeLego({id: 'lego3', name: 'tensor 512', parityMatrix: [
                        [1, 1, 1, 1, 0, 0, 0, 0, 0, 0],
                        [0, 0, 0, 0, 0, 1, 1, 1, 1, 0], 
                        [1, 1, 0, 0, 1, 0, 0, 0, 0, 0],
                        [0, 0, 0, 0, 0, 0, 1, 1, 0, 1]
                    ], selectedRows: [2, 3]}),
                makeLego({id: 'lego4', name: 'hadamard', parityMatrix: [
                        [1, 0, 0, 1],
                        [0, 1, 1, 0]
                    ], selectedRows: []}),
                makeLego({id: 'lego5', name: 'tensor 512', parityMatrix: [
                    [1, 1, 1, 1, 0, 0, 0, 0, 0, 0],
                    [0, 0, 0, 0, 0, 1, 1, 1, 1, 0], 
                    [1, 1, 0, 0, 1, 0, 0, 0, 0, 0],
                    [0, 0, 0, 0, 0, 0, 1, 1, 0, 1]
                ], selectedRows: []})
            ],
            connections: connections,
        };

        simpleAutoFlow(tensorNetwork, connections, mockSetDroppedLegos, mockSetTensorNetwork);

        expect(mockSetDroppedLegos).toHaveBeenCalledTimes(4);
        expect(mockSetTensorNetwork).toHaveBeenCalledTimes(4);

        const updatedLegos = mockSetDroppedLegos.mock.calls
            .map(call => call[0])
            .reduce((state, updater) => updater(state), tensorNetwork.legos);

        const updatedHadamard = updatedLegos.find((lego: any) => lego.instanceId === 'lego4');
        expect(updatedHadamard.selectedMatrixRows).toEqual(expect.arrayContaining([0, 1]));
        expect(updatedHadamard.selectedMatrixRows).toHaveLength(2);

        const updatedT5 = updatedLegos.find((lego: any) => lego.instanceId === 'lego5');
        expect(updatedT5.selectedMatrixRows).toEqual(expect.arrayContaining([2,3]));
        expect(updatedT5.selectedMatrixRows).toHaveLength(2);
    });

    
    it('highlight all tensors in chain', () => {
        const connections: Connection[] = [
            makeConn('lego1', 0, 'lego3', 0),
            makeConn('lego3', 1, 'lego2', 0),
            makeConn('lego2', 2, 'lego4', 0)
        ];
        
        const tensorNetwork: TensorNetwork = {
            legos: [makeLego({id: 'lego1', name: 'x stopper', parityMatrix: [[1, 0]], selectedRows: [0]}),
                makeLego({id: 'lego2', name: 'tensor 512', parityMatrix: [
                        [1, 1, 1, 1, 0, 0, 0, 0, 0, 0],
                        [0, 0, 0, 0, 0, 1, 1, 1, 1, 0], 
                        [1, 1, 0, 0, 1, 0, 0, 0, 0, 0],
                        [0, 0, 0, 0, 0, 0, 1, 1, 0, 1]
                    ], selectedRows: []}),
                makeLego({id: 'lego3', name: 'hadamard', parityMatrix: [
                        [1, 0, 0, 1],
                        [0, 1, 1, 0]
                    ], selectedRows: []}),
                makeLego({id: 'lego4', name: 'z stopper', parityMatrix: [[0,1]], selectedRows: []}),
            ],
            connections: connections,
        };

        simpleAutoFlow(tensorNetwork, connections, mockSetDroppedLegos, mockSetTensorNetwork);

        expect(mockSetDroppedLegos).toHaveBeenCalledTimes(3);
        expect(mockSetTensorNetwork).toHaveBeenCalledTimes(3);
    });

    it('highlight all but last', () => {
        const connections: Connection[] = [
            makeConn('lego1', 0, 'lego3', 0),
            makeConn('lego3', 1, 'lego2', 0),
            makeConn('lego2', 4, 'lego4', 0)
        ];
        
        const tensorNetwork: TensorNetwork = {
            legos: [makeLego({id: 'lego1', name: 'x stopper', parityMatrix: [[1, 0]], selectedRows: [0]}),
                makeLego({id: 'lego2', name: 'tensor 512', parityMatrix: [
                        [1, 1, 1, 1, 0, 0, 0, 0, 0, 0],
                        [0, 0, 0, 0, 0, 1, 1, 1, 1, 0], 
                        [1, 1, 0, 0, 1, 0, 0, 0, 0, 0],
                        [0, 0, 0, 0, 0, 0, 1, 1, 0, 1]
                    ], selectedRows: []}),
                makeLego({id: 'lego3', name: 'hadamard', parityMatrix: [
                        [1, 0, 0, 1],
                        [0, 1, 1, 0]
                    ], selectedRows: []}),
                makeLego({id: 'lego4', name: 'z stopper', parityMatrix: [[0,1]], selectedRows: []}),
            ],
            connections: connections,
        };

        simpleAutoFlow(tensorNetwork, connections, mockSetDroppedLegos, mockSetTensorNetwork);

        expect(mockSetDroppedLegos).toHaveBeenCalledTimes(2);
        expect(mockSetTensorNetwork).toHaveBeenCalledTimes(2);
    });
    */
});