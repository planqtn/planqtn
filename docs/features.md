# Features

At the moment PlanqTN is nascent and has rough edges, a lot more features are
planned including logical operators, non-Pauli symmetries, operator pushing,
more graph state transformations, representing parameterized code families, a
public database to share tensor network constructions and weight enumerators. If
you have more ideas,
[open an issue](https://github.com/planqtn/planqtn/issues/new), we'd love to
hear it!

<table>
<thead>
<tr>
<th>Feature</th>
<th>Library</th>
<th>Studio</th>
</tr>
</thead>
<tbody>

<tr>
<td colspan="3" style="background-color: var(--md-default-bg-color--lightest); font-weight: bold; padding: 12px; border-top: 2px solid var(--md-primary-fg-color);"><strong>Build tensor networks</strong> - Create and construct tensor networks from basic components</td>
</tr>
<tr>
<td>Create a tensor network manually from smaller encoding tensors with predefined Pauli stabilizers.</td>
<td><a href="/docs/planqtn/reference#planqtn">Library docs</a></td>
<td><a href="/docs/planqtn-studio/build">Studio docs</a></td>
</tr>
<tr>
<td>Create a custom LEGO based on parity check matrix.</td>
<td><a href="/docs/planqtn/reference/#planqtn.StabilizerCodeTensorEnumerator">Library docs</a></td>
<td><a href="/docs/planqtn-studio/build/#creating-custom-tensors">Studio docs</a></td>
</tr>
<tr>
<td>Undo/redo for most operations.</td>
<td>-</td>
<td><a href="/docs/planqtn-studio/build">Studio docs</a></td>
</tr>

<tr>
<td colspan="3" style="background-color: var(--md-default-bg-color--lightest); font-weight: bold; padding: 12px; border-top: 2px solid var(--md-primary-fg-color);"><strong>Transform tensor networks</strong> - Apply various transformations to modify and manipulate tensor networks</td>
</tr>
<tr>
<td>Fuse LEGOs into a single LEGO.</td>
<td>-</td>
<td><a href="/docs/planqtn-studio/transform/#fusing-legos">Studio docs</a></td>
</tr>
<tr>
<td><strong>ZX calculus transformations on Z and X repetition code LEGOs:</strong></td>
<td>-</td>
<td><a href="/docs/planqtn-studio/transform/#zx-calculus-transformations">Studio docs</a></td>
</tr>
<tr>
<td style="padding-left: 2em;">Fuse legos.</td>
<td>-</td>
<td><a href="/docs/planqtn-studio/transform/#zx-calculus-transformations">Studio docs</a></td>
</tr>
<tr>
<td style="padding-left: 2em;">Bialgebra and inverse bialgebra rule.</td>
<td>-</td>
<td><a href="/docs/planqtn-studio/ui-controls/#bialgebra-and-inverse-bialgebra">Studio docs</a></td>
</tr>
<tr>
<td style="padding-left: 2em;">Unfuse:</td>
<td>-</td>
<td><a href="/docs/planqtn-studio/transform/#zx-calculus-transformations">Studio docs</a></td>
</tr>
<tr>
<td style="padding-left: 4em;">Pull out a leg of the same color.</td>
<td>-</td>
<td><a href="/docs/planqtn-studio/ui-controls/#pull-out-a-leg-of-the-same-color">Studio docs</a></td>
</tr>
<tr>
<td style="padding-left: 4em;">Unfuse to legs.</td>
<td>-</td>
<td><a href="/docs/planqtn-studio/ui-controls/#unfuse-to-legs">Studio docs</a></td>
</tr>
<tr>
<td style="padding-left: 4em;">Unfuse to two LEGOs.</td>
<td>-</td>
<td><a href="/docs/planqtn-studio/ui-controls/#unfuse-to-2-legos">Studio docs</a></td>
</tr>
<tr>
<td style="padding-left: 2em;">Change color by adding Hadamard LEGOs on legs.</td>
<td>-</td>
<td><a href="/docs/planqtn-studio/ui-controls/#change-color">Studio docs</a></td>
</tr>
<tr>
<td><strong>Graph state transformations:</strong> Z-repetition code LEGOs are graph nodes that need to be connected through links with a Hadamard LEGO on it.</td>
<td>-</td>
<td><a href="/docs/planqtn-studio/transform/#graph-state-transformations">Studio docs</a></td>
</tr>
<tr>
<td style="padding-left: 2em;">Create complete graph from nodes.</td>
<td>-</td>
<td><a href="/docs/planqtn-studio/ui-controls/#complete-graph-through-hadamards">Studio docs</a></td>
</tr>
<tr>
<td style="padding-left: 2em;">Connect nodes with a central node.</td>
<td>-</td>
<td><a href="/docs/planqtn-studio/ui-controls/#connect-via-central-lego">Studio docs</a></td>
</tr>
<tr>
<td>"Resize" groups of LEGOs - reposition based on the resized bounding box of selected LEGOs.</td>
<td>-</td>
<td><a href="/docs/planqtn-studio/transform/#visual-transformations">Studio docs</a></td>
</tr>

<tr>
<td colspan="3" style="background-color: var(--md-default-bg-color--lightest); font-weight: bold; padding: 12px; border-top: 2px solid var(--md-primary-fg-color);"><strong>Analyze tensor networks</strong> - Perform calculations and analysis on tensor networks including weight enumerators and operator pushing-based highlighting</td>
</tr>
<tr>
<td><strong>Zero installation calculations:</strong> PlanqTN Studio is deployed as a <a href="/docs/planqtn-studio/runtimes/#free-planqtn-cloud-runtime">cloud native architecture on Google Cloud and Supabase</a>, and you can run small calculations for free! </td>
<td>-</td>
<td><a href="docs/planqtn-studio/analyze/">Studio docs</a></td>
</tr>
<tr>
<td>Local kernel using Docker, with Kubernetes and Supabase to run jobs only limited by your resources. </td>
<td>-</td>
<td><a href="/docs/planqtn-studio/runtimes/#local-runtime">Studio docs</a></td>
</tr>
<tr>
<td>Calculate Pauli stabilizers (parity check matrix) of a tensor network.</td>
<td><a href="/docs/planqtn/reference/#planqtn.TensorNetwork.conjoin_nodes">Library docs</a></td>
<td><a href="/docs/planqtn-studio/analyze/#calculate-pauli-stabilizers-of-a-tensor-network">Studio docs</a></td>
</tr>
<tr>
<td>Calculate coset weight enumerators.</td>
<td><a href="/docs/planqtn/reference/#planqtn.TensorNetwork.set_coset">Library docs</a></td>
<td>-</td>
</tr>
<tr>
<td><strong>Weight enumerator polynomial calculations:</strong></td>
<td><a href="/docs/planqtn/reference/#planqtn.TensorNetwork.stabilizer_enumerator_polynomial">Library docs</a></td>
<td><a href="/docs/planqtn-studio/analyze/#weight-enumerator-polynomial-calculations">Studio docs</a></td>
</tr>
<tr>
<td style="padding-left: 2em;">Brute force scalar weight enumerator polynomial (WEP) for a single tensor.</td>
<td><a href="/docs/planqtn/reference/#planqtn.StabilizerCodeTensorEnumerator.stabilizer_enumerator_polynomial">Library docs</a></td>
<td><a href="/docs/planqtn-studio/analyze/#weight-enumerator-polynomial-calculations">Studio docs</a></td>
</tr>
<tr>
<td style="padding-left: 2em;">Tensor WEP for a single tensor with specified open legs.</td>
<td><a href="/docs/planqtn/reference/#planqtn.StabilizerCodeTensorEnumerator.stabilizer_enumerator_polynomial">Library docs</a></td>
<td><a href="/docs/planqtn-studio/analyze/#weight-enumerator-polynomial-calculations">Studio docs</a></td>
</tr>
<tr>
<td style="padding-left: 2em;">Truncated WEP - only calculate up to a certain weight, this speeds up the contraction significantly, making the tensors very sparse.</td>
<td><a href="/docs/planqtn/reference/#planqtn.StabilizerCodeTensorEnumerator.stabilizer_enumerator_polynomial">Library docs</a></td>
<td><a href="/docs/planqtn-studio/analyze/#weight-enumerator-polynomial-calculations">Studio docs</a></td>
</tr>
<tr>
<td style="padding-left: 2em;">MacWilliams dual (normalizer WEP) for scalar WEP.</td>
<td><a href="/docs/planqtn/reference/#planqtn.UnivariatePoly.macwilliams_dual">Library docs</a></td>
<td><a href="/docs/planqtn-studio/analyze/#weight-enumerator-polynomial-calculations">Studio docs</a></td>
</tr>
<tr>
<td style="padding-left: 2em;">Using <a href="https://cotengra.readthedocs.io/">Cotengra</a> calculate a hyper-optimized contraction schedule for any tensor network.</td>
<td><a href="/docs/planqtn/contraction/">Library docs</a></td>
<td><a href="/docs/planqtn-studio/analyze/#weight-enumerator-polynomial-calculations">Studio docs</a></td>
</tr>
<tr>
<td><strong>Operator pushing and matching:</strong></td>
<td>-</td>
<td><a href="/docs/planqtn-studio/analyze/#operator-pushing-and-matching">Studio docs</a></td>
</tr>
<tr>
<td style="padding-left: 2em;">Highlighting tensor network stabilizer legs (dangling legs).</td>
<td>-</td>
<td><a href="/docs/planqtn-studio/analyze/#operator-pushing-and-matching">Studio docs</a></td>
</tr>
<tr>
<td style="padding-left: 2em;">Highlight local stabilizers on individual tensors.</td>
<td>-</td>
<td><a href="/docs/planqtn-studio/analyze/#operator-pushing-and-matching">Studio docs</a></td>
</tr>
<tr>
<td>Export tensor network as Python code and continue working on it on your own computer.</td>
<td>-</td>
<td><a href="/docs/planqtn-studio/analyze/#export-to-continue-analysis-on-your-computer">Studio docs</a></td>
</tr>
<tr>
<td>Export parity check matrices as numpy array.</td>
<td>-</td>
<td><a href="/docs/planqtn-studio/analyze/#export-to-continue-analysis-on-your-computer">Studio docs</a></td>
</tr>
<tr>
<td>Export parity check matrix for QDistRnd for distance calculations.</td>
<td>-</td>
<td><a href="/docs/planqtn-studio/analyze/#export-to-continue-analysis-on-your-computer">Studio docs</a></td>
</tr>
<tr>
<td>Run multiple jobs in parallel.</td>
<td>-</td>
<td><a href="/docs/planqtn-studio/analyze/">Studio docs</a></td>
</tr>

<tr>
<td colspan="3" style="background-color: var(--md-default-bg-color--lightest); font-weight: bold; padding: 12px; border-top: 2px solid var(--md-primary-fg-color);"><strong>Share tensor networks</strong> - Export and share tensor network constructions</td>
</tr>
<tr>
<td>Share/save your canvas as JSON file.</td>
<td>-</td>
<td><a href="/docs/planqtn-studio/share/">Studio docs</a></td>
</tr>
<tr>
<td>Share/bookmark your canvas as a URL.</td>
<td>-</td>
<td><a href="/docs/planqtn-studio/share/">Studio docs</a></td>
</tr>

</tbody>
</table>
