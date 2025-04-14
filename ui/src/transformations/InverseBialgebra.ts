import { DroppedLego, Connection, Operation } from '../types';
import { Z_REP_CODE, X_REP_CODE, getLegoStyle } from '../LegoStyles';
import _ from 'lodash';

export function canDoInverseBialgebra(selectedLegos: DroppedLego[], connections: Connection[]): boolean {
    if (selectedLegos.length < 2) return false;

    // Partition legos by type
    const zLegos = selectedLegos.filter(lego => lego.id === Z_REP_CODE);
    const xLegos = selectedLegos.filter(lego => lego.id === X_REP_CODE);

    // Check if we have exactly two partitions
    if (zLegos.length === 0 || xLegos.length === 0 || zLegos.length + xLegos.length !== selectedLegos.length) {
        return false;
    }

    // Check if partitions are fully connected
    for (const zLego of zLegos) {
        for (const xLego of xLegos) {
            const hasConnection = connections.some(conn =>
                conn.containsLego(zLego.instanceId) && conn.containsLego(xLego.instanceId)
            );
            if (!hasConnection) return false;
        }
    }

    // Count external connections for each lego
    for (const lego of selectedLegos) {
        const externalConnections = connections.filter(conn =>
            conn.containsLego(lego.instanceId) &&
            !selectedLegos.some(otherLego =>
                otherLego.instanceId !== lego.instanceId &&
                conn.containsLego(otherLego.instanceId)
            )
        );
        if (externalConnections.length !== 1) return false;
    }

    return true;
}

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
        pushedLegs: [],
        style: getLegoStyle(data.id, numLegs),
        x: 0,
        y: 0
    };
}

export async function applyInverseBialgebra(selectedLegos: DroppedLego[], droppedLegos: DroppedLego[], connections: Connection[]): Promise<{
    connections: Connection[],
    droppedLegos: DroppedLego[],
    operation: Operation
}> {
    // Partition legos by type
    const zLegos = selectedLegos.filter(lego => lego.id === Z_REP_CODE);
    const xLegos = selectedLegos.filter(lego => lego.id === X_REP_CODE);

    // Get external connections for each partition
    const zExternalConns = connections.filter(conn =>
        zLegos.some(lego => conn.containsLego(lego.instanceId)) &&
        !selectedLegos.some(otherLego =>
            !zLegos.includes(otherLego) && conn.containsLego(otherLego.instanceId)
        )
    );

    const xExternalConns = connections.filter(conn =>
        xLegos.some(lego => conn.containsLego(lego.instanceId)) &&
        !selectedLegos.some(otherLego =>
            !xLegos.includes(otherLego) && conn.containsLego(otherLego.instanceId)
        )
    );

    // Calculate required legs for each new lego
    const zLegoLegs = zExternalConns.length + 1; // external connections + 1 for inter-lego connection
    const xLegoLegs = xExternalConns.length + 1;

    // Get the maximum instance ID from existing legos
    const maxInstanceId = Math.max(...droppedLegos.map(l => parseInt(l.instanceId)));

    // Create new legos (with opposite types)
    const newZLego = await getDynamicLego(X_REP_CODE, zLegoLegs);
    const newXLego = await getDynamicLego(Z_REP_CODE, xLegoLegs);

    // Set positions and IDs
    const avgZPos = {
        x: _.meanBy(zLegos, 'x'),
        y: _.meanBy(zLegos, 'y')
    };
    const avgXPos = {
        x: _.meanBy(xLegos, 'x'),
        y: _.meanBy(xLegos, 'y')
    };

    newZLego.instanceId = String(maxInstanceId + 1);
    newXLego.instanceId = String(maxInstanceId + 2);
    newZLego.x = avgZPos.x;
    newZLego.y = avgZPos.y;
    newXLego.x = avgXPos.x;
    newXLego.y = avgXPos.y;

    const newLegos = [newZLego, newXLego];
    const newConnections: Connection[] = [];

    // Create connection between new legos
    newConnections.push(new Connection(
        { legoId: newZLego.instanceId, legIndex: zLegoLegs - 1 },
        { legoId: newXLego.instanceId, legIndex: xLegoLegs - 1 }
    ));

    // Create external connections for Z partition
    zExternalConns.forEach((conn, index) => {
        // Find the external end that's not part of the Z partition
        const externalEnd = zLegos.some(lego => lego.instanceId === conn.from.legoId) ? conn.to : conn.from;
        newConnections.push(new Connection(
            { legoId: newZLego.instanceId, legIndex: index },
            externalEnd
        ));
    });

    // Create external connections for X partition
    xExternalConns.forEach((conn, index) => {
        // Find the external end that's not part of the X partition
        const externalEnd = xLegos.some(lego => lego.instanceId === conn.from.legoId) ? conn.to : conn.from;
        newConnections.push(new Connection(
            { legoId: newXLego.instanceId, legIndex: index },
            externalEnd
        ));
    });

    // Remove old legos and their connections
    const updatedDroppedLegos = droppedLegos
        .filter(lego => !selectedLegos.some(l => l.instanceId === lego.instanceId))
        .concat(newLegos);

    const updatedConnections = connections
        .filter(conn => !selectedLegos.some(lego => conn.containsLego(lego.instanceId)))
        .concat(newConnections);

    return {
        connections: updatedConnections,
        droppedLegos: updatedDroppedLegos,
        operation: {
            type: 'inverseBialgebra',
            data: {
                legosToRemove: selectedLegos,
                connectionsToRemove: connections.filter(conn =>
                    selectedLegos.some(lego => conn.containsLego(lego.instanceId))
                ),
                legosToAdd: newLegos,
                connectionsToAdd: newConnections
            }
        }
    };
} 