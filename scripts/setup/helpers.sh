#!/bin/bash

# This file contains reusable shell functions that can be "imported".

log_message() {
    echo "[$(date +'%Y-%m-%d %H:%M:%S')] - $1"
}

retry() {
    set +e
    local max_retries=$1
    local delay=$2
    shift 2
    local cmd=("$@")

    local attempt=1
    local exit_code

    while [ $attempt -le $max_retries ]; do
        log_message "Attempt $attempt/$max_retries: Running command: ${cmd[*]}"
        "${cmd[@]}"
        exit_code=$?

        if [ $exit_code -eq 0 ]; then
            log_message "Command succeeded."
            set -e
            return 0
        fi

        log_message "Command failed with exit code $exit_code."

        if [ $attempt -lt $max_retries ]; then
            log_message "Retrying in ${delay}s..."
            sleep "$delay"
        fi

        attempt=$((attempt + 1))
    done

    log_message "Command failed after $max_retries attempts."
    set -e
    return $exit_code
}