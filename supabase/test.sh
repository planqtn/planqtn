curl -i --location --request POST 'http://127.0.0.1:54321/functions/v1/planqtn_job' \
  --header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0' \
  --header 'Content-Type: application/json' \
  --data '{
    "user_id": "49786a54-f785-4649-b059-40d5806e7d2e",
    "job_type": "weightenumerator",
    "request_time": "2024-02-22T12:00:00Z",
    "payload": {
      "input-file": "/app/planqtn_jobs/test_files/sample_job2.json"
    }
  }'