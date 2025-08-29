from typing import Dict, Tuple

from planqtn.poly import UnivariatePoly


TensorId = str | int | Tuple[int, int]
"""The tensor id can be a string, an integer, or a tuple of two integers."""

TensorLeg = Tuple[TensorId, int]
"""The tensor leg is a tuple of a tensor id and a leg index."""

TensorEnumeratorKey = Tuple[int, ...]
"""The tensor enumerator key is a tuple of integers."""

TensorEnumerator = Dict[TensorEnumeratorKey, UnivariatePoly]
"""The tensor enumerator is a dictionary of tuples of integers and univariate polynomials."""
