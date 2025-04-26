import { Connection, DroppedLego } from "../types";

// Add this new function to find connected components
export function findConnectedComponent(startLego: DroppedLego, droppedLegos: DroppedLego[], connections: Connection[]) {
    const visited = new Set<string>();
    const component: DroppedLego[] = [];
    const componentConnections: Connection[] = [];
    const queue: string[] = [startLego.instanceId];
    visited.add(startLego.instanceId);

    // First pass: collect all connected legos using BFS
    while (queue.length > 0) {
        const currentLegoId = queue.shift()!;
        const currentLego = droppedLegos.find(l => l.instanceId === currentLegoId);
        if (!currentLego) continue;
        component.push(currentLego);

        // Find all directly connected legos and add them to queue if not visited
        connections.forEach(conn => {
            if (conn.from.legoId === currentLegoId && !visited.has(conn.to.legoId)) {
                visited.add(conn.to.legoId);
                queue.push(conn.to.legoId);
            } else if (conn.to.legoId === currentLegoId && !visited.has(conn.from.legoId)) {
                visited.add(conn.from.legoId);
                queue.push(conn.from.legoId);
            }
        });
    }

    // Second pass: collect all connections between the legos in the component
    connections.forEach(conn => {
        if (visited.has(conn.from.legoId) && visited.has(conn.to.legoId)) {
            componentConnections.push(conn);
        }
    });

    return { legos: component, connections: componentConnections };
};
