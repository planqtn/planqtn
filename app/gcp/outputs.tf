output "api_service_url" {
  description = "The URL of the deployed API service"
  value       = google_cloud_run_v2_service.planqtn_api.uri
}


output "ui_service_url" {
  description = "The URL of the deployed UI service"
  value       = google_cloud_run_v2_service.planqtn_ui.uri
}