variable "project_id" {
  description = "The GCP project ID"
  type        = string
}

variable "region" {
  description = "The GCP region to deploy resources"
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
  description = "The environment name (e.g., dev, prod)"
  type        = string
  default     = "dev"
} 