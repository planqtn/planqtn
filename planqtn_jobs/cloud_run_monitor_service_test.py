from cloud_run_monitor_service import extract_details


def test_extract_job_id():
    decoded_data = open(
        "planqtn_jobs/test_files/failed_job_example_message.json", "r"
    ).read()
    uuid, user_id, result = extract_details(decoded_data)
    assert uuid == "12345"
    assert user_id == "user12345"
    assert (
        result
        == "Task planqtn-jobs-q5mr7-task0 failed with message: The container exited with an error."
    )
