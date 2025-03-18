import { Box, VStack, Button } from '@chakra-ui/react';
import { useEffect, useRef, useState } from 'react';
import { TensorNetworkLeg } from '../types';
import * as d3 from 'd3-force';

interface Point {
    x: number;
    y: number;
    isStabilizer?: boolean;
    stabilizerIndex?: number;
    type?: 'X' | 'Z';
}

interface StabilizerGraphViewProps {
    legs: TensorNetworkLeg[];
    matrix: number[][];
    width?: number;
    height?: number;
    selectedStabilizer?: number | null;
    onStabilizerSelect?: (index: number | null) => void;
    highlightedStabilizer?: number | null;
}

export const StabilizerGraphView: React.FC<StabilizerGraphViewProps> = ({
    legs,
    matrix,
    width = 400,
    height = 300,
    selectedStabilizer,
    onStabilizerSelect,
    highlightedStabilizer
}) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [points, setPoints] = useState<Point[]>([]);
    const [draggedPoint, setDraggedPoint] = useState<number | null>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [selectedPoints, setSelectedPoints] = useState<Set<number>>(new Set());
    const simulationRef = useRef<any>(null);

    const draw = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Don't draw if points haven't been initialized yet
        if (points.length === 0) return;

        // Clear canvas
        ctx.clearRect(0, 0, width, height);

        // Draw connections between stabilizers and legs
        matrix.forEach((row, stabilizerIndex) => {
            const stabilizerPoint = points.find(p => p.isStabilizer && p.stabilizerIndex === stabilizerIndex);
            if (!stabilizerPoint) return;

            const stabilizerLegs = getStabilizerLegs(row);
            stabilizerLegs.forEach(legIndex => {
                const legPoint = points[matrix.length + legIndex];
                if (!legPoint || legPoint.isStabilizer) return;

                // Draw connection line
                ctx.beginPath();
                ctx.moveTo(stabilizerPoint.x, stabilizerPoint.y);
                ctx.lineTo(legPoint.x, legPoint.y);
                ctx.strokeStyle = stabilizerPoint.type === 'Z' ? 'rgba(255, 0, 0, 0.3)' : 'rgba(0, 0, 255, 0.3)';
                ctx.lineWidth = 1;
                ctx.stroke();
            });
        });

        // Draw all nodes (both stabilizers and legs)
        points.forEach((point, index) => {
            if (point.isStabilizer) {
                // Draw stabilizer square
                const size = 30;
                ctx.beginPath();
                ctx.rect(point.x - size / 2, point.y - size / 2, size, size);
                ctx.fillStyle = point.type === 'Z' ? 'red' : 'blue';
                ctx.fill();
                ctx.strokeStyle = selectedStabilizer === point.stabilizerIndex ? 'orange' :
                    highlightedStabilizer === point.stabilizerIndex ? '#ffd700' : 'white';
                ctx.lineWidth = selectedStabilizer === point.stabilizerIndex ? 3 :
                    highlightedStabilizer === point.stabilizerIndex ? 5 : 1;
                ctx.stroke();

                // Draw stabilizer label
                ctx.fillStyle = 'white';
                ctx.font = 'bold 12px Arial';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(point.stabilizerIndex!.toString(), point.x, point.y);
            } else {
                // Draw leg circle
                const legIndex = index - matrix.length;
                if (legIndex >= 0 && legIndex < legs.length) {
                    ctx.beginPath();
                    ctx.arc(point.x, point.y, 20, 0, 2 * Math.PI);
                    ctx.fillStyle = selectedPoints.has(index) ? '#e2e8f0' : 'white';
                    ctx.fill();
                    ctx.strokeStyle = selectedPoints.has(index) ? 'blue' : 'black';
                    ctx.lineWidth = selectedPoints.has(index) ? 2 : 1;
                    ctx.stroke();

                    // Draw leg label
                    ctx.fillStyle = 'black';
                    ctx.font = '12px Arial';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillText(`${legs[legIndex].instanceId}-${legs[legIndex].legIndex}`, point.x, point.y);
                }
            }
        });
    };

    const runForceSimulation = () => {
        // Create nodes for d3-force
        const nodes = points.map((point, i) => ({
            id: i,
            x: point.x,
            y: point.y,
            fx: undefined as number | undefined,
            fy: undefined as number | undefined,
            isStabilizer: point.isStabilizer,
            stabilizerIndex: point.stabilizerIndex,
            type: point.type,
            legIndex: (point as any).legIndex
        }));

        // Create links between stabilizers and legs
        const links: { source: number; target: number; weight: number }[] = [];
        matrix.forEach((row, stabilizerIndex) => {
            const stabilizerLegs = getStabilizerLegs(row);
            const stabilizerWeight = stabilizerLegs.length;

            stabilizerLegs.forEach(legIndex => {
                links.push({
                    source: stabilizerIndex,
                    target: matrix.length + legIndex,
                    weight: stabilizerWeight
                });
            });
        });

        // Create simulation
        const simulation = d3.forceSimulation(nodes)
            .force("link", d3.forceLink(links)
                .id((d: any) => d.id)
                .distance(100)
                .strength((link: any) => {
                    return 0.7 * (link.weight / matrix[0].length);
                }))
            .force("charge", d3.forceManyBody()
                .strength((d: any) => {
                    if (d.isStabilizer) return -500;
                    return -200;
                }))
            .force("center", d3.forceCenter(width / 2, height / 2))
            .force("collision", d3.forceCollide()
                .radius((d: any) => d.isStabilizer ? 40 : 30))
            .force("x", d3.forceX(width / 2).strength(0.1))
            .force("y", d3.forceY(height / 2).strength(0.1))
            .force("boundary", function (alpha: number) {
                nodes.forEach(node => {
                    if (node.isStabilizer) {
                        node.x = Math.max(40, Math.min(width - 30, node.x));
                        node.y = Math.max(40, Math.min(height - 30, node.y));
                    } else {
                        node.x = Math.max(40, Math.min(width - 20, node.x));
                        node.y = Math.max(40, Math.min(height - 20, node.y));
                    }
                });
            });

        // Store simulation reference
        simulationRef.current = simulation;

        // Run simulation
        simulation.stop();
        for (let i = 0; i < 300; i++) simulation.tick();

        // Convert nodes back to points
        const newPoints = nodes.map(node => ({
            x: node.x,
            y: node.y,
            isStabilizer: node.isStabilizer,
            stabilizerIndex: node.stabilizerIndex,
            type: node.type
        }));

        setPoints(newPoints);

        // Cache the new positions
        const matrixKey = matrix.map(row => row.join('')).join('|');
        const cacheKey = `stabilizer_graph_positions_${matrixKey}`;
        localStorage.setItem(cacheKey, JSON.stringify(newPoints));
    };

    // Initialize points from cache or create new layout
    useEffect(() => {
        const matrixKey = matrix.map(row => row.join('')).join('|');
        const cacheKey = `stabilizer_graph_positions_${matrixKey}`;
        const cachedPositions = localStorage.getItem(cacheKey);

        if (cachedPositions) {
            try {
                const parsedPoints = JSON.parse(cachedPositions);
                if (parsedPoints.length === legs.length + matrix.length) {
                    setPoints(parsedPoints);
                    return;
                }
            } catch (e) {
                console.warn('Failed to parse cached positions:', e);
            }
        }

        // Create initial grid layout
        const stabilizerPoints = matrix.map((row, index) => {
            const n = row.length / 2;
            const hasX = row.slice(0, n).some(x => x === 1);
            const type = hasX ? 'X' as const : 'Z' as const;

            const cols = Math.ceil(Math.sqrt(matrix.length));
            const stabilizerRow = Math.floor(index / cols);
            const stabilizerCol = index % cols;
            const cellWidth = width / (cols + 1);
            const cellHeight = 100;
            const x = cellWidth * (stabilizerCol + 1);
            const y = cellHeight * (stabilizerRow + 1);

            return {
                x,
                y,
                isStabilizer: true,
                stabilizerIndex: index,
                type
            };
        });

        const legCols = Math.ceil(Math.sqrt(legs.length));
        const legRows = Math.ceil(legs.length / legCols);
        const legCellWidth = width / (legCols + 1);
        const legCellHeight = (height - 150) / (legRows + 1);

        const legPoints = legs.map((leg, index) => {
            const legRow = Math.floor(index / legCols);
            const legCol = index % legCols;
            const x = legCellWidth * (legCol + 1);
            const y = 150 + legCellHeight * (legRow + 1);

            return {
                x,
                y,
                isStabilizer: false,
                stabilizerIndex: undefined,
                type: undefined as 'X' | 'Z' | undefined,
                legIndex: index
            };
        });

        setPoints([...stabilizerPoints, ...legPoints]);
    }, [legs.length, width, height, matrix]);

    // Update cache when points change
    useEffect(() => {
        if (points.length > 0) {
            const matrixKey = matrix.map(row => row.join('')).join('|');
            const cacheKey = `stabilizer_graph_positions_${matrixKey}`;
            localStorage.setItem(cacheKey, JSON.stringify(points));
        }
    }, [points, matrix]);

    const getStabilizerColor = (row: number[]): string => {
        const n = row.length / 2;
        const hasX = row.slice(0, n).some(x => x === 1);
        const hasZ = row.slice(n).some(z => z === 1);

        if (hasX) return 'rgba(255, 0, 0, 0.3)'; // Semi-transparent red for X
        if (hasZ) return 'rgba(0, 0, 255, 0.3)'; // Semi-transparent blue for Z
        return 'rgba(128, 128, 128, 0.3)'; // Semi-transparent gray for others
    };

    const getStabilizerStrokeColor = (row: number[]): string => {
        const n = row.length / 2;
        const hasX = row.slice(0, n).some(x => x === 1);
        const hasZ = row.slice(n).some(z => z === 1);

        if (hasX) return 'red';
        if (hasZ) return 'blue';
        return 'gray';
    };

    const getStabilizerLegs = (row: number[]): number[] => {
        const n = row.length / 2;
        return row.map((val, i) => val === 1 ? i % n : -1).filter(i => i !== -1);
    };

    useEffect(() => {
        draw();
    }, [points, matrix, legs, highlightedStabilizer, selectedStabilizer, selectedPoints]);

    const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        // Check if clicked on a point
        const clickedPoint = points.findIndex(point => {
            const dx = point.x - x;
            const dy = point.y - y;
            const radius = point.isStabilizer ? 15 : 20;
            return Math.sqrt(dx * dx + dy * dy) < radius;
        });

        if (clickedPoint !== -1) {
            const clickedPointData = points[clickedPoint];
            if (clickedPointData.isStabilizer) {
                // If clicked on a stabilizer, update the selected stabilizer
                if (onStabilizerSelect) {
                    onStabilizerSelect(clickedPointData.stabilizerIndex!);
                }
            }

            if (e.shiftKey) {
                // Toggle selection
                setSelectedPoints(prev => {
                    const newSelected = new Set(prev);
                    if (newSelected.has(clickedPoint)) {
                        newSelected.delete(clickedPoint);
                    } else {
                        newSelected.add(clickedPoint);
                    }
                    return newSelected;
                });
            } else {
                // Simple click selects the point
                setSelectedPoints(new Set([clickedPoint]));
            }
            setDraggedPoint(clickedPoint);
            setIsDragging(true);
        } else if (!e.shiftKey) {
            // Clicked on empty space without shift - clear selection
            setSelectedPoints(new Set());
            if (onStabilizerSelect) {
                onStabilizerSelect(null);
            }
        }
    };

    const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
        if (!isDragging || draggedPoint === null) return;

        const canvas = canvasRef.current;
        if (!canvas) return;

        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        // Only start dragging after a small threshold to avoid accidental drags
        const dx = x - points[draggedPoint].x;
        const dy = y - points[draggedPoint].y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance > 5) { // 5 pixel threshold
            setPoints(prev => {
                const newPoints = [...prev];
                const moveX = x - prev[draggedPoint].x;
                const moveY = y - prev[draggedPoint].y;

                // Move all selected points together
                selectedPoints.forEach(pointIndex => {
                    const point = prev[pointIndex];
                    let newX = point.x + moveX;
                    let newY = point.y + moveY;

                    // Apply boundary constraints
                    if (point.isStabilizer) {
                        newX = Math.max(30, Math.min(width - 30, newX));
                        newY = Math.max(30, Math.min(height - 30, newY));
                    } else {
                        newX = Math.max(20, Math.min(width - 20, newX));
                        newY = Math.max(20, Math.min(height - 20, newY));
                    }

                    newPoints[pointIndex] = {
                        x: newX,
                        y: newY,
                        isStabilizer: point.isStabilizer,
                        stabilizerIndex: point.stabilizerIndex,
                        type: point.type
                    };
                });

                return newPoints;
            });
        }
    };

    const handleMouseUp = () => {
        setIsDragging(false);
        setDraggedPoint(null);
    };

    return (
        <Box>
            <Button
                size="sm"
                colorScheme="blue"
                mb={2}
                onClick={runForceSimulation}
            >
                Auto-layout
            </Button>
            <canvas
                ref={canvasRef}
                width={width}
                height={height}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                style={{ border: '1px solid #ccc', borderRadius: '4px' }}
            />
        </Box>
    );
}; 