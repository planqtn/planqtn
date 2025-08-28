import { GF2 } from "./GF2";

export function sstr(h: GF2): string {
  const [r, n] = h.shape;
  const halfN = Math.floor(n / 2);
  return Array.from({ length: r }, (_, i) => {
    const row = h.getRow(i);
    const xPart = row
      .slice(0, halfN)
      .map((b) => (b ? "1" : "_"))
      .join("");
    const zPart = row
      .slice(halfN)
      .map((b) => (b ? "1" : "_"))
      .join("");
    return `${xPart}|${zPart}`;
  }).join("\n");
}

export function sprint(h: GF2, end: string = "\n"): void {
  console.log(sstr(h) + end);
}

export function bring_col_to_front(
  h: GF2,
  col: number,
  target_col: number
): void {
  for (let c = col - 1; c >= target_col; c--) {
    h.swapColumns(c, c + 1);
  }
}

export function tensor_product(h1: GF2, h2: GF2): GF2 {
  const [r1, n1] = h1.shape;
  const [r2, n2] = h2.shape;
  const halfN1 = Math.floor(n1 / 2);
  const halfN2 = Math.floor(n2 / 2);

  const is_scalar_1 = halfN1 === 0;
  const is_scalar_2 = halfN2 === 0;
  if (is_scalar_1) {
    // normalize non-zero scalars to 1
    if (h1.get(0, 0) === 0) {
      return new GF2([[0]]);
    }
    return h2;
  }
  if (is_scalar_2) {
    // normalize non-zero scalars to 1
    if (h2.get(0, 0) === 0) {
      return new GF2([[0]]);
    }
    return h1;
  }
  if (is_scalar_1 || is_scalar_2) {
    return h1.multiply(h2);
  }

  // check for the special case of the identity stoppers (free qubits) and their tensor products
  const h1_has_only_one_all_zero_row =
    r1 == 1 && h1.toArray().every((row) => row.every((b) => b === 0));

  if (h1_has_only_one_all_zero_row) {
    // we just add the number of free qubits to the other matrix and that's it
    // so we need to add halfN1 cols to h2 with zeros to each half of the matrix
    const new_h2 = new GF2(
      h2
        .toArray()
        .map((row) => [
          ...Array(halfN1).fill(0),
          ...row.slice(0, halfN2),
          ...Array(halfN1).fill(0),
          ...row.slice(halfN2)
        ])
    );
    return new_h2;
  }

  const h2_has_only_one_all_zero_row =
    r2 == 1 && h2.toArray().every((row) => row.every((b) => b === 0));

  if (h2_has_only_one_all_zero_row) {
    // we just add the number of free qubits to the other matrix and that's it
    // so we need to add halfN2 cols to h1 with zeros
    const new_h1 = new GF2(
      h1
        .toArray()
        .map((row) => [
          ...row.slice(0, halfN1),
          ...Array(halfN2).fill(0),
          ...row.slice(halfN1),
          ...Array(halfN2).fill(0)
        ])
    );
    return new_h1;
  }

  // Create block diagonal matrices for X and Z parts
  const xPart1 = h1.toArray().map((row) => row.slice(0, halfN1));
  const xPart2 = h2.toArray().map((row) => row.slice(0, halfN2));
  const zPart1 = h1.toArray().map((row) => row.slice(halfN1));
  const zPart2 = h2.toArray().map((row) => row.slice(halfN2));

  // Create result matrix
  const result = new GF2(
    Array.from({ length: r1 + r2 }, (_, i) => {
      if (i < r1) {
        // First r1 rows come from h1
        const xRow = xPart1[i];
        const zRow = zPart1[i];
        return [
          ...xRow,
          ...Array(halfN2).fill(0),
          ...zRow,
          ...Array(halfN2).fill(0)
        ];
      } else {
        // Last r2 rows come from h2
        const xRow = xPart2[i - r1];
        const zRow = zPart2[i - r1];
        return [
          ...Array(halfN1).fill(0),
          ...xRow,
          ...Array(halfN1).fill(0),
          ...zRow
        ];
      }
    }).filter((row) => row.some((b) => b !== 0))
  );

  // Verify shape
  if (
    result.shape[0] !== r1 + r2 ||
    result.shape[1] !== 2 * (halfN1 + halfN2)
  ) {
    throw new Error(
      `Invalid shape: ${result.shape} != (${r1 + r2}, ${2 * (halfN1 + halfN2)})`
    );
  }

  return result;
}

export function conjoin(
  h1: GF2,
  h2: GF2,
  leg1: number = 0,
  leg2: number = 0
): GF2 {
  const n1 = Math.floor(h1.shape[1] / 2);
  const h = tensor_product(h1, h2);
  const result = self_trace(h, leg1, n1 + leg2);
  return GF2.gauss(result, { noswaps: true });
}

export function self_trace(h: GF2, leg1: number = 0, leg2: number = 1): GF2 {
  const [r, n] = h.shape;
  const halfN = Math.floor(n / 2);

  const x1 = leg1;
  const x2 = leg2;
  const z1 = leg1 + halfN;
  const z2 = leg2 + halfN;
  const legs = [x1, x2, z1, z2];

  // First perform Gaussian elimination on the specified columns
  const mx = GF2.gauss(h, { col_subset: legs });

  // Keep track of rows to keep
  let keptRows = Array.from({ length: r }, (_, i) => i);

  // Helper to find pivot rows in keptRows
  function findPivotRows(rows: number[], mx: GF2, legs: number[]): number[] {
    return legs.map((leg) => {
      const nonZeroRows = [];
      for (const i of rows) {
        if (mx.get(i, leg) === 1) {
          nonZeroRows.push(i);
        }
      }
      return nonZeroRows.length === 0 ? -1 : nonZeroRows[0];
    });
  }

  // Handle ZZ measurement
  const pivotRows = findPivotRows(keptRows, mx, legs);
  if (
    pivotRows[0] !== pivotRows[1] &&
    pivotRows[0] !== -1 &&
    pivotRows[1] !== -1
  ) {
    // Add rows if they're different
    const newRow = Array(n).fill(0);
    for (let j = 0; j < n; j++) {
      newRow[j] = (mx.get(pivotRows[0], j) + mx.get(pivotRows[1], j)) % 2;
    }
    mx.setRow(pivotRows[0], newRow);

    keptRows = keptRows.filter((row) => row !== pivotRows[1]);
  } else if (pivotRows[0] === -1 && pivotRows[1] !== -1) {
    keptRows = keptRows.filter((row) => row !== pivotRows[1]);
  } else if (pivotRows[0] !== -1 && pivotRows[1] === -1) {
    keptRows = keptRows.filter((row) => row !== pivotRows[0]);
  }

  // Handle XX measurement
  if (
    pivotRows[2] !== pivotRows[3] &&
    pivotRows[2] !== -1 &&
    pivotRows[3] !== -1
  ) {
    const newRow = Array(n).fill(0);
    for (let j = 0; j < n; j++) {
      newRow[j] = (mx.get(pivotRows[2], j) + mx.get(pivotRows[3], j)) % 2;
    }

    if (keptRows.some((row) => row === pivotRows[3])) {
      mx.setRow(pivotRows[2], newRow);
      keptRows = keptRows.filter((row) => row !== pivotRows[3]);
    } else {
      mx.setRow(pivotRows[3], newRow);
      keptRows = keptRows.filter((row) => row !== pivotRows[2]);
    }
  } else if (pivotRows[2] === -1 && pivotRows[3] !== -1) {
    keptRows = keptRows.filter((row) => row !== pivotRows[3]);
  } else if (pivotRows[2] !== -1 && pivotRows[3] === -1) {
    keptRows = keptRows.filter((row) => row !== pivotRows[2]);
  }

  // Get columns to keep (all except the legs)
  const keptCols = Array.from({ length: n }, (_, i) => i).filter(
    (col) => !legs.includes(col)
  );

  if (keptCols.length === 0) {
    if (keptRows.length === 0) {
      return new GF2([[0]]);
    }
    return new GF2([[1]]);
  }

  if (keptRows.length === 0) {
    return GF2.zeros(1, keptCols.length);
  }

  // Create new matrix with kept rows and columns
  const result = new GF2(
    keptRows.map((row) => keptCols.map((col) => mx.get(row, col)))
  );

  // Perform final Gaussian elimination
  const finalResult = GF2.gauss(result, { noswaps: true });

  // Remove any zero rows
  const nonZeroRows = [];
  for (let i = 0; i < finalResult.shape[0]; i++) {
    let hasNonZero = false;
    for (let j = 0; j < finalResult.shape[1]; j++) {
      if (finalResult.get(i, j) === 1) {
        hasNonZero = true;
        break;
      }
    }
    if (hasNonZero) {
      nonZeroRows.push(i);
    }
  }

  return new GF2(nonZeroRows.map((row) => finalResult.getRow(row)));
}

// Helper function to create block diagonal matrix
export function block_diag(...matrices: number[][][]): number[][] {
  const rows = matrices.reduce((sum, mat) => sum + mat.length, 0);
  const cols = matrices.reduce((sum, mat) => sum + mat[0].length, 0);
  const result = Array(rows)
    .fill(0)
    .map(() => Array(cols).fill(0));

  let rowOffset = 0;
  let colOffset = 0;

  for (const matrix of matrices) {
    for (let i = 0; i < matrix.length; i++) {
      for (let j = 0; j < matrix[0].length; j++) {
        result[rowOffset + i][colOffset + j] = matrix[i][j];
      }
    }
    rowOffset += matrix.length;
    colOffset += matrix[0].length;
  }

  return result;
}

export function is_gauss_equivalent(h1: GF2, h2: GF2): boolean {
  // Check if matrices have the same shape
  if (h1.shape[0] !== h2.shape[0] || h1.shape[1] !== h2.shape[1]) {
    return false;
  }

  // Perform Gaussian elimination on both matrices
  const h1_gauss = GF2.gauss(h1);
  const h2_gauss = GF2.gauss(h2);

  // Compare the resulting matrices
  return h1_gauss.equals(h2_gauss);
}
