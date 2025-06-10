import json
from cloud_run_monitor_service import extract_details, extract_details_from_decoded_data


def test_extract_job_id():
    decoded_data = open(
        "app/planqtn_jobs/test_files/failed_job_example_message.json", "r"
    ).read()
    uuid, user_id, result = extract_details_from_decoded_data(decoded_data)
    assert uuid == "12345"
    assert user_id == "user12345"
    assert (
        result
        == "Task planqtn-jobs-q5mr7-task0 failed with message: The container exited with an error."
    )


def test_extract_data_from_failure_message():
    message_with_encoded_data = open(
        "app/planqtn_jobs/test_files/failure_msg.json", "r"
    ).read()
    uuid, user_id, result = extract_details(json.loads(message_with_encoded_data))
    assert uuid == "df5688de-0ad4-4cc3-83a0-f0c6a21577fc"
    assert user_id == "95f5b295-530f-42f1-98b1-76f2ce2ba37b"
    assert (
        result
        == "Task planqtn-jobs-crrgf-task0 failed with message: The container exited with an error."
    )


def test_extract_data_from_timeout_message():
    decoded_data = open("app/planqtn_jobs/test_files/test_timeout_job.json", "r").read()
    uuid, user_id, result = extract_details_from_decoded_data(decoded_data)
    assert uuid == "dbf7464b-9f36-486c-8383-2ca3dd194b05"
    assert user_id == "f96cb362-b3ab-4750-b5f7-43cb629e887f"
    assert (
        result
        == "Task planqtn-jobs-fxf45-task0 failed with message: The configured timeout was reached."
    )
