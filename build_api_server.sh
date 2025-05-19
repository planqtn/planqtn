#!/bin/bash

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

# Get the git commit hash
COMMIT_HASH=$(git rev-parse --short HEAD)

# Check if there are uncommitted changes
if [[ -n $(git status -s) ]]; then
    TAG="${COMMIT_HASH}-dirty"
else
    TAG="${COMMIT_HASH}"
fi

echo "Building and tagging image with commit: ${TAG}"

docker build -t balopat/planqtn-api:${TAG} --file=Dockerfile.api .

echo "Image built successfully"

if [ "$PUSH" = true ]; then
    echo "Pushing image to registry..."
    docker push balopat/planqtn-api:${TAG}
    echo "Image pushed successfully"
fi

if [ "$RUN" = true ]; then
    echo "Running container with attached TTY..."
    docker run -t --rm -p 5173:5173 balopat/planqtn-api:${TAG}
elif [ "$RUND" = true ]; then
    echo "Running container in detached mode..."
    CONTAINER_ID=$(docker run -d --rm -p 5173:5173 balopat/planqtn-api:${TAG})
    echo "Container started with ID: ${CONTAINER_ID}"
    echo "Tailing logs (Ctrl+C to stop)..."
    docker logs -f ${CONTAINER_ID}
elif [ "$PUSH" != true ]; then
    echo "To push the image to the registry, run:"
    echo "    docker push balopat/planqtn-api:${TAG}"    
    echo "or run this script with the --push flag:"
    echo "    ./build_api_server.sh --push"
    echo ""
elif [ "$RUN" != true ]; then
    echo "To run the container with attached TTY, use:"
    echo "    ./build_api_server.sh --run"
    echo ""
    echo "To run the container in detached mode and tail logs, use:"
    echo "    ./build_api_server.sh --rund"
fi
