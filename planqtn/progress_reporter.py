"""Progress reporter interface and implementations for calculations.

The main class is `ProgressReporter` which is an abstract base class for all progress reporters.

The main methods are:

- [iterate][planqtn.progress_reporter.ProgressReporter.iterate]: Iterates over an iterable and
    reports progress on every item.
- [enter_phase][planqtn.progress_reporter.ProgressReporter.enter_phase]: Starts a new phase.
- [exit_phase][planqtn.progress_reporter.ProgressReporter.exit_phase]: Ends the current phase.

The main implementations are:

- [TqdmProgressReporter][planqtn.progress_reporter.TqdmProgressReporter]: A progress reporter that
  uses `tqdm` to report progress in the terminal.
- [DummyProgressReporter][planqtn.progress_reporter.DummyProgressReporter]: A progress reporter that
  does nothing.

This is the main mechanism for reporting progress back to PlanqTN Studio UI from the backend jobs
in realtime.
"""

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
    """State tracking information for a single iteration phase.

    This class tracks the progress and timing information for a single iteration
    or calculation phase. It maintains statistics like current progress, timing,
    and performance metrics that can be used for progress reporting and analysis.

    Attributes:
        desc: Description of the current iteration phase.
        total_size: Total number of items to process in this iteration.
        current_item: Current item being processed (0-indexed).
        start_time: Timestamp when the iteration started.
        end_time: Timestamp when the iteration ended (None if not finished).
        duration: Total duration of the iteration in seconds (None if not finished).
        avg_time_per_item: Average time per item in seconds (None if no items processed).
    """

    desc: str = attr.ib()
    total_size: int = attr.ib()
    current_item: int = attr.ib(default=0)
    start_time: float = attr.ib(default=time.time())
    end_time: float | None = attr.ib(default=None)
    duration: float | None = attr.ib(default=None)
    avg_time_per_item: float | None = attr.ib(default=None)

    def update(self, current_item: int | None = None) -> None:
        """Update the iteration state with progress information.

        Updates the current item count, recalculates duration, and updates
        the average time per item. If no current_item is provided, increments
        the current item by 1.

        Args:
            current_item: New current item index. If None, increments by 1.
        """
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
        """Mark the iteration as completed.

        Sets the end time and calculates the final duration and average time
        per item statistics.
        """
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
        """Convert the IterationState to a dictionary for JSON serialization.

        Returns:
            Dict[str, Any]: Dictionary representation of the iteration state
                suitable for JSON serialization.
        """
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
    """Custom JSON encoder for IterationState objects.

    This encoder extends the standard JSON encoder to handle IterationState
    objects by converting them to dictionaries using their to_dict() method.
    This enables JSON serialization of progress reporting data.
    """

    def default(self, o: Any) -> Any:
        """Convert IterationState objects to dictionaries for JSON serialization.

        Args:
            o: Object to encode.

        Returns:
            Any: Dictionary representation if o is an IterationState,
                 otherwise delegates to parent class.
        """
        if isinstance(o, IterationState):
            return o.to_dict()
        return super().default(o)

    def __call__(self, o: Any) -> str:
        """Encode an object to JSON string.

        Args:
            o: Object to encode.

        Returns:
            str: JSON string representation of the object.
        """
        return self.encode(o)


class ProgressReporter(abc.ABC):
    """Abstract base class for progress reporting in calculations.

    This class provides a framework for reporting progress during long-running
    calculations. It supports nested iteration phases and can be composed with
    other progress reporters. The main mechanism for reporting progress back to
    PlanqTN Studio UI from backend jobs in realtime.

    Subclasses should implement the `handle_result` method to define how progress
    information is processed (e.g., displayed, logged, or sent to a UI).

    Attributes:
        sub_reporter: Optional nested progress reporter for composition.
        iterator_stack: Stack of active iteration states for nested phases.
        iteration_report_frequency: Minimum time interval between progress reports.
    """

    def __init__(
        self,
        sub_reporter: Optional["ProgressReporter"] = None,
        iteration_report_frequency: float = 0.0,
    ):
        """Initialize the progress reporter.

        Args:
            sub_reporter: Optional nested progress reporter for composition.
            iteration_report_frequency: Minimum time interval between progress
                reports in seconds. If 0.0, reports on every iteration.
        """
        self.sub_reporter = sub_reporter
        self.iterator_stack: list[IterationState] = []
        self.iteration_report_frequency = iteration_report_frequency

    def __enter__(self) -> "ProgressReporter":
        return self

    def __exit__(self, exc_type: Any, exc_value: Any, traceback: Any) -> None:
        pass

    @abc.abstractmethod
    def handle_result(self, result: Dict[str, Any]) -> None:
        """Handle progress result data.

        This hook method must be implemented by subclasses to define how progress
        information is processed. The result dictionary contains iteration state
        and metadata about the current progress.

        Args:
            result: Dictionary containing progress information including:
                - iteration: IterationState object or dict
                - level: Nesting level of the current iteration
                - Additional metadata specific to the implementation
        """

    def log_result(self, result: Dict[str, Any]) -> None:
        """Log progress result and propagate to sub-reporter.

        Converts IterationState objects to dictionaries for serialization,
        calls the handle_result method, and propagates the result to any
        nested sub-reporter.

        Args:
            result: Dictionary containing progress information.
        """
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
        """Start a new iteration phase with progress reporting.

        Creates a generator that yields items from the iterable while tracking
        progress and reporting it at regular intervals. The iteration state is
        maintained on a stack to support nested iterations.

        Args:
            iterable: The iterable to iterate over.
            desc: Description of the iteration phase.
            total_size: Total number of items to process.

        Yields:
            Items from the iterable.
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
        """Enter a new calculation phase with progress tracking.

        Creates a context manager for tracking a single-step phase. This is
        useful for marking the beginning and end of calculation phases that
        don't involve iteration but should still be tracked for progress reporting.

        Args:
            desc: Description of the phase.

        Returns:
            Context manager that can be used with 'with' statement.
        """

        @contextlib.contextmanager
        def phase_iterator() -> Generator[Any, None, None]:
            yield from self.iterate(["item"], desc, total_size=1)

        return phase_iterator()

    def exit_phase(self) -> None:
        """Exit the current calculation phase.

        Removes the current iteration state from the stack, effectively
        ending the current phase. This is typically called automatically
        when using the context manager from enter_phase().
        """
        self.iterator_stack.pop()


class TqdmProgressReporter(ProgressReporter):
    """Progress reporter that displays progress using `tqdm` progress bars.

    This implementation uses the `tqdm` library to display progress bars in the
    terminal. It's useful for command-line applications and provides visual
    feedback during long-running calculations.

    Attributes:
        file: Output stream for the progress bars (default: sys.stdout).
        mininterval: Minimum time interval between progress bar updates.
    """

    def __init__(
        self,
        file: TextIO = sys.stdout,
        mininterval: float | None = None,
        sub_reporter: Optional["ProgressReporter"] = None,
    ):
        """Initialize the `tqdm` progress reporter.

        Args:
            file: Output stream for progress bars (default: sys.stdout).
            mininterval: Minimum time interval between updates in seconds.
                If None, uses 2 seconds for large iterations (>100k items)
                or 0.1 seconds for smaller ones.
            sub_reporter: Optional nested progress reporter for composition.
        """
        super().__init__(sub_reporter)
        self.file = file
        self.mininterval = mininterval

    def iterate(
        self, iterable: Iterable, desc: str, total_size: int
    ) -> Generator[Any, None, None]:
        """Iterate with `tqdm` progress bar display.

        Overrides the parent iterate method to wrap the iteration with a `tqdm`
        progress bar that provides visual feedback in the terminal.

        Args:
            iterable: The iterable to iterate over.
            desc: Description for the progress bar.
            total_size: Total number of items to process.

        Yields:
            Items from the iterable.
        """
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
        """Handle progress result (no-op for `tqdm` reporter).

        The `tqdm` reporter doesn't need to handle results separately since
        the progress is displayed through the `tqdm` progress bar.

        Args:
            result: Progress result dictionary (ignored).
        """


class DummyProgressReporter(ProgressReporter):
    """A no-op progress reporter that does nothing.

    This implementation provides a null progress reporter that can be used
    when progress reporting is not needed. It implements all required methods
    but performs no actual reporting, making it useful as a default or for
    testing purposes or creating a silent mode for scripts to run.
    """

    def handle_result(self, result: Dict[str, Any]) -> None:
        """Handle progress result (no-op for dummy reporter).

        The dummy reporter ignores all progress results, making it useful
        when progress reporting is not needed.

        Args:
            result: Progress result dictionary (ignored).
        """
