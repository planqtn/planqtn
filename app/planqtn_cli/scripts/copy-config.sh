#!/bin/bash

mkdir -p dist/cfg 

# copy supabase config
rsync -a --filter=':- ../../.gitignore' ../supabase/ dist/cfg/supabase/
rsync -a ../k8s/ dist/cfg/k8s/
rsync -a ../migrations/ dist/cfg/migrations/ 

mkdir -p dist/cfg/planqtn_api 
rsync -v ../planqtn_api/.env.local dist/cfg/planqtn_api/.env.local  
rsync -v ../planqtn_api/compose.yml dist/cfg/planqtn_api/compose.yml
