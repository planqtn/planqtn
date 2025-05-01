import time
import logging
import sys

# logging.basicConfig(stream=sys.stdout, level=logging.INFO)
# logger = logging.getLogger(__name__)
# logger.info("Started")

from server.tasks import long_running_task


if __name__ == "__main__":

    from server.tasks import celery_app

    task = long_running_task.apply_async(args=[1, {"number_of_legos": 10}])
    print("task", task.id)
    while task.ready() == False:
        print("task", task.id, "is not ready", task.state)
        time.sleep(1)

    print(celery_app.control.inspect().registered())
    print(task.result)
    print(task.state)
    # logger.info("Finished")
