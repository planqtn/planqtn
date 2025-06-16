#!/bin/bash

# Create necessary directories
mkdir -p dist/cfg
mkdir -p dist/cfg/planqtn_api

# Copy supabase config
rsync -a --filter=':- ../../.gitignore' ../supabase/ dist/cfg/supabase/

# Copy k8s config
rsync -a ../k8s/ dist/cfg/k8s/

# Copy migrations
rsync -a ../migrations/ dist/cfg/migrations/

# Copy planqtn_api config
rsync -a ../planqtn_api/.env.local dist/cfg/planqtn_api/.env.local
rsync -a ../planqtn_api/compose.yml dist/cfg/planqtn_api/compose.yml 