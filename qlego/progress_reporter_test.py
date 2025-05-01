from io import StringIO
from typing import Any, Dict

import pytest
from tqdm import tqdm
from qlego.progress_reporter import (
    IterationState,
    ProgressReporter,
    TqdmProgressReporter,
)


class ConcatenatingProgressReporter(ProgressReporter):

    def __init__(self, sub_reporter: ProgressReporter = None):
        super().__init__(sub_reporter)
        self.history = []

    def handle_result(self, result: Dict[str, Any]):
        self.history.append(result)

    def _current_state(self) -> Dict[str, Any]:
        return {"history": self.history, "iterator_stack": self.iterator_stack}


def test_progress_reporter_simple_progressor():

    pr = ConcatenatingProgressReporter()
    pr.log_result({"a": 1})
    pr.log_result({"b": 2})
    pr.log_result({"c": 3})

    for i in pr.iterate([1, 2, 3], "test desc", 3):
        print(pr._current_state())

    assert pr.history[:3] == [
        {"a": 1},
        {"b": 2},
        {"c": 3},
    ]

    for h in pr.history:
        print(h)
    assert "iteration" in pr.history[3]
    iteration_entry = pr.history[3]["iteration"]
    assert iteration_entry["current_item"] == 1
    assert iteration_entry["duration"] > 0
    assert iteration_entry["avg_time_per_item"] == iteration_entry["duration"]

    assert "iteration" in pr.history[4]
    iteration_entry = pr.history[4]["iteration"]
    assert iteration_entry["current_item"] == 2
    assert iteration_entry["duration"] > 0
    assert iteration_entry["avg_time_per_item"] == iteration_entry["duration"] / 2

    iteration_entry = pr.history[5]["iteration"]
    assert iteration_entry["current_item"] == 3
    assert iteration_entry["duration"] > 0
    assert iteration_entry["avg_time_per_item"] == iteration_entry["duration"] / 3


def test_progress_reporter_empty_iterator():
    pr = ConcatenatingProgressReporter()

    # Test empty iterator
    for _ in pr.iterate([], "empty test", 0):
        pass

    assert len(pr.history) == 1
    assert "iteration" in pr.history[0]
    iteration_entry = pr.history[0]["iteration"]
    assert iteration_entry["current_item"] == 0
    assert iteration_entry["total_size"] == 0
    assert iteration_entry["duration"] >= 0
    assert (
        iteration_entry["avg_time_per_item"] is None
    )  # Should be None for empty iterator


def test_progress_reporter_nested_iterations():
    pr = ConcatenatingProgressReporter()

    # Test 2 levels of nesting
    for i in pr.iterate([1, 2], "outer", 2):
        for j in pr.iterate([3, 4], f"{i}.inner", 2):
            pass

    # Should have 2 finished iteration entries (inner and outer)
    assert len(pr.history) == 9, "History:\n" + "\n".join(
        str(item) for item in pr.history
    )

    print("\n".join(str(item) for item in pr.history))
    # Check inner iterations
    inner_iteration = pr.history[0]["iteration"]
    assert pr.history[0]["level"] == 2
    assert inner_iteration["desc"] == "1.inner"
    assert inner_iteration["current_item"] == 1
    assert inner_iteration["total_size"] == 2
    assert inner_iteration["duration"] > 0
    assert inner_iteration["end_time"] is None
    assert inner_iteration["start_time"] is not None
    assert inner_iteration["avg_time_per_item"] is not None

    inner_iteration = pr.history[1]["iteration"]
    assert pr.history[1]["level"] == 2
    assert inner_iteration["desc"] == "1.inner"
    assert inner_iteration["current_item"] == 2
    assert inner_iteration["total_size"] == 2
    assert inner_iteration["duration"] > 0
    assert inner_iteration["end_time"] is None
    assert inner_iteration["start_time"] is not None
    assert inner_iteration["avg_time_per_item"] is not None

    inner_iteration = pr.history[2]["iteration"]
    assert pr.history[1]["level"] == 2
    assert inner_iteration["desc"] == "1.inner"
    assert inner_iteration["current_item"] == 2
    assert inner_iteration["total_size"] == 2
    assert inner_iteration["duration"] > 0
    assert inner_iteration["start_time"] is not None
    assert inner_iteration["end_time"] is not None
    assert inner_iteration["avg_time_per_item"] is not None

    # Check outer iteration
    outer_iteration = pr.history[3]["iteration"]
    assert pr.history[2]["level"] == 2
    assert outer_iteration["desc"] == "outer"
    assert outer_iteration["current_item"] == 1
    assert outer_iteration["total_size"] == 2
    assert outer_iteration["duration"] > 0
    assert outer_iteration["avg_time_per_item"] is not None

    # Test 3 levels of nesting
    pr = ConcatenatingProgressReporter()
    for i in pr.iterate([1], "level1", 1):
        for j in pr.iterate([2], "level2", 1):
            for k in pr.iterate([3], "level3", 1):
                pass

    # Should have 3 finished iteration entries
    assert len(pr.history) == 6

    # Check level3 iteration
    level3 = pr.history[0]["iteration"]
    assert pr.history[0]["level"] == 3
    assert level3["desc"] == "level3"
    assert level3["current_item"] == 1
    assert level3["total_size"] == 1

    # Check level3 iteration end message
    level2 = pr.history[1]["iteration"]
    assert pr.history[1]["level"] == 3
    assert level2["desc"] == "level3"
    assert level2["current_item"] == 1
    assert level2["total_size"] == 1

    # Check level2 iteration
    level1 = pr.history[2]["iteration"]
    assert pr.history[2]["level"] == 2
    assert level1["desc"] == "level2"
    assert level1["current_item"] == 1
    assert level1["total_size"] == 1

    # Check level2 iteration end message
    level1 = pr.history[3]["iteration"]
    assert pr.history[3]["level"] == 2
    assert level1["desc"] == "level2"
    assert level1["current_item"] == 1
    assert level1["total_size"] == 1

    # Check level1 iteration
    level1 = pr.history[4]["iteration"]
    assert pr.history[4]["level"] == 1
    assert level1["desc"] == "level1"
    assert level1["current_item"] == 1

    # Check level1 iteration end message
    level1 = pr.history[5]["iteration"]
    assert pr.history[5]["level"] == 1
    assert level1["desc"] == "level1"
    assert level1["current_item"] == 1
    assert level1["total_size"] == 1


def test_tqdm_progress_reporter_returns_iterable():
    output = StringIO()

    pr = TqdmProgressReporter(file=output, mininterval=0)
    res = [i for i in pr.iterate([1, 2, 3], "test desc", 3)]

    assert res == [1, 2, 3]

    assert "100%" in output.getvalue()
    assert "test desc" in output.getvalue()
    assert "#####" in output.getvalue()
    assert "3/3" in output.getvalue()
    assert "it/s" in output.getvalue()


def test_tqdm_progress_reporter_as_sub_reporter():
    output = StringIO()

    pr = TqdmProgressReporter(file=output, mininterval=0)
    pr2 = ConcatenatingProgressReporter(pr)
    res = [i for i in pr2.iterate([1, 2, 3], "test desc", 3)]

    print(res)
    print("History:")
    for h in pr2.history:
        print(h)
    assert res == [1, 2, 3]

    assert pr2.history[0]["level"] == 1
    assert pr2.history[0]["iteration"]["desc"] == "test desc"
    assert pr2.history[0]["iteration"]["current_item"] == 1

    tqdm_output = output.getvalue()
    print("TQDM output:")
    print(tqdm_output)

    assert "100%" in tqdm_output
    assert "test desc" in tqdm_output
    assert "#####" in tqdm_output
    assert "3/3" in tqdm_output
    assert "it/s" in tqdm_output
