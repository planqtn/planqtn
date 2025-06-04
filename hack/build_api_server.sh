#!/bin/bash

# Ensure script is run from the root directory
if [ ! -f "app/planqtn_api/Dockerfile" ]; then
    echo "Error: This script must be run from the root directory of the repository"
    echo "Current directory: $(pwd)"
    echo "Expected to find: app/planqtn_api/Dockerfile"
    exit 1
fi

# Parse command line arguments
PUSH=false
RUN=false
RUND=false
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
    esac
done
TAG=$(hack/image_tag)
echo "Building and tagging image with commit: ${TAG}"

docker build -t planqtn/planqtn_api:${TAG} --file=app/planqtn_api/Dockerfile .

echo "Image built successfully"

if [ "$PUSH" = true ]; then
    echo "Pushing image to registry..."
    docker push planqtn/planqtn_api:${TAG}
    echo "Image pushed successfully"
fi

if [ "$RUN" = true ]; then
    echo "Running container with attached TTY..."
    docker run -t --rm -p 5173:5173 planqtn/planqtn_api:${TAG}
elif [ "$RUND" = true ]; then
    echo "Running container in detached mode..."
    CONTAINER_ID=$(docker run -d --rm -p 5173:5173 planqtn/planqtn_api:${TAG})
    echo "Container started with ID: ${CONTAINER_ID}"
    echo "Tailing logs (Ctrl+C to stop)..."
    docker logs -f ${CONTAINER_ID}
elif [ "$PUSH" != true ]; then
    echo "To push the image to the registry, run:"
    echo "    docker push planqtn/planqtn_api:${TAG}"    
    echo "or run this script with the --push flag:"
    echo "    ./build_planqt_api.sh --push"
    echo ""
elif [ "$RUN" != true ]; then
    echo "To run the container with attached TTY, use:"
    echo "    ./build_planqt_api.sh --run"
    echo ""
    echo "To run the container in detached mode and tail logs, use:"
    echo "    ./build_planqt_api.sh --rund"
fi
