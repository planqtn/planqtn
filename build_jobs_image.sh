#!/bin/bash

# Parse command line arguments
PUSH=false
RUN=false
RUND=false
MINIKUBE_LOAD=false
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
        --minikube-load)
            MINIKUBE_LOAD=true
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

docker build -t balopat/planqtn_jobs:${TAG} --file=Dockerfile.jobs .
docker tag balopat/planqtn_jobs:${TAG} balopat/planqtn_jobs:latest

echo "Image built successfully"

if [ "$PUSH" = true ]; then
    echo "Pushing image to registry..."
    docker push balopat/planqtn_jobs:${TAG}    
    docker push balopat/planqtn_jobs:latest
    echo "Image pushed successfully"
fi

if [ "$MINIKUBE_LOAD" = true ]; then
    echo "Loading image balopat/planqtn_jobs:${TAG} into Minikube..."
    # https://github.com/kubernetes/minikube/issues/18021 gotta do it via a file
    temp_file=$(mktemp)
    docker image save balopat/planqtn_jobs:${TAG} -o ${temp_file}
    minikube image load ${temp_file}    
    echo "Image loaded into Minikube successfully"
fi

if [ "$K3D_LOAD" = true ]; then
    echo "Loading image balopat/planqtn_jobs:${TAG} into k3d cluster..."
    k3d image import balopat/planqtn_jobs:${TAG} -c plaqntn
    k3d image import balopat/planqtn_jobs:latest -c plaqntn
    echo "Image loaded into k3d cluster successfully"
fi

if [ "$DEPLOY_MONITOR" = true ]; then
    echo "Deploying monitor service..."
    gcloud run deploy planqtn-monitor --image balopat/planqtn_jobs:${TAG} 
    echo "Monitor service deployed successfully"
fi

if [ "$DEPLOY_JOB" = true ]; then
    echo "Deploying job..."
    gcloud run jobs deploy planqtn-jobs --image balopat/planqtn_jobs:${TAG} 
    echo "Job deployed successfully"
fi

if [ "$RUN" = true ]; then
    echo "Running container with attached TTY..."
    docker run -t --rm -p 5173:5173 balopat/planqtn_jobs:${TAG}
elif [ "$RUND" = true ]; then
    echo "Running container in detached mode..."
    CONTAINER_ID=$(docker run -d --rm -p 5173:5173 balopat/planqtn_jobs:${TAG})
    echo "Container started with ID: ${CONTAINER_ID}"
    echo "Tailing logs (Ctrl+C to stop)..."
    docker logs -f ${CONTAINER_ID}
elif [ "$PUSH" != true ] && [ "$MINIKUBE_LOAD" != true ] && [ "$K3D_LOAD" != true ]; then
    echo "To push the image to the registry, run:"
    echo "    docker push balopat/planqtn_jobs:${TAG}"    
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
