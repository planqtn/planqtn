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

                    const neighbor_leg_index = 
                        neighborConn.from.legoId == neighborLego.instanceId 
                            ? neighborConn.from.legIndex 
                            : neighborConn.to.legIndex;

                    const lego_leg_index = 
                        neighborConn.from.legoId == lego.instanceId 
                            ? neighborConn.from.legIndex 
                            : neighborConn.to.legIndex;

                    const neighborLegHighlightOp = getHighlightOp(neighborLego, neighbor_leg_index);

                    // Skip if there is more than one option to choose from 
                    const {x_type_row_indices, z_type_row_indices} = findRowIndices(lego, lego_leg_index);
                    if (x_type_row_indices.length > 1 && z_type_row_indices.length > 1) {
                        continue;
                    }

                    let newRows: number[] | null = null;

                    if (neighborLegHighlightOp[0] === 1 && neighborLegHighlightOp[1] === 0) {
                        console.log("neighborLegHighlightOp[0] === 1 && neighborLegHighlightOp[1] === 0", "n_x_type_row_indices", x_type_row_indices);
                        if (x_type_row_indices.length != 1) {
                            continue;
                        }
                        newRows = [x_type_row_indices[0]];
                    }

                    if (neighborLegHighlightOp[0] === 0 && neighborLegHighlightOp[1] === 1) {
                        console.log("neighborLegHighlightOp[0] === 0 && neighborLegHighlightOp[1] === 1", "n_z_type_row_indices", z_type_row_indices);
                        if (z_type_row_indices.length != 1) {
                            continue;
                        }
                        newRows = [z_type_row_indices[0]];
                    }

                    if (neighborLegHighlightOp[0] === 1 && neighborLegHighlightOp[1] === 1) {
                        console.log("neighborLegHighlightOp[0] === 1 && neighborLegHighlightOp[1] === 1", "n_x_type_row_indices", x_type_row_indices, "n_z_type_row_indices", z_type_row_indices);
                        if (x_type_row_indices.length != 1 || z_type_row_indices.length != 1) {
                            continue;
                        }
                        newRows = z_type_row_indices[0] != x_type_row_indices[0] ? [x_type_row_indices[0], z_type_row_indices[0]] : [x_type_row_indices[0]]
                    }

                    if(newRows !== null) {
                        changed = true;
                        updateLego(lego, newRows);
                    }
                }
            }
        }
    }

    // Helper function to calculate the highlight operation for a given lego and leg number
    const getHighlightOp = (lego: DroppedLego, legIndex: number) => {
        const num_legs = lego.parity_check_matrix[0].length / 2
        const combinedRow = new Array(lego.parity_check_matrix[0].length).fill(0);

        for (const rowIndex of lego.selectedMatrixRows) {
            lego.parity_check_matrix[rowIndex].forEach((val, idx) => {
                combinedRow[idx] = (combinedRow[idx] + val) % 2;
            });
        }
        const xPart = combinedRow[legIndex];
        const zPart = combinedRow[legIndex + num_legs];
        return [xPart, zPart]
    }

    // Find X-type and Z-type row indices for a given leg
    const findRowIndices = (
        lego: DroppedLego,
        legIndex: number
    ): { x_type_row_indices: number[]; z_type_row_indices: number[] } => {
        const nLegoLegs = lego.parity_check_matrix[0].length / 2;
        const x_type_row_indices: number[] = [];
        const z_type_row_indices: number[] = [];
    
        lego.parity_check_matrix.forEach((row, idx) => {
            if (row[legIndex] === 1) x_type_row_indices.push(idx);
            if (row[legIndex + nLegoLegs] === 1) z_type_row_indices.push(idx);
        });
    
        return { x_type_row_indices, z_type_row_indices };
    };