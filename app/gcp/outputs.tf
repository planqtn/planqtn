output "api_service_url" {
  description = "The URL of the deployed API service"
  value       = google_cloud_run_v2_service.planqtn_api.uri
}

output "api_service_account_key" {
  description = "The service account key for the API service"
  value       = google_service_account_key.api_svc_key.private_key
  sensitive   = true
} 