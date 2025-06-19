# Create secrets for Supabase credentials
resource "google_secret_manager_secret" "supabase_service_key" {
  secret_id = "supabase_service_key"

  replication {
    auto {}
  }

  depends_on = [google_project_service.required_apis]
}

resource "google_secret_manager_secret_version" "supabase_service_key" {
  secret      = google_secret_manager_secret.supabase_service_key.id
  secret_data = var.supabase_service_key
}

resource "google_secret_manager_secret" "supabase_url" {
  secret_id = "supabase_url"

  replication {
    auto {}
  }

  depends_on = [google_project_service.required_apis]
}

resource "google_secret_manager_secret_version" "supabase_url" {
  secret      = google_secret_manager_secret.supabase_url.id
  secret_data = var.supabase_url
} 