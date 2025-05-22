import argparse
import json
import logging
import os
import sys
import traceback
from typing import Optional
from planqtn_jobs.task import SupabaseCredentials
from planqtn_jobs.weight_enum_task import WeightEnumeratorTask
from planqtn_jobs.task_store import SupabaseTaskStore


def main():
    parser = argparse.ArgumentParser(
        description="Calculate weight enumerator from various sources"
    )
    parser.add_argument("--task-uuid", help="UUID of the task in Supabase")
    parser.add_argument("--user-id", help="User ID for Supabase")
    parser.add_argument("--input-file", help="Path to JSON file containing the request")
    parser.add_argument(
        "--task-store-url",
        help="Supabase URL (required for task-uuid and storing results)",
    )
    parser.add_argument(
        "--task-store-key",
        help="Supabase key (required for task-uuid and storing results)",
    )

    parser.add_argument(
        "--realtime", action="store_true", help="Enable realtime updates"
    )
    parser.add_argument(
        "--local-progress-bar", action="store_true", help="Enable local progress bar"
    )
    parser.add_argument(
        "--realtime-update-frequency",
        type=float,
        default=5,
        help="Update frequency for realtime updates",
    )
    parser.add_argument(
        "--output-file",
        help="Path to file to save the result, if not specified, the result will be printed to the console",
    )
    parser.add_argument("--debug", action="store_true", help="Enable debug mode")
    args = parser.parse_args()

    if args.task_uuid and args.input_file:
        print("Error: Cannot specify both task-uuid and input-file")
        sys.exit(1)

    if not args.task_uuid and not args.input_file:
        print("Error: Must specify either task-uuid or input-file")
        sys.exit(1)

    if args.task_uuid and not args.user_id:
        print("Error: User ID required for task-uuid mode")
        sys.exit(1)

    # check runtime context
    runtime_supabase_url = os.environ.get("RUNTIME_SUPABASE_URL", args.task_store_url)
    runtime_supabase_key = os.environ.get("RUNTIME_SUPABASE_KEY", args.task_store_key)

    if (
        args.realtime
        and not (runtime_supabase_url and runtime_supabase_key)
        and not args.task_uuid
    ):
        print(
            "Error: Task UUID mode and task store credentials required for realtime updates (or env vars RUNTIME_SUPABASE_URL/KEY)"
        )
        sys.exit(1)

    # check user context

    if args.task_uuid and not (args.task_store_url and args.task_store_key):
        print("Error: Task store credentials required for task-uuid mode")
        sys.exit(1)

    root = logging.getLogger()
    root.setLevel(
        logging.DEBUG if args.debug else logging.INFO
    )  # Set the minimum logging level

    # Create a StreamHandler to output to stdout
    handler = logging.StreamHandler(sys.stdout)
    handler.setLevel(logging.DEBUG if args.debug else logging.INFO)

    # Create a formatter to customize the log message format
    formatter = logging.Formatter(
        "%(asctime)s - %(name)s - %(levelname)s - %(message)s"
    )
    handler.setFormatter(formatter)

    # Add the handler to the root logger
    root.addHandler(handler)
    logger = logging.getLogger(__name__)

    if args.task_uuid:
        logger.info(f"Starting task {args.task_uuid} with args {args}")
    else:
        logger.info(f"Starting task with args {args}")

    try:
        # Load the request
        realtime_publisher = (
            SupabaseCredentials(url=runtime_supabase_url, key=runtime_supabase_key)
            if args.realtime
            else None
        )
        task = WeightEnumeratorTask(
            realtime_updates_enabled=args.realtime,
            realtime_update_frequency=args.realtime_update_frequency,
            realtime_publisher=realtime_publisher,
            local_progress_bar=args.local_progress_bar,
        )
        if args.task_uuid:
            task_store = SupabaseTaskStore(
                args.task_store_url, args.task_store_key, args.user_id
            )
            request = task.initalize_args_from_supabase(args.task_uuid, task_store)
        else:
            request = task.initalize_args_from_file(args.input_file)

        result = task.run()

        if args.output_file:
            with open(args.output_file, "w") as f:
                f.write(result.model_dump_json())
        else:
            print(result)

        if args.task_uuid:
            task_store.store_task_result(args.task_uuid, result.model_dump_json())

    except Exception as e:
        print(f"Error: {str(e)}")
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()


# @router.get(
#     "/list_tasks",
#     response_model=List[Dict[str, Any]],
# )
# async def list_tasks():
#     try:
#         task_store = RedisTaskStore(redis_url=get_settings().redis_url)
#         task_dict = task_store.get_all_tasks()
#         print("task_dict", task_dict)
#         all_tasks = []
#         for task_id, task_info in task_dict.items():
#             all_tasks.append(task_info)

#         return sorted(all_tasks, key=lambda x: x["received"], reverse=True)

#     except Exception as e:
#         print("error", e)
#         traceback.print_exc()
#         raise HTTPException(status_code=500, detail=str(e))


# @router.get("/userid")
# async def get_userid(user: Annotated[dict, Depends(get_supabase_user_from_token)]):
#     """gets the supabase connected user"""
#     return {"id": user["uid"], "email": user["email"]}


# class TaskRequest(BaseModel):
#     user_id: int
#     params: dict


# class TaskStatusResponse(BaseModel):
#     task_id: str
#     status: str
#     result: dict | None = None
#     error: str | None = None
