# Cloud Run job for PlanqTN Jobs
resource "google_cloud_run_v2_job" "planqtn_jobs" {
  name     = "planqtn-jobs"
  location = var.region

  template {
    template {
      service_account = google_service_account.cloud_run_svc.email
      containers {
        image = var.jobs_image
        env {
          name  = "SUPABASE_URL"
          value_source {
            secret_key_ref {
              secret  = google_secret_manager_secret.supabase_url.secret_id
              version = "latest"
            }
          }
        }
        env {
          name  = "SUPABASE_KEY"
          value_source {
            secret_key_ref {
              secret  = google_secret_manager_secret.supabase_service_key.secret_id
              version = "latest"
            }
          }
        }
      }
    }
  }

  depends_on = [google_project_service.required_apis]
}

# Cloud Run service for job monitoring
resource "google_cloud_run_v2_service" "planqtn_monitor" {
  name     = "planqtn-monitor"
  location = var.region

  template {
    service_account = google_service_account.cloud_run_svc.email
    containers {
      image = var.jobs_image
      args  = ["/app/planqtn_jobs/cloud_run_monitor_service.py"]
      env {
        name  = "SUPABASE_URL"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.supabase_url.secret_id
            version = "latest"
          }
        }
      }
      env {
        name  = "SUPABASE_KEY"
        value_source {
          secret_key_ref {
            secret  = google_secret_manager_secret.supabase_service_key.secret_id
            version = "latest"
          }
        }
      }
    }
  }

  depends_on = [google_project_service.required_apis]
}

# Cloud Run service for API
resource "google_cloud_run_v2_service" "planqtn_api" {
  name     = "planqtn-api"
  location = var.region

  template {
    service_account = google_service_account.cloud_run_svc.email
    containers {
      image = var.api_image
    }
  }

  depends_on = [google_project_service.required_apis]
} 