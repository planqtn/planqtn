# Optimized Contraction Schedules for Stabilizer Codes

In PlanqTN v0.1.0, tensor network contraction was done using [Cotengra](https://cotengra.readthedocs.io/)'s hyper-optimized tensor network contraction algorithms using "flops" as the minimizer. While these schedules still outperformed the brute force method, we noticed that Cotengra was not accurately estimating how costly a contraction would be, and therefore not giving the best results.


## Cotengra flops calculation
In order to find a good contraction schedule, Cotengra will sample many different schedules and give them each a score, using the specified minimizer (flops in v0.1.0). It then returns the best schedule found. However, we noticed that, for the same code, there were vast differences in how long the contraction was taking. This led us to believe that Cotengra was having trouble accurately estimating the "score" of the contraction schedule.

Cotengra's flops calculation comes from multiplying the full dimensions of all the tensors. However, our tensors are very sparse and therefore we suspected that a cost calculation based on the full dimensions would not be accurate.


<center>
<img src="/docs/fig/default_scatter_results.png" width="30%">
</center>


As you can see, Cotengra can generally approximate the cost, but fails when differentiating between different contraction orders for the same tensor network.


## Custom Cost Calculation for Stabilizer Codes
Calculating the parity check matrices throughout the contraction is relatively fast and can therefore help give us insight into how large the tensors will be throughout the contraction. At each step of the contraction, using only the parity check matrices and the legs that are left open, we can exactly calculate what the resulting tensor size will be as well as the number of flops it will take to calculate with our current method.

### Size of weight enumerator polynomial <-> rank of parity check matrix
The biggest factor in how expensive a tensor network contraction will be is how large the intermediate tensors get. We found that we will know the exact size of these tensors at each step of the contraction simply from the parity check matrix. In PlanqTN versions v0.1.0 and v0.2.0, the weight enumerator polynomials are stored as dictionaries based on the Pauli operators acting on the open legs. The keys of this dictionary are tuples that represent the Pauli operators that act on the open legs. So, the length of the tensor depends on how many different combinations of these Pauli operators keys we have. This means that a fully dense tensor would have $4^{n}$ where n is the number of open legs. In almost every case, our tensors are not close to being fully dense.

We can know how many keys (so the length of the tensor) we will have by only looking at the open legs of the parity check matrix without brute force calculating all of the stabilizers. The number of keys is exactly $2^r$ where r is the rank of the matrix consisting only of the columns corresponding to open legs. An example is shown below.

#### Example 1
Let's start with a parity check matrix given by:

$$
H = \begin{pmatrix}
X & I & X \\
I & I & Z \\
I & X & X
\end{pmatrix}
$$

and given that the open legs are columns 1 and 2 (0-indexed). If we were to do the brute force calculation of our tensor, we would have to find all the stabilizers that the parity check matrix generates:

```
S = {XIX, III, IIZ, XIY, IXX, IXY, XXI, XXZ}
```
Then find the keys representing the Pauli operators acting on the open legs (where the keys are 0, 1, 2, 3 corresponding to I, X, Y, Z respectively). These are: (0, 1), (0, 0), (0, 2), (0, 3), (1, 1), (1, 3), (1, 0), (1, 2). So, the size of our tensor will be 8. 

Instead of finding all of the stabilizers, we can calculate this length given only the parity check matrix. Take only the columns of the open legs:

$$
H_{open} = \begin{pmatrix}
I & X \\
I & Z \\
X & X
\end{pmatrix}
$$

The rank of this matrix is 3, meaning we have 3 independent generators. So, we know the number of unique combinations of Pauli operators will be the number of stabilizers that are generated: $2^3 = 8$.

#### Example 2
Here is another example where we show the rank calculation makes a difference.

$$
H = \begin{pmatrix}
X & I & X \\
I & I & X \\
I & I & Z
\end{pmatrix}
$$

All stabilizers are:
```
S = {XIX, IIX, III,  IIZ, IIY, XIY, XIZ}
```
The unique Pauli operator keys are this time: (0, 1), (0, 0), (0, 2), (0, 3). Notice how the length this time is only 4 since there are duplicated Pauli operators on the open legs.

This can be efficiently calculated again by looking only at the parity check matrix open columns:

$$
H_{open} = \begin{pmatrix}
I & X \\
I & X \\
I & Z
\end{pmatrix}
$$


The rank of this matrix is only 2, so we know the size of the tensor will be $2^2 = 4$.

### Ratio of Matching Keys
The next key to finding the exact tensor network contraction cost is how many of the keys will match when merging two tensors. This is implemented by a double for loop over the tensor keys and only performing an operation if all elements of the keys match. 

We will know exactly how many of the keys will match given only the parity check matrices and the legs that are being joined. First, find the columns of each parity check matrix that corresponds to the legs being joined and find their tensor product. This will result in a matrix with two columns (1 join leg from each tensor), or 4 if in symplectic form. Then, generate all stabilizers (will be a maximum of 16) and find the ratio of stabilizers that match on both join legs. This ratio will be the same as when we are enumerating the full tensors during the actual contraction. 

#### Example
Define two tensors we want to merge by their parity check matrices:

$$
H_{1} = \begin{pmatrix}
X & X & X \\
Z & I & Z
\end{pmatrix}
$$

$$
H_{2} = \begin{pmatrix}
X & I & I & X \\
I & X & X & X \\
Z & I & Z & Z
\end{pmatrix}
$$


Tensor 1 has two open legs (the first two). Tensor 2 has 3 open legs (the first three). The join legs are the second column of each tensor: [[X], [I]] and [[I], [X], [I]]. Next, compute their tensor product:

$$
H_{prod} = \begin{pmatrix}
X & I \\
I & I \\
I & X \\
I & I
\end{pmatrix}
$$

Generate all stabilizers from these generators: 

```
S = {XI, XX, IX, II}
```

$2/4 = 0.5$ of the stabilizers match on both join legs. So, we know that half of the keys in our tensors will match as well. 

### Putting it all together
In our current weight enumerator polynomial calculation, the tensors get merged in a specific order given by Cotengra. To merge these tensors, we use a double for loop over the keys and skip if not all of the legs match in the keys. So, cost for a merge operation is given by:

 $Cost = 2^{r_1 + r_2} * m$ 
 
 $r_1$ and $r_2$ are the ranks calculated from the open legs and m is the matching stabilizer ratio calculated from the join legs. 

This metric exactly calculates the cost of our contraction and when given to Cotengra to minimize, we get much better contraction schedules. Below is a plot showing how our custom score much more accurately calculates the cost of the contraction.

<center>
<img src="/docs/fig/custom_scatter_results.png" width="30%">
</center>

-- then also the bar chart of results -- 