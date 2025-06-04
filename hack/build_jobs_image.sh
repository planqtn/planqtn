#!/bin/bash

# Ensure script is run from the root directory
if [ ! -f "app/planqtn_jobs/Dockerfile" ]; then
    echo "Error: This script must be run from the root directory of the repository"
    echo "Current directory: $(pwd)"
    echo "Expected to find: app/planqtn_jobs/Dockerfile"
    exit 1
fi


# Parse command line arguments
PUSH=false
RUN=false
RUND=false
K3D_LOAD=false
for arg in "$@"; do
    case $arg in
        --push)
            PUSH=true
            shift
            ;;
        --run)
            RUN=true
            shift
            ;;
        --rund)
            RUND=true
            shift
            ;;
        --k3d-load)
            K3D_LOAD=true
            shift
            ;;
        --deploy-monitor)
            DEPLOY_MONITOR=true
            shift
            ;;
        --deploy-job)
            DEPLOY_JOB=true
            shift
            ;;
    esac
done

# Get the git commit hash
COMMIT_HASH=$(git rev-parse --short HEAD)

# Check if there are uncommitted changes
if [[ -n $(git status -s) ]]; then
    TAG="${COMMIT_HASH}-dirty"
else
    TAG="${COMMIT_HASH}"
fi

echo "Building and tagging image with commit: ${TAG}"

docker build -t planqtn/planqtn_jobs:${TAG} --file=app/planqtn_jobs/Dockerfile .


echo "Image built successfully"

if [ "$PUSH" = true ]; then
    echo "Pushing image to registry..."
    docker push planqtn/planqtn_jobs:${TAG}    
    echo "Image pushed successfully"
fi

if [ "$K3D_LOAD" = true ]; then
    echo "Loading image planqtn/planqtn_jobs:${TAG} into k3d cluster..."
    k3d image import planqtn/planqtn_jobs:${TAG} -c plaqntn
    echo "Image loaded into k3d cluster successfully"
fi

if [ "$DEPLOY_MONITOR" = true ]; then
    echo "Deploying monitor service..."
    gcloud run deploy planqtn-monitor --image planqtn/planqtn_jobs:${TAG} 
    echo "Monitor service deployed successfully"
fi

if [ "$DEPLOY_JOB" = true ]; then
    echo "Deploying job..."
    gcloud run jobs deploy planqtn-jobs --image planqtn/planqtn_jobs:${TAG} 
    echo "Job deployed successfully"
fi

if [ "$RUN" = true ]; then
    echo "Running container with attached TTY..."
    docker run -t --rm -p 5173:5173 planqtn/planqtn_jobs:${TAG}
elif [ "$RUND" = true ]; then
    echo "Running container in detached mode..."
    CONTAINER_ID=$(docker run -d --rm -p 5173:5173 planqtn/planqtn_jobs:${TAG})
    echo "Container started with ID: ${CONTAINER_ID}"
    echo "Tailing logs (Ctrl+C to stop)..."
    docker logs -f ${CONTAINER_ID}
elif [ "$PUSH" != true ] && [ "$MINIKUBE_LOAD" != true ] && [ "$K3D_LOAD" != true ]; then
    echo "To push the image to the registry, run:"
    echo "    docker push planqtn/planqtn_jobs:${TAG}"    
    echo "or run this script with the --push flag:"
    echo "    ./build_jobs_image.sh --push"
    echo ""
    echo "To load the image into Minikube, run:"
    echo "    ./build_jobs_image.sh --minikube-load"
    echo ""
    echo "To load the image into k3d cluster, run:"
    echo "    ./build_jobs_image.sh --k3d-load"
    echo ""
elif [ "$RUN" != true ]; then
    echo "To run the container with attached TTY, use:"
    echo "    ./build_jobs_image.sh --run"
    echo ""
    echo "To run the container in detached mode and tail logs, use:"
    echo "    ./build_jobs_image.sh --rund"
fi
