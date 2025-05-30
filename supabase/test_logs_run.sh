#!/bin/bash

# Get the logs for a job
JOB_ID=$1

curl -i --location --request POST 'http://127.0.0.1:54321/functions/v1/planqtn_job_logs_run' \
  --header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0' \
  --header 'Content-Type: application/json' \
  --data '{
    "task_uuid": "'$JOB_ID'"
  }'