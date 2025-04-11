import { Connection, DroppedLego, Operation } from "../types";
import * as _ from 'lodash';

export class OperationHistory {


    redoHistory: Operation[] = [];
    constructor(private operations: Operation[]) { }

    public addOperation(operation: Operation) {
        this.operations.push(operation);
        console.log("addOperation", "operation", operation, "operations", this.operations);
        this.redoHistory = [];
    }


    public undo(connections: Connection[], droppedLegos: DroppedLego[]): { connections: Connection[], droppedLegos: DroppedLego[] } {
        if (this.operations.length === 0) return { connections, droppedLegos };

        const lastOperation = this.operations[this.operations.length - 1];

        // Move the operation to redo history before undoing
        this.redoHistory.push(lastOperation);
        this.operations = this.operations.slice(0, -1);

        let newConnections: Connection[] = _.cloneDeep(connections);
        let newDroppedLegos: DroppedLego[] = _.cloneDeep(droppedLegos);

        console.log("undo", "lastOperation", lastOperation, "newConnections", newConnections, "newDroppedLegos", newDroppedLegos);

        switch (lastOperation.type) {
            case 'add':
                const addedLegos = lastOperation.data?.legos;
                const addedConnections = lastOperation.data?.connections;
                if (addedLegos) {
                    // Remove all legos that were added in this operation
                    newDroppedLegos = newDroppedLegos.filter(lego =>
                        !addedLegos.some(l => l.instanceId === lego.instanceId)
                    );
                    // Remove all connections that were added with these legos
                    if (addedConnections) {
                        newConnections = connections.filter(conn =>
                            !addedConnections.some(c =>
                                c.from.legoId === conn.from.legoId &&
                                c.from.legIndex === conn.from.legIndex &&
                                c.to.legoId === conn.to.legoId &&
                                c.to.legIndex === conn.to.legIndex
                            )
                        );
                    }
                }
                break;
            case 'remove':
                if (lastOperation.data.legos && lastOperation.data.connections) {
                    newDroppedLegos = [...droppedLegos, ...(lastOperation.data.legos || [])];
                    newConnections = [...connections, ...(lastOperation.data.connections || [])];
                }
                break;
            case 'move':
                if (lastOperation.data.groupMoves) {
                    // Handle group move undo
                    newDroppedLegos = droppedLegos.map(lego => {
                        const move = lastOperation.data.groupMoves?.find(m => m.legoInstanceId === lego.instanceId);
                        if (move) {
                            return { ...lego, x: move.oldX, y: move.oldY };
                        }
                        return lego;
                    });
                } else if (lastOperation.data.legoInstanceId && lastOperation.data.oldX !== undefined && lastOperation.data.oldY !== undefined) {
                    // Handle single lego move undo
                    newDroppedLegos = droppedLegos.map(lego =>
                        lego.instanceId === lastOperation.data.legoInstanceId
                            ? { ...lego, x: lastOperation.data.oldX!, y: lastOperation.data.oldY! }
                            : lego
                    );
                }
                break;
            case 'connect':
                if (lastOperation.data.connections) {
                    const connectionToRemove = lastOperation.data.connections[0];
                    newConnections = connections.filter(conn =>
                        !(conn.from.legoId === connectionToRemove.from.legoId &&
                            conn.from.legIndex === connectionToRemove.from.legIndex &&
                            conn.to.legoId === connectionToRemove.to.legoId &&
                            conn.to.legIndex === connectionToRemove.to.legIndex)
                    );
                }
                break;
            case 'disconnect':
                if (lastOperation.data.connections) {
                    newConnections = [...connections, ...(lastOperation.data.connections || [])];
                }
                break;
            case 'fuse':
                if (lastOperation.data.oldLegos && lastOperation.data.oldConnections) {
                    // Remove the fused lego
                    newDroppedLegos = newDroppedLegos.filter(lego => lego.instanceId !== lastOperation.data.newLego?.instanceId);
                    newDroppedLegos = [...newDroppedLegos, ...lastOperation.data.oldLegos!];
                    // Restore old connections
                    newConnections = connections.filter(conn =>
                        !lastOperation.data.newConnections?.some(newConn =>
                            newConn.from.legoId === conn.from.legoId &&
                            newConn.from.legIndex === conn.from.legIndex &&
                            newConn.to.legoId === conn.to.legoId &&
                            newConn.to.legIndex === conn.to.legIndex
                        )
                    );
                    newConnections = [...newConnections, ...lastOperation.data.oldConnections!];
                }
                break;
            case 'unfuse':
                if (lastOperation.data.oldLegos && lastOperation.data.oldConnections) {
                    // Remove the unfused legos
                    newDroppedLegos = droppedLegos.filter(lego =>
                        !lastOperation.data.newLegos?.some(newLego => newLego.instanceId === lego.instanceId)
                    );
                    newDroppedLegos = [...newDroppedLegos, ...lastOperation.data.oldLegos!];
                    // Restore old connections
                    newConnections = connections.filter(conn =>
                        !lastOperation.data.newConnections?.some(newConn =>
                            newConn.from.legoId === conn.from.legoId &&
                            newConn.from.legIndex === conn.from.legIndex &&
                            newConn.to.legoId === conn.to.legoId &&
                            newConn.to.legIndex === conn.to.legIndex
                        )
                    );
                    newConnections = [...newConnections, ...lastOperation.data.oldConnections!];
                }
                break;

            case 'unfuseInto2Legos':
                if (lastOperation.data.oldLegos && lastOperation.data.oldConnections) {
                    // Remove the new legos and restore the original lego
                    const restoredLegos = [...lastOperation.data.oldLegos];
                    const restoredConnections = [...lastOperation.data.oldConnections];

                    newDroppedLegos = droppedLegos.filter(lego =>
                        !lastOperation.data.newLegos?.some(newLego => newLego.instanceId === lego.instanceId)
                    );
                    newDroppedLegos = [...newDroppedLegos, ...restoredLegos];

                    // Restore old connections
                    newConnections = restoredConnections;


                }
                break;
            case 'colorChange':
                if (lastOperation.data.oldLegos && lastOperation.data.oldConnections) {
                    // Remove the color-changed legos and Hadamard legos
                    newDroppedLegos = droppedLegos.filter(lego =>
                        !lastOperation.data.newLegos?.some(newLego => newLego.instanceId === lego.instanceId)
                    );
                    newDroppedLegos = [...newDroppedLegos, ...lastOperation.data.oldLegos!];
                    // Restore old connections
                    newConnections = connections.filter(conn =>
                        !lastOperation.data.newConnections?.some(newConn =>
                            newConn.from.legoId === conn.from.legoId &&
                            newConn.from.legIndex === conn.from.legIndex &&
                            newConn.to.legoId === conn.to.legoId &&
                            newConn.to.legIndex === conn.to.legIndex
                        )
                    );
                    newConnections = [...newConnections, ...lastOperation.data.oldConnections!];
                }
                break;
            case 'pullOutOppositeLeg':
                if (lastOperation.data.oldLegos && lastOperation.data.oldConnections) {
                    // Remove the changed legos
                    newDroppedLegos = droppedLegos.filter(lego =>
                        !lastOperation.data.newLegos?.some(newLego => newLego.instanceId === lego.instanceId)
                    );
                    newDroppedLegos = [...newDroppedLegos, ...lastOperation.data.oldLegos!];
                    // Restore old connections
                    newConnections = lastOperation.data.oldConnections!;
                }
                break;
        }

        return { connections: newConnections, droppedLegos: newDroppedLegos };

    }

    public redo(connections: Connection[], droppedLegos: DroppedLego[]): { connections: Connection[], droppedLegos: DroppedLego[] } {
        if (this.redoHistory.length === 0) return { connections, droppedLegos };

        const nextOperation = this.redoHistory[this.redoHistory.length - 1];
        let newConnections: Connection[] = _.cloneDeep(connections);
        let newDroppedLegos: DroppedLego[] = _.cloneDeep(droppedLegos);


        switch (nextOperation.type) {
            case 'add':
                const addedLegos = nextOperation.data?.legos;
                console.log("redo", "addedLegos", addedLegos, "current droppedLegos", newDroppedLegos);
                const addedConnections = nextOperation.data?.connections;
                if (addedLegos) {
                    // Add all legos from this operation
                    newDroppedLegos = [...newDroppedLegos, ...addedLegos];
                    // Add all connections that were added with these legos
                    if (addedConnections) {
                        newConnections = [...newConnections, ...addedConnections];
                    }
                }
                break;
            case 'remove':
                if (nextOperation.data.legos) {
                    // Handle removal of multiple legos for group deletions
                    const legosToRemove = nextOperation.data.legos;
                    newDroppedLegos = newDroppedLegos.filter(lego =>
                        !legosToRemove.some(removeMe => removeMe.instanceId === lego.instanceId)
                    );
                    newConnections = newConnections.filter(conn =>
                        !legosToRemove.some(lego =>
                            conn.from.legoId === lego.instanceId || conn.to.legoId === lego.instanceId
                        )
                    );
                }
                break;
            case 'move':
                if (nextOperation.data.groupMoves) {
                    // Handle group move redo
                    newDroppedLegos = newDroppedLegos.map(lego => {
                        const move = nextOperation.data.groupMoves?.find(m => m.legoInstanceId === lego.instanceId);
                        if (move) {
                            return { ...lego, x: move.newX, y: move.newY };
                        }
                        return lego;
                    });
                } else if (nextOperation.data.legoInstanceId && nextOperation.data.newX !== undefined && nextOperation.data.newY !== undefined) {
                    // Handle single lego move redo
                    newDroppedLegos = newDroppedLegos.map(lego =>
                        lego.instanceId === nextOperation.data.legoInstanceId
                            ? { ...lego, x: nextOperation.data.newX!, y: nextOperation.data.newY! }
                            : lego
                    );
                }
                break;
            case 'connect':
                if (nextOperation.data.connections) {
                    newConnections = [...newConnections, ...(nextOperation.data.connections || [])];
                }
                break;
            case 'disconnect':
                if (nextOperation.data.connections) {
                    const connectionToRemove = nextOperation.data.connections[0];
                    newConnections = newConnections.filter(conn =>
                        !(conn.from.legoId === connectionToRemove.from.legoId &&
                            conn.from.legIndex === connectionToRemove.from.legIndex &&
                            conn.to.legoId === connectionToRemove.to.legoId &&
                            conn.to.legIndex === connectionToRemove.to.legIndex)
                    );
                }
                break;
            case 'fuse':
                if (nextOperation.data.newLego && nextOperation.data.oldLegos) {
                    // Remove old legos
                    newDroppedLegos = newDroppedLegos.filter(lego =>
                        !nextOperation.data.oldLegos!.some(oldLego => oldLego.instanceId === lego.instanceId)
                    );
                    newDroppedLegos = [...newDroppedLegos, nextOperation.data.newLego!];
                    // Add new connections
                    if (nextOperation.data.newConnections) {
                        newConnections = newConnections.filter(conn =>
                            !nextOperation.data.oldConnections?.some(oldConn =>
                                oldConn.from.legoId === conn.from.legoId &&
                                oldConn.from.legIndex === conn.from.legIndex &&
                                oldConn.to.legoId === conn.to.legoId &&
                                oldConn.to.legIndex === conn.to.legIndex
                            )
                        );
                        newConnections = [...newConnections, ...nextOperation.data.newConnections!];
                    }
                }
                break;
            case 'unfuse':
                if (nextOperation.data.newLegos && nextOperation.data.oldLegos) {
                    // Remove the original lego
                    newDroppedLegos = newDroppedLegos.filter(lego =>
                        !nextOperation.data.oldLegos!.some(oldLego => oldLego.instanceId === lego.instanceId)
                    );
                    newDroppedLegos = [...newDroppedLegos, ...nextOperation.data.newLegos!];
                    // Add new connections
                    if (nextOperation.data.newConnections) {
                        newConnections = newConnections.filter(conn =>
                            !nextOperation.data.oldConnections?.some(oldConn =>
                                oldConn.from.legoId === conn.from.legoId &&
                                oldConn.from.legIndex === conn.from.legIndex &&
                                oldConn.to.legoId === conn.to.legoId &&
                                oldConn.to.legIndex === conn.to.legIndex
                            )
                        );
                        newConnections = [...newConnections, ...nextOperation.data.newConnections!];
                    }
                }
                break;
            case 'unfuseInto2Legos':
                if (nextOperation.data.newLegos && nextOperation.data.oldLegos) {
                    // Remove the original lego and add the new legos
                    newDroppedLegos = newDroppedLegos.filter(lego =>
                        !nextOperation.data.oldLegos!.some(oldLego => oldLego.instanceId === lego.instanceId)
                    );
                    newDroppedLegos = [...newDroppedLegos, ...nextOperation.data.newLegos!];
                    // Update connections
                    newConnections = nextOperation.data.newConnections!;


                }
                break;
            case 'colorChange':
                if (nextOperation.data.newLegos && nextOperation.data.oldLegos) {
                    // Remove the original lego
                    newDroppedLegos = newDroppedLegos.filter(lego =>
                        !nextOperation.data.oldLegos!.some(oldLego => oldLego.instanceId === lego.instanceId)
                    );
                    newDroppedLegos = [...newDroppedLegos, ...nextOperation.data.newLegos!];
                    // Add new connections
                    if (nextOperation.data.newConnections) {
                        newConnections = newConnections.filter(conn =>
                            !nextOperation.data.oldConnections?.some(oldConn =>
                                oldConn.from.legoId === conn.from.legoId &&
                                oldConn.from.legIndex === conn.from.legIndex &&
                                oldConn.to.legoId === conn.to.legoId &&
                                oldConn.to.legIndex === conn.to.legIndex
                            )
                        );
                        newConnections = [...newConnections, ...nextOperation.data.newConnections!];
                    }
                }
                break;
            case 'pullOutOppositeLeg':
                if (nextOperation.data.newLegos && nextOperation.data.oldLegos) {
                    // Remove only the original lego and add the new legos
                    newDroppedLegos = newDroppedLegos.filter(lego =>
                        !nextOperation.data.oldLegos!.some(oldLego => oldLego.instanceId === lego.instanceId)
                    );
                    // Then add the new legos from this operation, but only if they don't already exist
                    const newLegos = nextOperation.data.newLegos!;
                    // Add all new legos that don't already exist
                    const updatedLegos = [...newDroppedLegos];
                    newLegos.forEach(newLego => {
                        if (!updatedLegos.some(lego => lego.instanceId === newLego.instanceId)) {
                            updatedLegos.push(newLego);
                        }
                    });
                    // Update connections
                    if (nextOperation.data.newConnections) {
                        newConnections = newConnections.filter(conn =>
                            // First, remove only the old connections from this specific operation
                            !nextOperation.data.oldConnections?.some(oldConn =>
                                oldConn.from.legoId === conn.from.legoId &&
                                oldConn.from.legIndex === conn.from.legIndex &&
                                oldConn.to.legoId === conn.to.legoId &&
                                oldConn.to.legIndex === conn.to.legIndex
                            )
                        );
                        // Then add the new connections from this operation, but only if they don't already exist
                        const newConns = nextOperation.data.newConnections!;
                        // Add all new connections that don't already exist
                        const updatedConns = [...newConnections];
                        newConns.forEach(newConn => {
                            if (!updatedConns.some(conn =>
                                conn.from.legoId === newConn.from.legoId &&
                                conn.from.legIndex === newConn.from.legIndex &&
                                conn.to.legoId === newConn.to.legoId &&
                                conn.to.legIndex === newConn.to.legIndex
                            )) {
                                updatedConns.push(newConn);
                            }
                        });
                        newConnections = updatedConns;
                    }
                }
                break;
        }

        // Move the operation back to the history stack
        this.operations.push(nextOperation);
        this.redoHistory = this.redoHistory.slice(0, -1);
        return { connections: newConnections, droppedLegos: newDroppedLegos };
    }
}