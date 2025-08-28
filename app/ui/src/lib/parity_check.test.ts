import { Legos } from "../features/lego/Legos";
import { GF2 } from "./GF2";
import {
  block_diag,
  conjoin,
  self_trace,
  tensor_product
} from "./parity_check";

describe("parity_check", () => {
  it("should handle empty matrices as input", () => {
    const h1 = new GF2([[]]);
    const h2 = new GF2([[]]);

    expect(conjoin(h1, h2).equals(new GF2([[1]]))).toBe(true);
  });

  it("should conjoin single trace 422 codes", () => {
    const h1 = new GF2([
      [1, 1, 1, 1, 0, 0, 0, 0],
      [0, 0, 0, 0, 1, 1, 1, 1]
    ]);
    const h2 = new GF2([
      [1, 1, 1, 1, 0, 0, 0, 0],
      [0, 0, 0, 0, 1, 1, 1, 1]
    ]);

    const expected = new GF2([
      [1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 1, 1]
    ]);

    expect(conjoin(h1, h2).equals(expected)).toBe(true);
  });

  it("should conjoin single trace 713 code with 422 code", () => {
    const h1 = new GF2([
      [1, 0, 1, 0, 1, 0, 1, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 1, 0, 1, 0, 1, 0, 1],
      [0, 0, 0, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0],
      [0, 1, 1, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1],
      [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 1, 1]
    ]);

    const h2 = new GF2([
      [1, 1, 1, 1, 0, 0, 0, 0],
      [0, 0, 0, 0, 1, 1, 1, 1]
    ]);

    const expected = GF2.gauss(
      // prettier-ignore
      new GF2([
                //# h1[0, x]       # h2[0, x]     # h1[0, z]       # h2[0, z]
                [0, 1, 0, 1, 0, 1,   1, 1, 1,      0, 0, 0, 0, 0, 0,  0, 0, 0 ],
                // # h1[1, x]       # h2[1, x]     # h1[1, z]       # h2[1, z]                
                [0, 0, 0, 0, 0, 0,   0, 0, 0,      0, 1, 0, 1, 0, 1,  1, 1, 1],                  
                [0, 0, 0, 0, 0, 0,   0, 0, 0,      0, 0, 1, 1, 1, 1,  0, 0, 0],
                [0, 0, 0, 0, 0, 0,   0, 0, 0,      1, 1, 0, 0, 1, 1,  0, 0, 0],
                [0, 0, 1, 1, 1, 1,   0, 0, 0,      0, 0, 0, 0, 0, 0,  0, 0, 0],  
                [1, 1, 0, 0, 1, 1,   0, 0, 0,      0, 0, 0, 0, 0, 0,  0, 0, 0],                    
      ])
    );

    const result = GF2.gauss(conjoin(h1, h2));
    // console.log("Actual result:");
    // console.log(sstr(result));
    // console.log("Expected result:");
    // console.log(sstr(expected));
    expect(result.equals(expected)).toBe(true);
  });

  it("should conjoin single trace 713 code with 713 code", () => {
    const h1 = new GF2([
      [1, 0, 1, 0, 1, 0, 1, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 1, 0, 1, 0, 1, 0, 1],
      [0, 0, 0, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0],
      [0, 1, 1, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1],
      [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 1, 1]
    ]);

    const h2 = new GF2([
      [1, 0, 1, 0, 1, 0, 1, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 1, 0, 1, 0, 1, 0, 1],
      [0, 0, 0, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0],
      [0, 1, 1, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1],
      [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 1, 1]
    ]);

    const expected = new GF2([
      [0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0, 1],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0],
      [0, 0, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [1, 1, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 1, 1]
    ]);

    const result = GF2.gauss(conjoin(h1, h2));

    expect(result.equals(GF2.gauss(expected))).toBe(true);
  });

  it("should perform self trace correctly", () => {
    const h = new GF2([
      [1, 1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0],
      [0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1],
      [0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 1],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 1]
    ]);

    const expected = new GF2([
      [1, 1, 1, 1, 0, 0, 0, 0],
      [0, 0, 0, 0, 1, 0, 0, 1],
      [0, 0, 0, 0, 0, 1, 0, 1]
    ]);

    const result = self_trace(h);
    expect(result.equals(expected)).toBe(true);

    const h2 = new GF2([
      [1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 1, 0, 0, 1, 0],
      [0, 0, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 0, 1]
    ]);

    const expected2 = new GF2([
      [1, 1, 1, 1, 0, 0, 0, 0],
      [0, 0, 0, 0, 1, 0, 1, 0],
      [0, 0, 0, 0, 0, 1, 0, 1]
    ]);

    const result2 = self_trace(h2);
    expect(result2.equals(expected2)).toBe(true);
  });

  it("should conjoin with no error correcting on h1", () => {
    const h1 = new GF2([
      [1, 0, 1, 0, 0, 0],
      [0, 0, 0, 1, 1, 1]
    ]);

    const h2 = new GF2([
      [0, 1, 1, 0, 0, 0],
      [0, 0, 0, 1, 1, 0]
    ]);

    const expected = new GF2([
      [0, 0, 0, 0, 1, 1, 1, 0],
      [0, 0, 1, 1, 0, 0, 0, 0],
      [1, 1, 0, 0, 0, 0, 0, 0]
    ]);

    const result = conjoin(h1, h2, 1, 0);
    expect(result.equals(expected)).toBe(true);
  });

  it("should create a block diagonal matrix", () => {
    const h1 = new GF2([
      [1, 0, 1],
      [0, 0, 0]
    ]);
    const h2 = new GF2([
      [1, 1, 1],
      [0, 0, 0]
    ]);
    const result = block_diag(h1.toArray(), h2.toArray());

    const expected = [
      [1, 0, 1, 0, 0, 0],
      [0, 0, 0, 0, 0, 0],
      [0, 0, 0, 1, 1, 1],
      [0, 0, 0, 0, 0, 0]
    ];
    expect(result).toEqual(expected);
  });

  it("should calculate the tensor product of two CSS symplectic matrices", () => {
    const h1 = new GF2([
      [1, 0, 1, 0, 0, 0],
      [0, 0, 0, 1, 1, 1]
    ]);
    const h2 = new GF2([
      [1, 1, 1, 0, 0, 0],
      [0, 0, 0, 0, 1, 1]
    ]);
    const result = tensor_product(h1, h2);

    const expected = new GF2([
      [1, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 1, 1, 1, 0, 0, 0],
      [0, 0, 0, 1, 1, 1, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1]
    ]);

    expect(result.equals(expected)).toBe(true);
  });

  it("should calculate the tensor product of two non-CSS symplectic matrices", () => {
    const h1 = new GF2([
      [1, 0, 1, 0, 0, 1],
      [0, 1, 0, 1, 1, 1]
    ]);
    const h2 = new GF2([
      [1, 1, 1, 1, 0, 0],
      [0, 0, 1, 0, 1, 1]
    ]);
    const result = tensor_product(h1, h2);

    const expected = new GF2([
      [1, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0],
      [0, 1, 0, 0, 0, 0, 1, 1, 1, 0, 0, 0],
      [0, 0, 0, 1, 1, 1, 0, 0, 0, 1, 0, 0],
      [0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 1]
    ]);

    expect(result.equals(expected)).toBe(true);
  });

  it("should conjoin to zero", () => {
    const h1 = new GF2([[1, 0]]);
    const h2 = new GF2([[0, 1]]);
    const result = conjoin(h1, h2, 0, 0);
    expect(result).toEqual(new GF2([[0]]));
  });

  it("should conjoin to one", () => {
    const h1 = new GF2([[1, 0]]);
    const h2 = new GF2([[1, 0]]);
    const result = conjoin(h1, h2, 0, 0);
    expect(result).toEqual(new GF2([[1]]));
  });

  it("should tensor product of identity stopper with a regular lego", () => {
    const h1 = new GF2([[0, 0]]);
    const h2 = new GF2([[1, 0]]);
    const result = tensor_product(h1, h2);
    expect(result).toEqual(new GF2([[0, 1, 0, 0]]));
  });

  it("should tensor product of regular lego with identity stopper", () => {
    const h1 = new GF2([[1, 0]]);
    const h2 = new GF2([[0, 0]]);
    const result = tensor_product(h1, h2);
    expect(result).toEqual(new GF2([[1, 0, 0, 0]]));
  });

  it("should tensor product of scalar 0 with a stopper lego should be 0", () => {
    const zero = new GF2([[0]]);
    const h2 = new GF2([[1, 0]]);
    const result = tensor_product(zero, h2);
    expect(result).toEqual(new GF2([[0]]));
  });

  it("should tensor product of scalar 0 with a regular lego should be 0", () => {
    const zero = new GF2([[0]]);
    const z3 = new GF2(Legos.z_rep_code(3));
    const result = tensor_product(zero, z3);
    expect(result).toEqual(new GF2([[0]]));
  });

  it("should tensor product of scalar 1 with a regular lego should be the regular lego", () => {
    const h1 = new GF2([[1]]);
    const h2 = new GF2([[1, 0]]);
    const result = tensor_product(h1, h2);
    expect(result).toEqual(new GF2([[1, 0]]));
  });

  it("should conjoin two free qubits", () => {
    const h1 = new GF2([[0, 0]]);
    const h2 = new GF2([[0, 0]]);
    const result = conjoin(h1, h2, 0, 0);
    expect(result).toEqual(new GF2([[1]]));
  });

  it("should conjoin a free qubit with a regular lego", () => {
    const h1 = new GF2([[0, 0]]);
    const h2 = new GF2([
      [1, 1, 0, 0],
      [0, 0, 1, 1]
    ]);
    const result = conjoin(h1, h2, 0, 0);
    expect(result).toEqual(new GF2([[0, 0]]));
  });
});

describe("GF2 Linear Algebra Tests", () => {
  test("right kernel test case 1", () => {
    const mx = new GF2([
      [0, 1, 0],
      [1, 0, 0],
      [0, 0, 1]
    ]);
    const kernel = GF2.right_kernel(mx);
    // The kernel should be a 1x3 matrix
    expect(kernel.shape).toEqual([1, 3]);
    expect(kernel.equals(new GF2([[0, 0, 0]]))).toBe(true);
    // The product should be a 3x1 zero matrix
    const product = mx.multiply(kernel.transpose());
    expect(product.shape).toEqual([3, 1]);
    expect(product.isZero()).toBe(true);
  });

  test("right kernel test case 2", () => {
    const mx = new GF2([
      [0, 1, 0],
      [0, 1, 0],
      [0, 0, 1]
    ]);
    const kernel = GF2.right_kernel(mx);
    expect(kernel.equals(new GF2([[1, 0, 0]]))).toBe(true);
    // The kernel should be a 1x3 matrix
    expect(kernel.shape).toEqual([1, 3]);
    // The product should be a 3x1 zero matrix
    const product = mx.multiply(kernel.transpose());
    expect(product.shape).toEqual([3, 1]);
    expect(product.isZero()).toBe(true);
  });

  test("gauss with noswaps", () => {
    const mx = new GF2([
      [0, 1, 0],
      [1, 0, 0],
      [0, 0, 1]
    ]);
    const result = GF2.gauss(mx, { noswaps: true });
    // The result should have the same shape and elements as the input
    expect(result.shape).toEqual(mx.shape);
    expect(result.equals(mx)).toBe(true);
    expect(GF2.gauss(mx, { noswaps: false })).toEqual(GF2.identity(3));
  });

  test("gauss with column subset", () => {
    const mx = new GF2([
      [1, 1, 0],
      [0, 1, 1],
      [0, 0, 1]
    ]);
    const result = GF2.gauss(mx, { col_subset: [0, 1] });
    expect(result).toEqual(
      new GF2([
        [1, 0, 1],
        [0, 1, 1],
        [0, 0, 1]
      ])
    );
  });

  test("gauss with column subset fail to extract", () => {
    const mx = new GF2([
      [1, 1, 0],
      [1, 1, 1],
      [0, 0, 1]
    ]);
    const result = GF2.gauss(mx, { col_subset: [0, 1] });
    expect(result).toEqual(
      new GF2([
        [1, 1, 0],
        [0, 0, 1],
        [0, 0, 1]
      ])
    );
  });

  test("self_trace_edge_case_with_repeated_pivot_row_removal_1", () => {
    const mx = new GF2([
      [0, 0, 1, 1, 0, 0, 0, 1, 1, 0, 0, 1, 0, 0, 0, 0, 0, 1],
      [1, 0, 0, 1, 0, 0, 0, 1, 1, 0, 1, 1, 0, 1, 1, 0, 1, 1],
      [0, 0, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 1, 0, 0, 1, 0],
      [0, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 0, 0, 1, 0, 1, 0, 0],
      [0, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 1, 1, 1]
    ]);
    const result = self_trace(mx, 1, 2);
    expect(result).toEqual(
      new GF2([
        [0, 0, 0, 0, 1, 0, 1, 0, 0, 1, 0, 0, 1, 0],
        [0, 0, 0, 1, 0, 1, 0, 0, 0, 1, 0, 1, 0, 0],
        [0, 0, 1, 0, 0, 1, 0, 0, 0, 1, 0, 1, 1, 1]
      ])
    );
  });

  test("self_trace_edge_case_with_repeated_pivot_row_removal_2", () => {
    const mx = new GF2([
      [1, 1, 0, 0, 1, 0, 0, 0, 1, 0, 1, 1, 1, 1, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 1, 1, 1, 0, 1, 0, 0, 0, 0, 0, 1, 1],
      [0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0],
      [0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0]
    ]);

    const result = self_trace(mx, 4, 5);
    expect(result).toEqual(
      new GF2([
        [0, 0, 0, 0, 1, 1, 1, 0, 1, 0, 0, 0, 1, 1],
        [0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
        [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0],
        [0, 0, 0, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 0]
      ])
    );
  });
});
