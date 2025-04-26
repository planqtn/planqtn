import { DroppedLego, Connection, Operation } from '../types';
import { getLegoStyle } from '../LegoStyles';
import { zip } from 'lodash';

export const canDoConnectGraphNodes = (legos: DroppedLego[]): boolean => {
    return legos.length > 0 && legos.every(lego => lego.id === 'z_rep_code');
};


async function getDynamicLego(legoId: string, numLegs: number): Promise<DroppedLego> {
    const response = await fetch('/api/dynamiclego', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            lego_id: legoId,
            parameters: {
                d: numLegs
            }
        })
    });

    if (!response.ok) {
        throw new Error(`Failed to get dynamic lego: ${response.statusText}`);
    }

    const data = await response.json();
    return {
        ...data,
        instanceId: String("not set"),
        style: getLegoStyle(data.id, numLegs),
        x: 0,
        y: 0
    };
}

export const applyConnectGraphNodes = async (
    legos: DroppedLego[],
    allLegos: DroppedLego[],
    connections: Connection[]
): Promise<{
    droppedLegos: DroppedLego[];
    connections: Connection[];
    operation: Operation;
}> => {
    // Get max instance ID
    const maxInstanceId = Math.max(...allLegos.map(l => parseInt(l.instanceId)));
    const numLegs = legos.length + 1;

    // Create the connector lego
    const connectorLegoData = await getDynamicLego('z_rep_code', numLegs);
    const connectorLego: DroppedLego = {
        ...connectorLegoData,
        instanceId: (maxInstanceId + 1).toString(),
        x: legos.reduce((sum, l) => sum + l.x, 0) / legos.length,
        y: legos.reduce((sum, l) => sum + l.y, 0) / legos.length
    };

    // Find dangling legs for each lego
    const legoDanglingLegs = legos.map(lego => {
        const numLegs = lego.parity_check_matrix[0].length / 2;
        const connectedLegs = new Set<number>();

        // Find all connected legs
        connections.forEach(conn => {
            if (conn.from.legoId === lego.instanceId) {
                connectedLegs.add(conn.from.legIndex);
            }
            if (conn.to.legoId === lego.instanceId) {
                connectedLegs.add(conn.to.legIndex);
            }
        });

        // Find first dangling leg (a leg that is NOT in connectedLegs)
        let danglingLeg = 0;
        while (connectedLegs.has(danglingLeg) && danglingLeg < numLegs) {
            danglingLeg++;
        }

        return {
            lego,
            danglingLeg: danglingLeg < numLegs ? danglingLeg : numLegs
        };
    });

    // Create new legos with one extra leg
    const newLegos: DroppedLego[] = await Promise.all(legoDanglingLegs.map(async ({ lego, danglingLeg }) => {
        if (danglingLeg !== lego.parity_check_matrix[0].length / 2) {
            return lego; // Keep the lego as is if it has dangling legs
        }
        const newLego = await getDynamicLego('z_rep_code', lego.parity_check_matrix[0].length / 2 + 1);
        return { ...lego, id: newLego.id, parity_check_matrix: newLego.parity_check_matrix, style: newLego.style };
    }));

    // Create Hadamard legos
    const hadamardLegos: DroppedLego[] = legoDanglingLegs.map(({ lego }, index) => {
        // Position Hadamard halfway between connector and original lego
        return {
            id: 'h',
            name: 'Hadamard',
            shortName: 'H',
            description: 'Hadamard',
            instanceId: (maxInstanceId + 2 + index).toString(),
            x: (connectorLego.x + lego.x) / 2,
            y: (connectorLego.y + lego.y) / 2,
            parity_check_matrix: [[1, 0, 0, 1], [0, 1, 1, 0]],
            logical_legs: [],
            gauge_legs: [],
            style: getLegoStyle('h', 2),
            selectedMatrixRows: []
        };
    });

    // Create connections between connector, Hadamards, and new legos
    const newConnections: Connection[] = legoDanglingLegs.flatMap(({ lego, danglingLeg }, index) => {

        return [
            new Connection(
                { legoId: connectorLego.instanceId, legIndex: index },
                { legoId: hadamardLegos[index].instanceId, legIndex: 0 }
            ),
            new Connection(
                { legoId: hadamardLegos[index].instanceId, legIndex: 1 },
                { legoId: lego.instanceId, legIndex: danglingLeg }
            )
        ];
    });

    // Update state
    const updatedLegos = [
        ...allLegos.filter(l => !legos.some(selected => selected.instanceId === l.instanceId)),
        ...newLegos,
        connectorLego,
        ...hadamardLegos
    ];

    const updatedConnections = [
        ...connections,
        ...newConnections
    ];

    // Create operation for undo/redo
    const operation: Operation = {
        type: 'connectGraphNodesWithCenterLego',
        data: {
            legosToUpdate: (zip(legos, newLegos) as [DroppedLego, DroppedLego][]).map(([lego, newLego]) => ({ oldLego: lego, newLego: newLego })),
            legosToAdd: [connectorLego, ...hadamardLegos],
            connectionsToAdd: newConnections
        }
    };

    return {
        droppedLegos: updatedLegos,
        connections: updatedConnections,
        operation
    };
}; 