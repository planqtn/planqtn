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

  depends_on = [google_project_service.required_apis]
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
    }
  }

  transport {
    pubsub {
      topic = google_pubsub_topic.planqtn_jobs.name
    }
  }

  depends_on = [google_project_service.required_apis]
} 