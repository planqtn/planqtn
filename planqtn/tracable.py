"""The tracable module.

The Tracable class is the main abstract class to represent tracable mathematical objects like
weight enumerator tensor, like the `_PartiallyTracedEnumerator` class in `planqtn.tensor_network`
or parity check matrices, like [`StabilizerTensorEnumerator`][planqtn.StabilizerTensorEnumerator].
"""

import abc
from typing import List, Tuple, Generic, TypeVar

from planqtn.progress_reporter import DummyProgressReporter, ProgressReporter
from planqtn.tensor import TensorId, TensorLeg

Trace = Tuple[TensorId, TensorId, List[TensorLeg], List[TensorLeg]]
T = TypeVar("T", bound="Tracable")


class Tracable(abc.ABC, Generic[T]):
    """Represents a mathematical object that can be merged and tensored.

    This is an abstract base class that requires subclasses to implement methods
    for merging and tensoring operations, as well as properties to access
    the open legs, and node IDs of the object.
    """

    @property
    @abc.abstractmethod
    def open_legs(self) -> Tuple[TensorLeg, ...]:
        """Returns the list of open legs."""

    @property
    @abc.abstractmethod
    def node_ids(self) -> List[TensorId]:
        """Returns the list of node IDs."""

    @abc.abstractmethod
    def tensor_with(
        self,
        other: T,
        progress_reporter: ProgressReporter = DummyProgressReporter(),
        verbose: bool = False,
    ) -> T:
        """Returns the tensor product of this object with another.

        Args:
            other: The other object to tensor with.
            progress_reporter: An optional progress reporter to report progress.
            verbose: Whether to print verbose output during the operation.
        Returns:
            The tensored object.
        """

    @abc.abstractmethod
    def merge_with(
        self,
        other: T,
        join_legs1: Tuple[TensorLeg, ...],
        join_legs2: Tuple[TensorLeg, ...],
        progress_reporter: ProgressReporter = DummyProgressReporter(),
        verbose: bool = False,
    ) -> T:
        """Returns the result of tracing this object with another.

        Args:
          other: The other object to merge with.
          join_legs1: The legs of this object to join.
          join_legs2: The legs of the other object to join.
          progress_reporter: An optional progress reporter to report progress.
          verbose: Whether to print verbose output during the operation.
        Returns:
          The merged object.
        """
