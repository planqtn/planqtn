import { TensorNetwork } from "../types";

export function generateConstructionCode(tensorNetwork: TensorNetwork): string {
  const code: string[] = [];

  // Add imports
  code.push(
    "from qlego.stabilizer_tensor_enumerator import StabilizerCodeTensorEnumerator",
  );
  code.push("from qlego.tensor_network import TensorNetwork");
  code.push("from galois import GF2");
  code.push("");

  // Create nodes dictionary
  code.push("# Create nodes");
  code.push("nodes = {");
  for (const lego of tensorNetwork.legos) {
    const matrix = lego.parity_check_matrix.map((row) =>
      row.map((val) => `${val}`).join(", "),
    );
    code.push(
      `    "${lego.instanceId}": StabilizerCodeTensorEnumerator(idx="${lego.instanceId}", h=GF2([`,
    );
    for (const row of matrix) {
      code.push(`            [${row}],`);
    }
    code.push(`          ]),`);

    code.push(`    ),`);
  }
  code.push("}");
  code.push("");

  // Create tensor network
  code.push("# Create tensor network");
  code.push("tn = TensorNetwork(nodes)");
  code.push("");

  // Add traces
  code.push("# Add traces");
  for (const conn of tensorNetwork.connections) {
    code.push(
      `tn.self_trace("${conn.from.legoId}", "${conn.to.legoId}", [${conn.from.legIndex}], [${conn.to.legIndex}])`,
    );
  }

  return code.join("\n");
}
