import { cloneDeep } from 'lodash';
import { DroppedLego, Connection, TensorNetwork } from '../types';


/**
 * Automatically highlights (selects rows of) legos in the network when there is only one possible option.
 * @param tensorNetwork 
 * @param connections 
 * @param setDroppedLegos 
 * @param setTensorNetwork 
 */
export function simpleAutoFlow(tensorNetwork: TensorNetwork | null,
    connections: Connection[],
    setDroppedLegos: (updateFn: (prev: DroppedLego[]) => DroppedLego[]) => void,
    setTensorNetwork: (updateFn: (prev: TensorNetwork | null) => TensorNetwork | null) => void
): void {
    if (!tensorNetwork) {
        return;
    }   

    let changed = true;
    let tnLegos = cloneDeep(tensorNetwork.legos);

    while(changed) {
        changed = false;

        for (const lego of tnLegos) {
            // Skip legos with existing highlights 
            if (lego.selectedMatrixRows.length > 0) {
                continue;
            }

            const neighborConns = connections.filter(conn => conn.from.legoId === lego.instanceId || conn.to.legoId === lego.instanceId);
            if (neighborConns.length === 0) {
                continue;
            }

            // Helper function for updating the lego in the tensor network
            const updateLego = (lego: DroppedLego, selectedMatrixRows: number[]) => {
                const updatedLego = { ...lego, selectedMatrixRows: selectedMatrixRows };
                tnLegos = tnLegos.map(l =>
                    l.instanceId === lego.instanceId ? updatedLego : l
                );
                console.log("Updating lego", updatedLego, "to selectedMatrixRows", selectedMatrixRows);
                
                setDroppedLegos(prev => prev.map(l => l.instanceId === lego.instanceId ? updatedLego : l));
                setTensorNetwork(prev => {
                    if (!prev) {
                        return null;
                    }
                    const newLegos = prev.legos.map(l => l.instanceId === lego.instanceId ? updatedLego : l);
                    return { ...prev, legos: newLegos };
                });
            }

            for (const neighborConn of neighborConns) {
                const neighborLego = tnLegos.find(l => 
                    (l.instanceId === neighborConn.from.legoId || l.instanceId === neighborConn.to.legoId)
                                                                        && l.instanceId != lego.instanceId); 
                if (!neighborLego) {
                    continue;
                }
                // Skip if the neighbor lego has no selected rows
                if (neighborLego.selectedMatrixRows.length === 0) {
                    continue;
                }

                const neighborLegIndex = 
                    neighborConn.from.legoId == neighborLego.instanceId 
                        ? neighborConn.from.legIndex 
                        : neighborConn.to.legIndex;

                const legoLegIndex = 
                    neighborConn.from.legoId == lego.instanceId 
                        ? neighborConn.from.legIndex 
                        : neighborConn.to.legIndex;

                const neighborLegHighlightOp = getHighlightOp(neighborLego, neighborLegIndex);

                // Skip if there is more than one option to choose from 
                const {xRowIndices, zRowIndices} = findRowIndices(lego, legoLegIndex);
                if (xRowIndices.length > 1 && zRowIndices.length > 1) {
                    continue;
                }

                let newRows: number[] | null = null;
                console.log("neighborLegHighlightOp: ", neighborLegHighlightOp, ", xRowIndices: ", xRowIndices, ", zRowIndices: ", zRowIndices);
                
                if (neighborLegHighlightOp[0] === 1 && neighborLegHighlightOp[1] === 0 && xRowIndices.length === 1) {
                    newRows = [xRowIndices[0]];
                }
                else if (neighborLegHighlightOp[0] === 0 && neighborLegHighlightOp[1] === 1 && zRowIndices.length === 1) {
                    newRows = [zRowIndices[0]];
                }
                else if (neighborLegHighlightOp[0] === 1 && neighborLegHighlightOp[1] === 1 
                    && xRowIndices.length === 1 && zRowIndices.length === 1) {
                    newRows = zRowIndices[0] != xRowIndices[0] ? [xRowIndices[0], zRowIndices[0]] : [xRowIndices[0]]
                }

                if(newRows !== null) {
                    changed = true;
                    updateLego(lego, newRows);
                }
            }
        }
    }
}

/**
 * Helper method to find the current highlight operation of the given lego and leg index.
 * @param lego 
 * @param legIndex 
 * @returns X and Z parts of the highlight operation
 */
const getHighlightOp = (lego: DroppedLego, legIndex: number) => {
    const numLegs = lego.parity_check_matrix[0].length / 2
    const combinedRow = new Array(lego.parity_check_matrix[0].length).fill(0);

    for (const rowIndex of lego.selectedMatrixRows) {
        lego.parity_check_matrix[rowIndex].forEach((val, idx) => {
            combinedRow[idx] = (combinedRow[idx] + val) % 2;
        });
    }
    const xPart = combinedRow[legIndex];
    const zPart = combinedRow[legIndex + numLegs];
    return [xPart, zPart]
}

/**
 * Helper method to find the X and Z rows in the parity check matrix that correspond to the given leg index.
 * @param lego 
 * @param legIndex 
 * @returns List of X and Z row indices
 */
const findRowIndices = (
    lego: DroppedLego,
    legIndex: number
): { xRowIndices: number[]; zRowIndices: number[] } => {
    const nLegoLegs = lego.parity_check_matrix[0].length / 2;
    const xRowIndices: number[] = [];
    const zRowIndices: number[] = [];

    lego.parity_check_matrix.forEach((row, idx) => {
        if (row[legIndex] === 1) xRowIndices.push(idx);
        if (row[legIndex + nLegoLegs] === 1) zRowIndices.push(idx);
    });

    return { xRowIndices, zRowIndices };
};