output "api_service_url" {
  description = "The URL of the deployed API service"
  value       = google_cloud_run_v2_service.planqtn_api.uri
}

# WARNING: This output exposes a private key and should remain disabled by default.
# Enable only in safe, ephemeral environments by setting
#   -var="expose_api_service_account_key_output=true"
# Prefer using Secret Manager for access in production.
output "api_service_account_key" {
  description = "The service account key for the API service (use only if explicitly enabled)"
  value       = var.expose_api_service_account_key_output ? google_service_account_key.api_svc_key.private_key : null
  sensitive   = true
}

output "ui_service_url" {
  description = "The URL of the deployed UI service"
  value       = google_cloud_run_v2_service.planqtn_ui.uri
}