#!/bin/bash

PROD=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --prod)
            PROD=true
            shift
            ;;
        *)
            echo "Unknown option: $1"
            exit 1
            ;;
    esac
done


mkdir -p dist/cfg 

# copy supabase config
rsync -q --filter=':- ../../.gitignore' ../supabase/ dist/cfg/supabase/
rsync -q ../k8s/ dist/cfg/k8s/
rsync -q ../migrations/ dist/cfg/migrations/ 

mkdir -p dist/cfg/planqtn_api 
rsync -q ../planqtn_api/.env.local dist/cfg/planqtn_api/.env.local  
rsync -q ../planqtn_api/compose.yml dist/cfg/planqtn_api/compose.yml

PKG_VERSION=$(cat package.json | grep version | awk '{print $2}' | tr -d '",')
GIT_VERSION=$(../../hack/image_tag)

if [ "${PKG_VERSION}" != "${GIT_VERSION}" ]; then
  echo "${PKG_VERSION}-${GIT_VERSION}" > dist/cfg/version.txt
  
  if [ "$PROD" = true ]; then
    
    echo "ERROR: Refusing to build in prod mode, because package.json version (${PKG_VERSION}) != git version (${GIT_VERSION})"
    exit 1
    
  fi
else
  echo "${PKG_VERSION}" > dist/cfg/version.txt
fi