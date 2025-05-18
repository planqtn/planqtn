export class GF2 {
  private matrix: number[][];

  constructor(matrix: number[][]) {
    this.matrix = matrix.map((row) => row.map((val) => val % 2));
  }

  get shape(): [number, number] {
    return [this.matrix.length, this.matrix[0]?.length || 0];
  }

  get [Symbol.toStringTag](): string {
    return this.toString();
  }

  toString(): string {
    return this.matrix.map((row) => `[${row.join(" ")}]`).join("\n");
  }

  copy(): GF2 {
    return new GF2(this.matrix.map((row) => [...row]));
  }

  static zeros(rows: number, cols: number): GF2 {
    return new GF2(
      Array(rows)
        .fill(0)
        .map(() => Array(cols).fill(0)),
    );
  }

  static ones(rows: number, cols: number): GF2 {
    return new GF2(
      Array(rows)
        .fill(0)
        .map(() => Array(cols).fill(1)),
    );
  }

  static eye(size: number): GF2 {
    const matrix = Array(size)
      .fill(0)
      .map(() => Array(size).fill(0));
    for (let i = 0; i < size; i++) {
      matrix[i][i] = 1;
    }
    return new GF2(matrix);
  }

  add(other: GF2): GF2 {
    if (this.shape[0] !== other.shape[0] || this.shape[1] !== other.shape[1]) {
      throw new Error("Matrix dimensions must match for addition");
    }
    return new GF2(
      this.matrix.map((row, i) =>
        row.map((val, j) => (val + other.matrix[i][j]) % 2),
      ),
    );
  }

  multiply(other: GF2): GF2 {
    if (this.shape[1] !== other.shape[0]) {
      throw new Error("Matrix dimensions must match for multiplication");
    }
    const result = Array(this.shape[0])
      .fill(0)
      .map(() => Array(other.shape[1]).fill(0));
    for (let i = 0; i < this.shape[0]; i++) {
      for (let j = 0; j < other.shape[1]; j++) {
        let sum = 0;
        for (let k = 0; k < this.shape[1]; k++) {
          sum += this.matrix[i][k] * other.matrix[k][j];
        }
        result[i][j] = sum % 2;
      }
    }
    return new GF2(result);
  }

  transpose(): GF2 {
    const result = Array(this.shape[1])
      .fill(0)
      .map(() => Array(this.shape[0]).fill(0));
    for (let i = 0; i < this.shape[0]; i++) {
      for (let j = 0; j < this.shape[1]; j++) {
        result[j][i] = this.matrix[i][j];
      }
    }
    return new GF2(result);
  }

  equals(other: GF2): boolean {
    if (this.shape[0] !== other.shape[0] || this.shape[1] !== other.shape[1]) {
      return false;
    }
    return this.matrix.every((row, i) =>
      row.every((val, j) => val === other.matrix[i][j]),
    );
  }

  get(row: number, col: number): number {
    return this.matrix[row][col];
  }

  set(row: number, col: number, value: number): void {
    this.matrix[row][col] = value % 2;
  }

  getRow(row: number): number[] {
    return [...this.matrix[row]];
  }

  setRow(row: number, values: number[]): void {
    if (values.length !== this.shape[1]) {
      throw new Error(
        `Row length ${values.length} does not match matrix width ${this.shape[1]}`,
      );
    }
    this.matrix[row] = values.map((v) => v % 2);
  }

  getColumn(col: number): number[] {
    return this.matrix.map((row) => row[col]);
  }

  swapRows(row1: number, row2: number): void {
    [this.matrix[row1], this.matrix[row2]] = [
      this.matrix[row2],
      this.matrix[row1],
    ];
  }

  swapColumns(col1: number, col2: number): void {
    for (let i = 0; i < this.shape[0]; i++) {
      [this.matrix[i][col1], this.matrix[i][col2]] = [
        this.matrix[i][col2],
        this.matrix[i][col1],
      ];
    }
  }

  addRowToRow(sourceRow: number, targetRow: number): void {
    for (let j = 0; j < this.shape[1]; j++) {
      this.matrix[targetRow][j] =
        (this.matrix[targetRow][j] + this.matrix[sourceRow][j]) % 2;
    }
  }

  addColumnToColumn(sourceCol: number, targetCol: number): void {
    for (let i = 0; i < this.shape[0]; i++) {
      this.matrix[i][targetCol] =
        (this.matrix[i][targetCol] + this.matrix[i][sourceCol]) % 2;
    }
  }

  toArray(): number[][] {
    return this.matrix;
  }

  static gauss(
    mx: GF2,
    options: { noswaps?: boolean; col_subset?: number[] } = {},
  ): GF2 {
    const { noswaps = false, col_subset } = options;
    const res = mx.copy();
    const [rows, cols] = res.shape;

    if (rows === 0 || cols === 0) {
      return res;
    }

    let idx = 0;
    const swaps: [number, number][] = [];

    const targetCols = col_subset || Array.from({ length: cols }, (_, i) => i);

    for (const c of targetCols) {
      if (c >= cols) {
        throw new Error(`Column ${c} does not exist in matrix`);
      }

      // Find first non-zero element in column starting from idx
      let pivot = -1;
      for (let i = idx; i < rows; i++) {
        if (res.get(i, c) === 1) {
          pivot = i;
          break;
        }
      }

      if (pivot === -1) {
        continue;
      }

      if (pivot !== idx) {
        res.swapRows(pivot, idx);
        swaps.push([pivot, idx]);
        pivot = idx;
      }

      // Find all rows with non-zero elements in this column
      const rowsToUpdate = [];
      for (let i = 0; i < rows; i++) {
        if (i !== pivot && res.get(i, c) === 1) {
          rowsToUpdate.push(i);
        }
      }

      // Update all rows at once
      for (const i of rowsToUpdate) {
        res.addRowToRow(pivot, i);
      }

      idx++;
      if (idx === rows) {
        break;
      }
    }

    if (noswaps) {
      for (const [pivot, idx] of swaps.reverse()) {
        res.swapRows(pivot, idx);
      }
    }

    return res;
  }

  /**
   * Returns true if all elements in the matrix are zero
   */
  isZero(): boolean {
    for (let i = 0; i < this.shape[0]; i++) {
      for (let j = 0; j < this.shape[1]; j++) {
        if (this.get(i, j) === 1) {
          return false;
        }
      }
    }
    return true;
  }

  /**
   * Creates an identity matrix of the specified size
   */
  static identity(size: number): GF2 {
    const matrix = Array(size)
      .fill(0)
      .map(() => Array(size).fill(0));
    for (let i = 0; i < size; i++) {
      matrix[i][i] = 1;
    }
    return new GF2(matrix);
  }

  /**
   * Performs Gaussian elimination on a matrix augmented with an identity matrix
   * @param mx The input matrix
   * @returns The reduced augmented matrix
   */
  static gauss_row_augmented(mx: GF2): GF2 {
    const [rows] = mx.shape;
    const res = mx.copy();
    // Create identity matrix of size rows x rows
    const identity = GF2.identity(rows);
    // Horizontally stack the matrices
    const augmented = new GF2(
      res.toArray().map((row, i) => [...row, ...identity.getRow(i)]),
    );
    return GF2.gauss(augmented, { noswaps: true });
  }

  /**
   * Computes the right kernel of the matrix
   */
  static right_kernel(matrix: GF2): GF2 {
    const [rows, cols] = matrix.shape;
    // Transpose the matrix before doing Gaussian elimination
    const reduced = GF2.gauss_row_augmented(matrix.transpose());

    // Find zero rows in the left part of the matrix
    const zeroRows = [];
    for (let i = 0; i < cols; i++) {
      let isZeroRow = true;
      for (let j = 0; j < rows; j++) {
        if (reduced.get(i, j) === 1) {
          isZeroRow = false;
          break;
        }
      }
      if (isZeroRow) {
        zeroRows.push(i);
      }
    }

    if (zeroRows.length === 0) {
      // An invertible matrix will have the trivial nullspace
      return new GF2([Array(cols).fill(0)]);
    }

    // Return the right part of the zero rows
    return new GF2(zeroRows.map((row) => reduced.getRow(row).slice(rows)));
  }

  public getMatrix(): number[][] {
    return this.matrix;
  }
}
