import abc
from typing import List, Tuple

from planqtn.progress_reporter import DummyProgressReporter, ProgressReporter
from planqtn.stabilizer_tensor_enumerator import TensorId, TensorLeg

Trace = Tuple[TensorId, TensorId, List[TensorLeg], List[TensorLeg]]


class Tracable(abc.ABC):
    @property
    @abc.abstractmethod
    def open_legs(self) -> List[TensorLeg]:
        pass

    @property
    @abc.abstractmethod
    def node_ids(self) -> List[TensorId]:
        pass

    @abc.abstractmethod
    def tensor_with(
        self,
        other: "Tracable",
        progress_reporter: ProgressReporter = DummyProgressReporter(),
        verbose: bool = False,
    ) -> "Tracable":
        pass

    @abc.abstractmethod
    def merge_with(
        self,
        other: "Tracable",
        join_legs1: List[TensorLeg],
        join_legs2: List[TensorLeg],
        progress_reporter: ProgressReporter = DummyProgressReporter(),
        verbose: bool = False,
    ) -> "Tracable":
        pass
