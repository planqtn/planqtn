# Optimized Contraction Schedules for Stabilizer Codes

In PlanqTN v0.1.0, tensor network contraction was done using [Cotengra](https://cotengra.readthedocs.io/)'s hyper-optimized tensor network contraction algorithms using "flops" as the minimizer. While these schedules still outperformed the brute force method, we noticed that Cotengra was not accurately estimating how costly a contraction would be, and therefore not giving the best results.


## How does Cotengra's flops calculation work?
In order to find a good contraction schedule, Cotengra will sample many different schedules and give them each a score, using the specified minimizer (flops in v0.1.0). It then returns the best schedule found. However, we noticed that, for the same code, there were vast differences in how long the contraction was taking. This led us to believe that Cotengra was having trouble accurately estimating the "score" of the contraction schedule.

Cotengra's flops calculation comes from multiplying the full dimensions of all the tensors. However, our tensors are sparse and therefore we suspected that a cost calculation based on the full dimensions is not accurate.

----- plot of default cotengra score for each representation here ---- 

As you can see, Cotengra gives the same score for a large range of contraction costs. Given the same traces but a different order, Cotengra's full dimensional cost calculation cannot tell the difference.


## Custom Cost Calculation for Stabilizer Codes
Calculating the parity check matrices throughout the contraction is relatively fast and can therefore help give us insight into how large the tensors will be throughout the contraction. At each step of the contraction, using only the parity check matrices and the legs that are left open, we can exactly calculate what the resulting tensor size will be as well as the number of flops it will take to calculate in our method.

### Size of weight enumerator polynomial <-> rank of parity check matrix
The biggest factor in how expensive a weight enumerator polynomial calculation will be is how large the intermediate tensors get. We found that we will know the exact size of these tensors are each step of the contraction simply from the parity check matrix. In PlanqTN versions v0.1.0 and v0.2.0, the weight enumerator polynomials are stored as dictionaries based on the Pauli operators acting on the open legs. So, the length of the polynomial depends on how many different combinations of Pauli operators are acting on the open legs. This means that a fully dense tensor would have 4^(# open legs). In almost every case, our tensors are not close to being fully dense, which is why Cotengra is unable to find the best contraction schedule.

We can know how many of these combinations we will have by only looking at the open legs of the parity check matrix (without brute force calculating all of the stabilizers). The rank of only those columns will be how many keys we will have in the tensor (2**rank). An example is shown below.

#### Example 1
Let's start with a parity check matrix given by:

H = [[X I X],
     [I I Z],
     [I X X]]

and given that the open legs are columns 1 and 2 (0-indexed). If we were to do the brute force calculation of our tensor, we would have to find all the stabilizers that the parity check matrix generates:

S = [[X I X],
     [I I I],
     [I I Z],
     [X I Y],
     [I X X],
     [I X Y],
     [X X I],
     [X X Z]]

Then find the keys representing the Pauli operators that are acting on the open legs (where the keys are 0, 1, 2, 3 corresponding to I, X, Y, Z respectively). These are: (0, 1), (0, 0), (0, 2), (0, 3), (1, 1), (1, 3), (1, 0), (1, 2). So, the size of our tensor will be 8. 

Instead of brute force calculating all of the stabilizer, we can calculate this length given only the parity check matrix. Take only the columns of the open legs:

H_open = [[I X],
          [I Z],
          [X X]]

The rank of this matrix is 3. So, we know the size of the tensor will be 2^3 = 8.

#### Example 2
Here is another example where we show the rank calculation is truly necessary.

H = [[X I X],
     [I I X],
     [I I Z]]

All stabilizers are:
S = [[X I X],
     [I I X],
     [X I I],
     [I I I],
     [I I Z],
     [I I Y],
     [X I Y],
     [X I Z]]

And the unique Pauli operator keys are this time: (0, 1), (0, 0), (0, 2), (0, 3). Notice how the length this time is only 4 since there are duplicated Pauli operators on the open legs.

This can be efficiently calculated again by looking only at the parity check matrix open columns:

H_open = [[I X],
          [I X],
          [I Z]]

The rank of this matrix is only 2, so we know the size of the tensor will be 2^2 = 4.
