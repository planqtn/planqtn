# PubSub topic for job monitoring
resource "google_pubsub_topic" "planqtn_jobs" {
  name    = "planqtn-jobs"
  project = var.project_id

  depends_on = [google_project_service.required_apis]
}

# Logging sink for job failures
resource "google_logging_project_sink" "planqtn_job_monitor" {
  name        = "planqtn-job-monitor"
  destination = "pubsub.googleapis.com/projects/${var.project_id}/topics/${google_pubsub_topic.planqtn_jobs.name}"
  filter      = "protoPayload.methodName=\"Jobs.RunJob\" OR protoPayload.methodName=\"/Jobs.RunJob\" AND NOT \"has completed successfully\""

  unique_writer_identity = true
  
  depends_on = [google_project_service.required_apis]
}

# Finally, grant the sink's writer identity the necessary permission on the topic
resource "google_pubsub_topic_iam_member" "sink_publisher_binding" {
  project = google_pubsub_topic.planqtn_jobs.project
  topic   = google_pubsub_topic.planqtn_jobs.name
  role    = "roles/pubsub.publisher"

  # This is the magic! It dynamically gets the writer identity from the sink resource
  # you just defined above. You don't have to hardcode anything.
  member = google_logging_project_sink.planqtn_job_monitor.writer_identity
}

# Eventarc trigger for job monitoring
resource "google_eventarc_trigger" "planqtn_failed_job_trigger" {
  name     = "planqtn-failed-job-trigger"
  location = var.region

  matching_criteria {
    attribute = "type"
    value     = "google.cloud.pubsub.topic.v1.messagePublished"
  }

  destination {
    cloud_run_service {
      service = google_cloud_run_v2_service.planqtn_monitor.name
      region  = var.region
      path    = "/job-failed"
    }
  }

  transport {
    pubsub {
      topic = google_pubsub_topic.planqtn_jobs.name
    }
  }

  service_account = google_service_account.api_svc.email

  depends_on = [google_project_service.required_apis]
} 