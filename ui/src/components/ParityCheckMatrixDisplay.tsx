import { Box, Heading, Table, Thead, Tbody, Tr, Td } from '@chakra-ui/react'
import { LegoPiece } from '../types.ts'

interface ParityCheckMatrixDisplayProps {
    matrix: number[][]
    title?: string
    lego?: LegoPiece
}

export const ParityCheckMatrixDisplay: React.FC<ParityCheckMatrixDisplayProps> = ({ matrix, title, lego }) => {
    if (!matrix || matrix.length === 0) return null;

    const getColumnStyle = (index: number) => {
        const legIndex = index % (matrix[0].length / 2);
        if (lego?.logical_legs.includes(legIndex)) {
            return { fontWeight: "bold", color: "blue.600" };
        }
        if (lego?.gauge_legs.includes(legIndex)) {
            return { fontWeight: "bold", color: "gray.700" };
        }
        return { color: "gray.600" };
    };

    return (
        <Box>
            {title && <Heading size="sm" mb={2}>{title}</Heading>}
            <Box overflowX="auto">
                <Table size="sm" variant="simple">
                    <Thead>
                        <Tr>
                            <>
                                <Td
                                    p={2}
                                    textAlign="center"
                                    borderWidth={0}
                                    colSpan={matrix[0].length / 2}
                                    fontWeight="bold"
                                    color="blue.600"
                                >
                                    X
                                </Td>
                                <Td
                                    p={2}
                                    textAlign="center"
                                    borderWidth={0}
                                    colSpan={matrix[0].length / 2}
                                    fontWeight="bold"
                                    color="red.600"
                                >
                                    Z
                                </Td>
                            </>
                        </Tr>
                        <Tr>
                            <>
                                {/* X indices */}
                                {Array(matrix[0].length / 2).fill(0).map((_, i) => (
                                    <Td
                                        key={`x-idx-${i}`}
                                        p={2}
                                        textAlign="center"
                                        borderWidth={0}
                                        colSpan={1}
                                        fontSize="sm"
                                        {...getColumnStyle(i)}
                                    >
                                        {i}
                                    </Td>
                                ))}
                                {/* Z indices */}
                                {Array(matrix[0].length / 2).fill(0).map((_, i) => (
                                    <Td
                                        key={`z-idx-${i}`}
                                        p={2}
                                        textAlign="center"
                                        borderWidth={0}
                                        colSpan={1}
                                        fontSize="sm"
                                        {...getColumnStyle(i + matrix[0].length / 2)}
                                    >
                                        {i}
                                    </Td>
                                ))}
                            </>
                        </Tr>
                    </Thead>
                    <Tbody>
                        {matrix.map((row, rowIndex) => (
                            <Tr key={rowIndex}>
                                {row.map((cell, cellIndex) => {
                                    const isMiddle = cellIndex === row.length / 2 - 1;
                                    return (
                                        <Td
                                            key={cellIndex}
                                            p={2}
                                            textAlign="center"
                                            bg={cell === 1 ? "blue.100" : "transparent"}
                                            borderWidth={1}
                                            borderColor="gray.200"
                                            borderRightWidth={isMiddle ? 3 : 1}
                                            borderRightColor={isMiddle ? "gray.400" : "gray.200"}
                                        >
                                            {cell}
                                        </Td>
                                    )
                                })}
                            </Tr>
                        ))}
                    </Tbody>
                </Table>
            </Box>
        </Box>
    )
} 