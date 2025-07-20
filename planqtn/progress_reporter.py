import abc
import contextlib
import json
import sys
import time
from contextlib import _GeneratorContextManager
from typing import Any, Dict, Generator, Iterable, Optional, TextIO

import attr
from tqdm import tqdm


@attr.s
class IterationState:
    desc: str = attr.ib()
    total_size: int = attr.ib()
    current_item: int = attr.ib(default=0)
    start_time: float = attr.ib(default=time.time())
    end_time: float | None = attr.ib(default=None)
    duration: float | None = attr.ib(default=None)
    avg_time_per_item: float | None = attr.ib(default=None)

    def update(self, current_item: int | None = None) -> None:
        if current_item is None:
            current_item = self.current_item + 1
        self.current_item = current_item
        self.duration = time.time() - self.start_time
        self._update_avg_time_per_item()

    def _update_avg_time_per_item(self) -> None:
        if self.current_item == 0:
            self.avg_time_per_item = None
        elif self.current_item is not None and self.duration is not None:
            self.avg_time_per_item = self.duration / self.current_item

    def end(self) -> None:
        self.end_time = time.time()
        self.duration = self.end_time - self.start_time
        self._update_avg_time_per_item()

    def __repr__(self) -> str:
        return (
            f"Iteration(desc={self.desc}, current_item={self.current_item}, "
            f"total_size={self.total_size}, duration={self.duration}, "
            f"avg_time_per_item={self.avg_time_per_item}), "
            f"start_time={self.start_time}, end_time={self.end_time}"
        )

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

    def default(self, o: Any) -> Any:
        if isinstance(o, IterationState):
            return o.to_dict()
        return super().default(o)

    def __call__(self, o: Any) -> Any:
        return self.encode(o)


class ProgressReporter(abc.ABC):

    def __init__(
        self,
        sub_reporter: Optional["ProgressReporter"] = None,
        iteration_report_frequency: float = 0.0,
    ):
        self.sub_reporter = sub_reporter
        self.iterator_stack: list[IterationState] = []
        self.iteration_report_frequency = iteration_report_frequency

    def __enter__(self) -> "ProgressReporter":
        return self

    def __exit__(self, exc_type: Any, exc_value: Any, traceback: Any) -> None:
        pass

    @abc.abstractmethod
    def handle_result(self, result: Dict[str, Any]) -> None:
        pass

    def log_result(self, result: Dict[str, Any]) -> None:
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
        """Starts a new iteration.

        Returns an iterator (generator) over the iterable and reports progress on every item.
        """

        bottom_iterator_state = IterationState(
            desc, start_time=time.time(), total_size=total_size
        )
        self.iterator_stack.append(bottom_iterator_state)

        if self.sub_reporter is not None:
            iterable = self.sub_reporter.iterate(iterable, desc, total_size)
        time_last_report = time.time()
        for item in iterable:
            yield item
            bottom_iterator_state.update()
            if time.time() - time_last_report > self.iteration_report_frequency:
                time_last_report = time.time()

                self.log_result(
                    {
                        "iteration": bottom_iterator_state,
                        "level": len(self.iterator_stack),
                    }
                )
            # higher level iterators need to be updated, this is just
            # a hack to ensure that the timestamps and avg time per item
            # is updated for all iterators
            for higher_iterator in self.iterator_stack[:-1]:
                higher_iterator.update(higher_iterator.current_item)
            # print(
            #     f"{type(self)}: iteration_state {bottom_iterator_state} iterated! {item}"
            # )

        bottom_iterator_state.end()
        self.log_result(
            {"iteration": bottom_iterator_state, "level": len(self.iterator_stack)}
        )
        self.iterator_stack.pop()

    def enter_phase(self, desc: str) -> _GeneratorContextManager[Any, None, None]:
        @contextlib.contextmanager
        def phase_iterator() -> Generator[Any, None, None]:
            yield from self.iterate(["item"], desc, total_size=1)

        return phase_iterator()

    def exit_phase(self) -> None:
        self.iterator_stack.pop()


class TqdmProgressReporter(ProgressReporter):
    def __init__(
        self,
        file: TextIO = sys.stdout,
        mininterval: float | None = None,
        sub_reporter: Optional["ProgressReporter"] = None,
    ):
        super().__init__(sub_reporter)
        self.file = file
        self.mininterval = mininterval

    def iterate(
        self, iterable: Iterable, desc: str, total_size: int
    ) -> Generator[Any, None, None]:
        t = tqdm(
            desc=desc,
            total=total_size,
            iterable=super().iterate(iterable, desc, total_size),
            file=self.file,
            # leave=False,
            mininterval=(
                self.mininterval
                if self.mininterval is not None
                else 2 if total_size > 1e5 else 0.1
            ),
        )
        yield from t
        t.close()

    def handle_result(self, result: Dict[str, Any]) -> None:
        pass


class DummyProgressReporter(ProgressReporter):

    def handle_result(self, result: Dict[str, Any]) -> None:
        pass
