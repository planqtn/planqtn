terraform {
  backend "gcs" {}

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
  }
}

provider "google" {
  project     = var.project_id
  region      = var.region
  credentials = var.google_credentials != "" ? var.google_credentials : null
}

# Enable required APIs
resource "google_project_service" "required_apis" {
  for_each = toset([
    "pubsub.googleapis.com",
    "run.googleapis.com",
    "secretmanager.googleapis.com",
    "logging.googleapis.com",
    "eventarc.googleapis.com",
    "compute.googleapis.com",
    "iam.googleapis.com",              # IAM API
    "cloudresourcemanager.googleapis.com", # Resource Manager API
    "serviceusage.googleapis.com",      # Service Usage API
    "iamcredentials.googleapis.com"     # IAM Credentials API
  ])

  project = var.project_id
  service = each.key

  disable_dependent_services = false
  disable_on_destroy        = false
} 