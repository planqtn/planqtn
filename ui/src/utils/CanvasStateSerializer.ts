import { DroppedLego, LegoPiece, Connection, CanvasState } from '../types'
import { GenericStyle, getLegoStyle } from '../LegoStyles'
import axios from 'axios'

export class CanvasStateSerializer {
    constructor(private legos: LegoPiece[]) { }

    public encode(pieces: DroppedLego[], connections: Connection[]): void {
        const state: CanvasState = {
            pieces: pieces.map(piece => ({
                id: piece.id,
                instanceId: piece.instanceId,
                x: piece.x,
                y: piece.y,
                shortName: piece.shortName,
                is_dynamic: piece.is_dynamic,
                parameters: piece.parameters,
                parity_check_matrix: piece.parity_check_matrix,
                logical_legs: piece.logical_legs,
                gauge_legs: piece.gauge_legs
            })),
            connections
        }

        const encoded = btoa(JSON.stringify(state))
        console.log("Encoding state:", state, "encoded", encoded);
        window.history.replaceState(null, '', `#state=${encoded}`)
    }

    public async decode(encoded: string): Promise<{
        pieces: DroppedLego[],
        connections: Connection[]
    }> {
        try {
            const decoded = JSON.parse(atob(encoded))
            if (!decoded.pieces || !Array.isArray(decoded.pieces)) {
                return { pieces: [], connections: [] }
            }
            // Fetch legos if not already loaded
            let legosList = this.legos
            if (this.legos.length === 0) {
                const response = await axios.get('/api/legos')
                legosList = response.data
            }

            // Reconstruct dropped legos with full lego information
            const reconstructedPieces = decoded.pieces
                .map((piece: {
                    id: string;
                    instanceId: string;
                    x: number;
                    y: number;
                    is_dynamic?: boolean;
                    parameters?: Record<string, any>;
                    parity_check_matrix?: number[][];
                    logical_legs?: number[];
                    gauge_legs?: number[];
                    name?: string;
                    shortName?: string;
                    description?: string;
                }) => {
                    const predefinedLego = legosList.find(l => l.id === piece.id)

                    // For pieces not in lego list, construct from saved data
                    if (!predefinedLego) {
                        return {
                            id: piece.id,
                            name: piece.name || piece.id,
                            shortName: piece.shortName || piece.id,
                            description: piece.description || '',
                            instanceId: piece.instanceId,
                            x: piece.x,
                            y: piece.y,
                            is_dynamic: piece.is_dynamic || false,
                            parameters: piece.parameters || {},
                            parity_check_matrix: piece.parity_check_matrix || [],
                            logical_legs: piece.logical_legs || [],
                            gauge_legs: piece.gauge_legs || [],
                            style: new GenericStyle(piece.id),
                            pushedLegs: []
                        }
                    }

                    // For dynamic legos, use the saved parameters and matrix
                    if (piece.is_dynamic && piece.parameters && piece.parity_check_matrix) {
                        return {
                            ...predefinedLego,
                            instanceId: piece.instanceId,
                            x: piece.x,
                            y: piece.y,
                            parameters: piece.parameters,
                            parity_check_matrix: piece.parity_check_matrix,
                            logical_legs: piece.logical_legs || [],
                            gauge_legs: piece.gauge_legs || [],
                            style: getLegoStyle(piece.id),
                            pushedLegs: []
                        }
                    }

                    // For regular legos, use the template
                    return {
                        ...predefinedLego,
                        instanceId: piece.instanceId,
                        x: piece.x,
                        y: piece.y,
                        style: getLegoStyle(predefinedLego.id),
                        pushedLegs: []
                    }
                })
            // console.log("Reconstructed pieces:", reconstructedPieces, "connections", decoded.connections);
            return {
                pieces: reconstructedPieces,
                connections: decoded.connections || []
            }
        } catch (error) {
            console.error('Error decoding canvas state:', error)
            return { pieces: [], connections: [] }
        }
    }

    public updateLegos(newLegos: LegoPiece[]): void {
        this.legos = newLegos
    }
} 