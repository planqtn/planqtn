import abc
import contextlib
import sys
import time
import json
from typing import Any, Dict, Generator, Iterable

import attr
from tqdm import tqdm


@attr.s
class IterationState:
    desc: str = attr.ib()
    total_size: int = attr.ib()
    current_item: int = attr.ib(default=1)
    start_time: float = attr.ib(default=time.time())
    end_time: float | None = attr.ib(default=None)
    duration: float | None = attr.ib(default=None)
    avg_time_per_item: float | None = attr.ib(default=None)

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

    def to_dict(self) -> Dict[str, Any]:
        """Convert the IterationState to a dictionary for JSON serialization."""
        return {
            "desc": self.desc,
            "total_size": self.total_size,
            "current_item": self.current_item,
            "start_time": self.start_time,
            "end_time": self.end_time,
            "duration": self.duration,
            "avg_time_per_item": self.avg_time_per_item,
        }


class IterationStateEncoder(json.JSONEncoder):
    """Custom JSON encoder for IterationState objects."""

    def default(self, obj):
        if isinstance(obj, IterationState):
            return obj.to_dict()
        return super().default(obj)

    def __call__(self, obj):
        return self.encode(obj)


class ProgressReporter(abc.ABC):

    def __init__(self, sub_reporter: "ProgressReporter" = None):
        self.sub_reporter = sub_reporter
        self.iterator_stack = []

    @abc.abstractmethod
    def handle_result(self, result: Dict[str, Any]):
        pass

    def log_result(self, result: Dict[str, Any]):
        # Convert IterationState to dict in the result
        serializable_result = {}
        for key, value in result.items():
            if isinstance(value, IterationState):
                serializable_result[key] = value.to_dict()
            else:
                serializable_result[key] = value

        self.handle_result(serializable_result)
        if self.sub_reporter is not None:
            self.sub_reporter.log_result(serializable_result)

    def iterate(
        self, iterable: Iterable, desc: str, total_size: int
    ) -> Generator[Any, None, None]:
        iteration_state = IterationState(
            desc, start_time=time.time(), total_size=total_size
        )
        self.iterator_stack.append(iteration_state)
        if self.sub_reporter is not None:
            iterable = self.sub_reporter.iterate(iterable, desc, total_size)
        for item in iterable:
            iteration_state.update()
            for iterator in self.iterator_stack[:-1]:
                iterator.update(iterator.current_item)
            self.log_result(
                {"iteration": iteration_state, "level": len(self.iterator_stack)}
            )
            # print(f"{type(self)}: iteration_state {iteration_state} iterated! {item}")
            yield item

        iteration_state.end()
        self.log_result(
            {"iteration": iteration_state, "level": len(self.iterator_stack)}
        )
        self.iterator_stack.pop()

    def enter_phase(self, desc: str):
        @contextlib.contextmanager
        def phase_iterator():
            for i, item in enumerate(self.iterate(["item"], desc, total_size=1)):
                yield item

        return phase_iterator()

    def exit_phase(self):
        self.iterator_stack.pop()


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
            leave=False,
            mininterval=2 if total_size > 1e5 else 0.1,
        ):
            yield item

    def handle_result(self, result: Dict[str, Any]):
        pass


class DummyProgressReporter(ProgressReporter):
    def handle_result(self, result: Dict[str, Any]):
        pass

    def _current_state(self) -> Dict[str, Any]:
        return {}
