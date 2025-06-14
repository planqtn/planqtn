variable "project_id" {
  description = "The GCP project ID"
  type        = string
}

variable "region" {
  description = "The GCP region"
  type        = string
  default     = "us-east1"
}

variable "jobs_image" {
  description = "The container image for PlanqTN Jobs"
  type        = string
}

variable "api_image" {
  description = "The container image for PlanqTN API"
  type        = string
}

variable "ui_image" {
  description = "The container image for PlanqTN UI"
  type        = string
}

variable "supabase_url" {
  description = "The Supabase project URL"
  type        = string
}

variable "supabase_service_key" {
  description = "The Supabase service role key"
  type        = string
  sensitive   = true
}

variable "environment" {
  description = "The environment (e.g., dev, prod)"
  type        = string
  default     = "dev"
}

variable "google_credentials" {
  description = "The Google Cloud credentials JSON. If not provided, will use Application Default Credentials"
  type        = string
  default     = ""
  sensitive   = true
} 