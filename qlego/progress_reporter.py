import abc
import sys
import time
from typing import Any, Dict, Generator, Iterable

from tqdm import tqdm


class IterationState:
    def __init__(self, desc: str, total_size: int):
        self.desc = desc
        self.total_size = total_size
        self.current_item = 1
        self.start_time = time.time()
        self.end_time = None
        self.duration = None
        self.avg_time_per_item = None

    def update(self, current_item: int = None):
        if current_item is None:
            current_item = self.current_item + 1
        self.current_item = current_item
        self.duration = time.time() - self.start_time
        self._update_avg_time_per_item()

    def _update_avg_time_per_item(self):
        if self.current_item == 1:
            self.avg_time_per_item = None
        else:
            self.avg_time_per_item = self.duration / (self.current_item - 1)

    def end(self):
        self.end_time = time.time()
        self.duration = self.end_time - self.start_time
        self._update_avg_time_per_item()

    def __repr__(self):
        return f"Iteration(desc={self.desc}, current_item={self.current_item}, total_size={self.total_size}, duration={self.duration}, avg_time_per_item={self.avg_time_per_item}), start_time={self.start_time}, end_time={self.end_time}"


class ProgressReporter(abc.ABC):

    def __init__(self, sub_reporter: "ProgressReporter" = None):
        self.sub_reporter = sub_reporter
        self.iterator_stack = []

    @abc.abstractmethod
    def handle_result(self, result: Dict[str, Any]):
        pass

    @abc.abstractmethod
    def _current_state(self) -> Dict[str, Any]:
        pass

    def log_result(self, result: Dict[str, Any]):
        self.handle_result(result)
        if self.sub_reporter is not None:
            self.sub_reporter.log_result(result)

    def iterate(
        self, iterable: Iterable, desc: str, total_size: int
    ) -> Generator[Any, None, None]:
        iteration_state = IterationState(desc, total_size)
        self.iterator_stack.append(iteration_state)
        if self.sub_reporter is not None:
            iterable = self.sub_reporter.iterate(iterable, desc, total_size)
        for item in iterable:
            yield item
            iteration_state.update()
        iteration_state.end()
        self.iterator_stack.pop()
        self.log_result(
            {"iteration": iteration_state, "level": len(self.iterator_stack)}
        )


class TqdmProgressReporter(ProgressReporter):
    def __init__(self, file=sys.stdout, sub_reporter: "ProgressReporter" = None):
        super().__init__(sub_reporter)
        self.file = file

    def iterate(
        self, iterable: Iterable, desc: str, total_size: int
    ) -> Generator[Any, None, None]:
        for item in tqdm(
            desc=desc,
            total=total_size,
            iterable=super().iterate(iterable, desc, total_size),
            file=self.file,
        ):
            yield item

    def _current_state(self) -> Dict[str, Any]:
        raise NotImplementedError("TqdmProgressReporter does not support state")

    def handle_result(self, result: Dict[str, Any]):
        pass


class DummyProgressReporter(ProgressReporter):
    def handle_result(self, result: Dict[str, Any]):
        pass

    def _current_state(self) -> Dict[str, Any]:
        return {}
