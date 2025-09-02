FROM ubuntu:20.04

# Install dependencies
ENV TZ=Etc/UTC
RUN apt update && \
    DEBIAN_FRONTEND=noninteractive apt install -y curl wget git vim tmux make build-essential \
    libssl-dev zlib1g-dev libbz2-dev libreadline-dev libsqlite3-dev libncursesw5-dev \
    xz-utils tk-dev libxml2-dev libxmlsec1-dev libffi-dev liblzma-dev

SHELL ["/bin/bash", "-c"]

# Install Node.js 18.19.1
RUN wget -qO- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash
ENV NVM_DIR=/root/.nvm
RUN source $NVM_DIR/nvm.sh && nvm install 18.19.1

# Intall Python 3.10.0
ENV PYENV_ROOT=/root/.pyenv
ENV PATH="$PATH:$PYENV_ROOT/bin"
RUN curl https://pyenv.run | bash

RUN eval "$(pyenv init - bash)" && \
    eval "$(pyenv virtualenv-init -)" && \
    pyenv install 3.10.0 && \
    pyenv global 3.10.0

# Install CodeQL 2.16.5
WORKDIR /codeql-home

RUN until wget -c https://github.com/github/codeql-action/releases/download/codeql-bundle-v2.16.5/codeql-bundle-linux64.tar.gz; do :; done
RUN tar -xzf codeql-bundle-linux64.tar.gz
ENV PATH="$PATH:/codeql-home/codeql"

RUN mkdir /root/codeql-db
ENV CODEQL_DB_ROOT=/root/codeql-db

# Copy Turnstile
WORKDIR /root/turnstile

COPY ./codeql ./codeql
COPY ./src ./src
COPY ./scripts ./scripts
COPY ./data ./data
RUN echo "{}" > package.json
RUN source $NVM_DIR/nvm.sh && \
    npm install --save-dev dotenv@16.4.5 js-beautify@1.14.11 xml2js@0.6.2 express@4.18.2 express-session@1.17.3 && \
    npm install escodegen@2.1.0

ENV TURNSTILE_ROOT=/root/turnstile

RUN mkdir /root/output
ENV TURNSTILE_OUTPUT_ROOT=/root/output

# Download experiment target repositories
# (broken down into multiple scripts to prevent
#  network or memory related errors)

WORKDIR /root/target-repos

ENV ANALYSIS_TARGETS_ROOT=/root/target-repos

RUN source $NVM_DIR/nvm.sh && \
    chmod +x /root/turnstile/scripts/setup/download-target-repos-0.sh && \
    /root/turnstile/scripts/setup/download-target-repos-0.sh
RUN source $NVM_DIR/nvm.sh && \
    chmod +x /root/turnstile/scripts/setup/download-target-repos-1.sh && \
    /root/turnstile/scripts/setup/download-target-repos-1.sh
RUN source $NVM_DIR/nvm.sh && \
    chmod +x /root/turnstile/scripts/setup/download-target-repos-2.sh && \
    /root/turnstile/scripts/setup/download-target-repos-2.sh
RUN source $NVM_DIR/nvm.sh && \
    chmod +x /root/turnstile/scripts/setup/download-target-repos-3.sh && \
    /root/turnstile/scripts/setup/download-target-repos-3.sh
RUN source $NVM_DIR/nvm.sh && \
    chmod +x /root/turnstile/scripts/setup/download-target-repos-4.sh && \
    /root/turnstile/scripts/setup/download-target-repos-4.sh
RUN chmod +x /root/turnstile/scripts/setup/annotate-target-repos.sh && \
    /root/turnstile/scripts/setup/annotate-target-repos.sh

# Create Turnstile JS library
WORKDIR /root/target-repos/node_modules/turnstile
RUN echo "module.exports = { PrivacyTracker: require('/root/turnstile/src/PrivacyTracker.js') }" > index.js

# Initialize virtualenv and python dependencies
WORKDIR /root/turnstile/scripts/presentation
RUN eval "$(pyenv init - bash)" && \
    eval "$(pyenv virtualenv-init -)" && \
    python -m venv .venv && \
    source .venv/bin/activate && \
    pip install -r requirements.txt

# Generate experiment workloads
WORKDIR /root/turnstile/scripts/experiment
RUN source $NVM_DIR/nvm.sh && \
    chmod +x ./generate-all-workloads.sh && \
    ./generate-all-workloads.sh

# Set working directory
WORKDIR /root