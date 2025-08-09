# Service account for Cloud Run services
resource "google_service_account" "cloud_run_svc" {
  account_id   = "cloud-run-execution-svc"
  display_name = "PlanqTN Cloud Run Service Account"
  project      = var.project_id
}

# Grant necessary roles to Cloud Run service account
resource "google_project_iam_member" "cloud_run_svc_roles" {
  for_each = toset([
    "roles/secretmanager.secretAccessor",
    "roles/run.invoker",         # To invoke Cloud Run services
    "roles/run.jobsExecutor",    # To execute Cloud Run jobs
    "roles/logging.logWriter",   # To write logs
    "roles/monitoring.metricWriter",  # To write metrics
    "roles/iam.serviceAccountTokenCreator", # To create service account tokens for Eventarc
  ])

  project = var.project_id
  role    = each.key
  member  = "serviceAccount:${google_service_account.cloud_run_svc.email}"
}


# Service account for Client API access
resource "google_service_account" "api_svc" {
  account_id   = "api-client-svc"
  display_name = "PlanqTN API Client Service Account"
  project      = var.project_id
}

# Grant necessary roles to API service account
resource "google_project_iam_member" "api_svc_roles" {
  for_each = toset([
    "roles/run.invoker",
    "roles/run.jobsExecutorWithOverrides",
    "roles/run.viewer",
    "roles/logging.viewAccessor"
  ])

  project = var.project_id
  role    = each.key
  member  = "serviceAccount:${google_service_account.api_svc.email}"
}

# Create service account key
resource "google_service_account_key" "api_svc_key" {
  service_account_id = google_service_account.api_svc.name
} 