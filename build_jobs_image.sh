#!/bin/bash

# Parse command line arguments
PUSH=false
RUN=false
RUND=false
MINIKUBE_LOAD=false
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

echo "Image built successfully"

if [ "$PUSH" = true ]; then
    echo "Pushing image to registry..."
    docker push balopat/planqtn_jobs:${TAG}
    echo "Image pushed successfully"
fi

if [ "$MINIKUBE_LOAD" = true ]; then
    echo "Loading image into Minikube..."
    minikube image load balopat/planqtn_jobs:${TAG}
    echo "Image loaded into Minikube successfully"
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
elif [ "$PUSH" != true ] && [ "$MINIKUBE_LOAD" != true ]; then
    echo "To push the image to the registry, run:"
    echo "    docker push balopat/planqtn_jobs:${TAG}"    
    echo "or run this script with the --push flag:"
    echo "    ./build_jobs_image.sh --push"
    echo ""
    echo "To load the image into Minikube, run:"
    echo "    ./build_jobs_image.sh --minikube-load"
    echo ""
elif [ "$RUN" != true ]; then
    echo "To run the container with attached TTY, use:"
    echo "    ./build_jobs_image.sh --run"
    echo ""
    echo "To run the container in detached mode and tail logs, use:"
    echo "    ./build_jobs_image.sh --rund"
fi
