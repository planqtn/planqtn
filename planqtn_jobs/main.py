import argparse
import json
import logging
import os
import sys
import traceback
from typing import Optional
from planqtn_jobs.task import SupabaseCredentials, SupabaseTaskStore, TaskDetails
from planqtn_jobs.weight_enum_task import WeightEnumeratorTask


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
    runtime_supabase_url = os.environ.get("RUNTIME_SUPABASE_URL")
    runtime_supabase_key = os.environ.get("RUNTIME_SUPABASE_KEY")

    if args.realtime and (not runtime_supabase_url or not runtime_supabase_key):
        print(
            "Error: env vars RUNTIME_SUPABASE_URL/KEY are needed for realtime updates they are not set"
        )
        sys.exit(1)

    # check user context

    if args.task_uuid and not (args.task_store_url and args.task_store_key):
        print("Error: Task store credentials required for task-uuid mode")
        sys.exit(1)

    # root = logging.getLogger()
    # root.setLevel(
    #     logging.DEBUG if args.debug else logging.INFO
    # )  # Set the minimum logging level

    # # Create a StreamHandler to output to stdout
    # handler = logging.StreamHandler(sys.stdout)
    # handler.setLevel(logging.DEBUG if args.debug else logging.INFO)

    # # Create a formatter to customize the log message format
    # formatter = logging.Formatter(
    #     "%(asctime)s - %(name)s - %(levelname)s - %(message)s"
    # )
    # handler.setFormatter(formatter)

    # # Add the handler to the root logger
    # root.addHandler(handler)
    logger = logging.getLogger(__name__)

    if args.task_uuid:
        logger.info(f"Starting task {args.task_uuid} with args {args}")
    else:
        logger.info(f"Starting task with args {args}")

    try:
        task_store = (
            SupabaseTaskStore(
                task_db_credentials=SupabaseCredentials(
                    url=args.task_store_url, key=args.task_store_key
                ),
                task_updates_db_credentials=(
                    SupabaseCredentials(
                        url=runtime_supabase_url, key=runtime_supabase_key
                    )
                    if args.realtime
                    else None
                ),
            )
            if args.task_uuid
            else None
        )
        WeightEnumeratorTask(
            task_details=TaskDetails(
                user_id=args.user_id,
                uuid=args.task_uuid,
                input_file=args.input_file,
                output_file=args.output_file,
            ),
            task_store=task_store,
            local_progress_bar=args.local_progress_bar,
            realtime_update_frequency=args.realtime_update_frequency,
            realtime_updates_enabled=args.realtime,
            debug=args.debug,
        ).run()

    except Exception as e:
        print(f"Error: {str(e)}")
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()
