# Tensor network contraction performance

PlanqTN v0.1.0 contracts tensor networks using
[Cotengra](https://cotengra.readthedocs.io/)'s hyper-optimized tensor network
contraction algorithms. The contraction is highly unoptimized though besides
that, in the following sense:

-   problems planned to solve in v0.2.0:
    -   the contraction schedule is not geared towards stabilizer codes
-   problems planned to solve in v0.3.0:
    -   the tensors are represented as simple dictionaries on Pauli operator
        keys - more optimal data structures are possible
    -   the trace of two legs is simply a double for loop looking for matching
        keys on the traced indices, there is no parallelism or GPU
        implementation yet, it's all in Python
    -   beyond the Cotengra schedule, there are no special reuse / caching of
        calculations, this is especially painful for tree tensor networks made
        of the same nodes (concatenation) which could be contracted much faster

However, we find that even with these caveats, the brute force method is much
slower than the Cotengra-based one. For example for a 5x5 rotated surface code:

```python

import planqtn.networks as pqn
import planqtn as pq
import time

distance = 3

code = pqn.RotatedSurfaceCodeTN(d=distance)
code.analyze_traces(cotengra=True)

start = time.time()
wep = (
    code
    .stabilizer_enumerator_polynomial()
)
print(wep)
print(time.time() - start)


brute_force_node = pqn.RotatedSurfaceCodeTN(d=distance).conjoin_nodes()

start = time.time()
wep = (
    brute_force_node
    .stabilizer_enumerator_polynomial(
        progress_reporter=pq.progress_reporter.TqdmProgressReporter(),
    )
)
print(wep)
print(time.time() - start)

```

For `distance=3` we get a factor of 2x savings:

```
{0:1, 2:4, 4:22, 6:100, 8:129}
0.031094074249267578
Brute force WEP calc for [[9, 1]] tensor (0, 0) - 8 generators: 100%|█████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████| 256/256 [00:00<00:00, 4128.14it/s]
{0:1, 2:4, 4:22, 6:100, 8:129}
0.06776118278503418
```

For `distance=5` we get the d=5 brute force version takes too long to even
execute, while the qLEGO one returns in 0.11 seconds:

```
{0:1, 2:8, 4:72, 6:534, 8:3715, 10:25816, 12:158448, 14:782532, 16:2726047, 18:5115376, 20:5136632, 22:2437206, 24:390829}
0.11705541610717773
Brute force WEP calc for [[25, 1]] tensor (0, 0) - 24 generators:   0%|▎                                                                                                                                 | 38383/16777216 [00:10<1:13:17, 3806.73it/s]
```
