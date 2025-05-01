#!/bin/bash

if command -v podman >/dev/null 2>&1; then
    shopt -s expand_aliases
    alias docker=podman
fi

docker build -t balopat/tnqec . && \
docker run -d -p 5173:5173 --name tnqec --replace balopat/tnqec 
docker logs -f tnqec