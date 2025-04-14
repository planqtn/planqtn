import { Connection, DroppedLego, Operation } from "../types";
import * as _ from 'lodash';

export class OperationHistory {


    redoHistory: Operation[] = [];
    constructor(private operations: Operation[]) { }

    public addOperation(operation: Operation) {
        this.operations.push(operation);
        // console.log("addOperation", "operation", operation, "operations", this.operations);
        this.redoHistory = [];
    }


    public undo(connections: Connection[], droppedLegos: DroppedLego[]): { connections: Connection[], droppedLegos: DroppedLego[] } {
        if (this.operations.length === 0) return { connections, droppedLegos };

        const lastOperation = this.operations[this.operations.length - 1];

        // console.log("undo", "lastOperation", lastOperation);
        // console.log("undo", "current legos", droppedLegos);
        // Move the operation to redo history before undoing
        this.redoHistory.push(lastOperation);
        this.operations = this.operations.slice(0, -1);

        let newConnections: Connection[] = _.cloneDeep(connections);
        let newDroppedLegos: DroppedLego[] = _.cloneDeep(droppedLegos);

        newConnections = newConnections.filter(conn => !lastOperation.data?.connectionsToAdd?.some(removeMe => removeMe.equals(conn)));
        newConnections = [...newConnections, ...(lastOperation.data?.connectionsToRemove || [])];
        // we remove the ones that were added  
        newDroppedLegos = newDroppedLegos.filter(lego => !lastOperation.data?.legosToAdd?.some(removeMe => removeMe.instanceId === lego.instanceId));
        // we add the ones that were removed
        newDroppedLegos = [...newDroppedLegos, ...(lastOperation.data?.legosToRemove || [])];
        // we update the ones that were updated
        newDroppedLegos = newDroppedLegos.map(lego => {
            const update = lastOperation.data?.legosToUpdate?.find(updateMe => updateMe.newLego.instanceId === lego.instanceId);
            if (update) {
                return update.oldLego;
            }
            return lego;
        });
        // console.log("undo new droppedLegos", newDroppedLegos);

        return { connections: newConnections, droppedLegos: newDroppedLegos };

    }

    public redo(connections: Connection[], droppedLegos: DroppedLego[]): { connections: Connection[], droppedLegos: DroppedLego[] } {
        if (this.redoHistory.length === 0) return { connections, droppedLegos };

        const nextOperation = this.redoHistory[this.redoHistory.length - 1];
        let newConnections: Connection[] = _.cloneDeep(connections);
        let newDroppedLegos: DroppedLego[] = _.cloneDeep(droppedLegos);
        this.operations.push(nextOperation);
        this.redoHistory = this.redoHistory.slice(0, -1);

        newConnections = newConnections.filter(conn => !nextOperation.data?.connectionsToRemove?.some(removeMe => removeMe.equals(conn)));
        newConnections = [...newConnections, ...(nextOperation.data?.connectionsToAdd || [])];
        newDroppedLegos = newDroppedLegos.filter(lego => !nextOperation.data?.legosToRemove?.some(removeMe => removeMe.instanceId === lego.instanceId));
        newDroppedLegos = [...newDroppedLegos, ...(nextOperation.data?.legosToAdd || [])];
        newDroppedLegos = newDroppedLegos.map(lego => {
            const update = nextOperation.data?.legosToUpdate?.find(updateMe => updateMe.oldLego.instanceId === lego.instanceId);
            if (update) {
                return update.newLego;
            }
            return lego;
        });

        return { connections: newConnections, droppedLegos: newDroppedLegos };
    }
}