# PlanqTN App Directory Structure

This directory contains the main application components of PlanqTN, a tool for designing and analyzing quantum error correction codes using tensor networks.

## Directory Structure

### `/ui`

The main web interface built with React/TypeScript. Features include:

- Interactive canvas for tensor network design
- Component library for quantum error correction codes
- Real-time network analysis
- Modern UI with Chakra UI components
- Built with Vite and served via Cloud Run

### `/planqtn_api`

FastAPI-based backend service that provides:

- API endpoints for tensor network operations
- Integration with Supabase for data storage
- Support for various quantum error correction code operations

### `/planqtn_jobs`

Background job processing system for:

- Weight enumerator calculations
- Long-running tensor network operations
- Job monitoring and management
- Integration with Cloud Run and Kubernetes for execution

### `/gcp`

Terraform configurations for Google Cloud Platform infrastructure:

- Cloud Run service definitions
- Secret management
- IAM roles and permissions
- Infrastructure as code for deployment

### `/supabase`

Supabase-related configurations and edge functions:

- Database schema definitions
- Authentication setup
- Real-time subscriptions
- Edge function implementations

### `/planqtn_cli`

Command-line interface tools for:

- Local development and testing
- Job submission and monitoring
- API interaction
- Utility functions

### `/planqtn_fixtures`

Test fixtures and sample data for:

- Unit testing
- Integration testing
- Development environment setup

### `/planqtn_types`

Type definitions and shared interfaces used across:

- API endpoints
- Job processing
- UI components
- Data structures

### `/k8s`

Kubernetes configurations for:

- Local cloud for end users
- Dev cloud for development
- Testing environments
- Deployment specifications

### `/migrations`

Database migration scripts for:

- Schema updates
- Data transformations
- Version control of database structure
