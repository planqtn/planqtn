# PlanqTN GCP Infrastructure

This directory contains Terraform configurations to set up the GCP infrastructure for PlanqTN.

## Prerequisites

1. Install [Terraform](https://www.terraform.io/downloads.html) (version >= 1.0.0)
2. Install [Google Cloud SDK](https://cloud.google.com/sdk/docs/install)
3. Authenticate with GCP:
   ```bash
   gcloud auth application-default login
   ```

## Usage

1. Create a `terraform.tfvars` file with your configuration:

```hcl
project_id           = "your-project-id"
region              = "us-east1"
jobs_image          = "your-docker-repo/planqtn-jobs:latest"
api_image           = "your-docker-repo/planqtn-api:latest"
supabase_url        = "https://your-project.supabase.co"
supabase_service_key = "your-supabase-service-key"
environment         = "dev"
```

2. Initialize Terraform:

   ```bash
   terraform init
   ```

3. Review the planned changes:

   ```bash
   terraform plan
   ```

4. Apply the configuration:
   ```bash
   terraform apply
   ```

## Infrastructure Components

The Terraform configuration sets up:

1. Required GCP APIs
2. Secret Manager secrets for Supabase credentials
3. Cloud Run services:
   - PlanqTN Jobs
   - Job Monitor
   - API Server
4. PubSub topic and logging sink for job monitoring
5. Eventarc trigger for failed jobs
6. IAM roles and service accounts

## Outputs

After applying the configuration, Terraform will output:

- API service URL
- Monitor service URL
- API service account email
- API service account key (base64 encoded)

## Cleanup

To destroy all created resources:

```bash
terraform destroy
```
