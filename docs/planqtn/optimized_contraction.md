# Optimized Contraction Schedules for Stabilizer Codes

In PlanqTN v0.1.0, tensor network contraction was done using [Cotengra](https://cotengra.readthedocs.io/)'s hyper-optimized tensor network contraction algorithms using "combo" (flops and write) as the minimizer. While these schedules still outperformed the brute force method, we noticed that Cotengra was not accurately estimating how costly a contraction would be, and therefore not giving the best results.


## Cotengra Score Calculation
To identify an efficient contraction schedule, Cotengra samples many different trees and assigns each a score according to the chosen minimizer. It then selects the best-scoring schedule. However, in our experiments we observed large differences in actual contraction time between schedules that Cotengra scored identically. This suggests that the scoring heuristic was not accurately capturing the true cost of contraction.

Cotengra’s default “combo” scoring is defined as the sum of two metrics: (i) **flops**, the estimated number of scalar multiplications, computed from the full tensor dimensions; and (ii) **write**, the estimated total size of all intermediate tensors. While this measure is effective for dense tensor networks, it becomes misleading for our setting because the tensors are highly sparse. Both the flops count and intermediate sizes are calculated as though every tensor entry is nonzero, leading to overestimation and a lack of differentiation between contraction orders.

The figure below demonstrates this issue. Each color corresponds to a different tensor netwok and each point within the color corresponds to a samples contraction schedule for the tensor network. The x-axis shows the score that Cotengra's "combo" function gave the given contraction schedule and the y-axis shows the actual number of operations was required to contract the network. The scores tend to show up as vertical lines, meaning that all schedules for a given network are assigned essentially the same score, regardless of order, even though their actual computational costs vary significantly. This demonstrates that Cotengra’s default minimization criteria cannot reliably distinguish between contraction orders when applied to sparse tensor networks.

<center>
<img src="/docs/fig/default_scatter_results.png" width="30%">
</center>


## Custom Cost Calculation for Stabilizer Code Tensor Networks
The biggest factor in how expensive a tensor network contraction will be is the size of the intermediate tensors. In our setting, evaluating parity check matrices throughout a contraction is relatively inexpensive, and it provides powerful information about how large intermediate tensors will become. By using only the parity check matrices and the specification of open legs, we can exactly compute both the size of the resulting tensor and the number of floating-point operations (flops) required by our current contraction method.

### Tensor Size from Parity Check Matrices
In PlanqTN (versions v0.1.0 and v0.2.0), weight enumerator polynomials are stored as dictionaries. The keys are tuples of Pauli operators acting on the open legs. A fully dense tensor with *n* open legs would therefore contain $4^n$ keys. In practice, our tensors are very sparse.

The key insight is that the number of keys can be determined without brute force enumeration of stabilizers. Let *H* be the parity check matrix, and $H_{open}$ denote the submatrix containing only the columns of *H* corresponding to the open legs. Then, the number of unique keys is exactly:

$$
\text{Tensor size} = 2^{\text{rank}(H_{\text{open}})}
$$

This avoids explicit stabilizer enumeration and immediately yields the tensor size.

#### Example 1
Let's start with a parity check matrix given by:

$$
H = \begin{pmatrix}
X & I & X \\
I & I & Z \\
I & X & X
\end{pmatrix}
$$

The open legs are columns 1 and 2 (0-indexed). Brute force stabilizer generation yields 8 unique keys. Instead, restricting to the open legs gives:

$$
H_{open} = \begin{pmatrix}
I & X \\
I & Z \\
X & X
\end{pmatrix}
$$

which has rank 3. $2^3 = 8$, which is consistent with the brute force result.

#### Example 2
$$
H = \begin{pmatrix}
X & I & X \\
I & I & X \\
I & I & Z
\end{pmatrix}
$$

The open columns are again 1 and 2. Here, brute force yields only 4 unique keys. From

$$
H_{open} = \begin{pmatrix}
I & X \\
I & X \\
I & Z
\end{pmatrix}
$$

we compute $rank(H_{open})$ = 2, resulting in tensor size: $2^2 = 4$. This again matches the brute force calculation.

### Ratio of Matching Keys
The second factor in contraction cost is how many keys from two tensors match when they are merged. In our implementation, merging proceeds by iterating over the keys of both tensors and performing an operation only if all open-leg operators agree.

We can determine the fraction of matching keys using only the parity check matrices. Specifically:

1. Extract the columns corresponding to the join legs.
2. Form their tensor product (two columns in standard form, or four in symplectic form).
3. Generate all stabilizers of this small product matrix (at most 16).
4. The ratio of stabilizers consistent across both join legs equals the ratio of matching keys during contraction.

#### Example
Define two tensors we want to merge by their parity check matrices:

$$
H_{1} = \begin{pmatrix}
X & X & X \\
Z & I & Z
\end{pmatrix}, \quad
H_{2} = \begin{pmatrix}
X & I & I & X \\
I & X & X & X \\
Z & I & Z & Z
\end{pmatrix}
$$

Tensor 1 has open legs at columns 0 and 1. Tensor 2 has open legs at columns 0, 1, 2. Suppose we join column 2 of each tensor. The tensor product of these columns yields:

$$
H_{prod} = \begin{pmatrix}
X & I \\
I & I \\
I & X \\
I & I
\end{pmatrix}
$$

Stabilizer generation gives: 

```
S = {XI, XX, IX, II}
```

Two out of the four stabilizers match on both join legs, so the matching ratio is $m = 0.5$.

### Final Cost Expression
Combining these two ingredients, the cost of a merge operation is

$$
\text{Cost} = 2^{r_1 + r_2}*m
$$

where $r_1$ and $r_2$ are the ranks of the open-leg submatrices of the two tensors, and $m$ is the matching ratio determined from the join legs.

This metric yields an exact calculation of the contraction cost. When used as a cost function in Cotengra’s contraction path optimizer, it produces significantly improved contraction schedules. The figure below shows that our custom score correlates far more closely with the true contraction cost than the default heuristic.


<center>
<img src="/docs/fig/custom_scatter_results.png" width="30%">
</center>

-- then also the bar chart of results -- 