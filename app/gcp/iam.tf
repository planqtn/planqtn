# Service account for Cloud Run services
resource "google_service_account" "cloud_run_svc" {
  account_id   = "${var.environment}-cloud-run-svc"
  display_name = "PlanqTN Cloud Run Service Account"
  project      = var.project_id
}

# Grant necessary roles to Cloud Run service account
resource "google_project_iam_member" "cloud_run_svc_roles" {
  for_each = toset([
    "roles/secretmanager.secretAccessor",
    "roles/run.admin",           # To manage Cloud Run services
    "roles/run.invoker",         # To invoke Cloud Run services
    "roles/run.jobsExecutor",    # To execute Cloud Run jobs
    "roles/logging.logWriter",   # To write logs
    "roles/monitoring.metricWriter"  # To write metrics
  ])

  project = var.project_id
  role    = each.key
  member  = "serviceAccount:${google_service_account.cloud_run_svc.email}"
}


# Service account for API access
resource "google_service_account" "api_svc" {
  account_id   = "${var.environment}-api-svc"
  display_name = "PlanqTN API Service Account"
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