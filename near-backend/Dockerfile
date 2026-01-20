# Stage 1: Builder
FROM rust:1.88.0 AS builder

# Install build dependencies
RUN apt-get update && apt-get install -y \
    pkg-config \
    libssl-dev \
    git \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Create app directory
WORKDIR /app

# Copy Cargo files first for dependency caching
COPY Cargo.toml ./
# Copy Cargo.lock if it exists (it might not exist in fresh clones)
COPY Cargo.loc[k] ./

# Create a dummy main.rs to build dependencies
RUN mkdir src && \
    echo "fn main() {}" > src/main.rs && \
    cargo build --release && \
    rm -rf src

# Copy the actual source code
COPY src ./src

# Build the actual application
RUN touch src/main.rs && \
    cargo build --release

# Prepare base_project template
COPY base_project ./base_project

# Stage 2: Runtime
FROM debian:bookworm-slim

# Install runtime dependencies and build tools for cargo-near
RUN apt-get update && apt-get install -y \
    curl \
    git \
    bash \
    ca-certificates \
    libssl3 \
    libssl-dev \
    gcc \
    g++ \
    make \
    pkg-config \
    libudev-dev \
    libusb-1.0-0-dev \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Install Rust for cargo-near (we need cargo in runtime for compilation)
RUN curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y --default-toolchain stable && \
    . /root/.cargo/env && \
    rustup target add wasm32-unknown-unknown && \
    rustup default stable

# Set PATH for cargo
ENV PATH="/root/.cargo/bin:${PATH}"

# Install cargo-near for NEAR contract compilation
# First update crates.io index to ensure we have latest package info
RUN cargo search cargo-near && \
    cargo install cargo-near --version 0.16.1 --locked

# Install near-cli-rs (Rust version of NEAR CLI) - optional, can be commented out if not needed
# RUN cargo install near-cli-rs

# Create non-root user
RUN groupadd -r nearplay && useradd -r -g nearplay -m -d /home/nearplay nearplay

WORKDIR /app

# Copy built application from builder
COPY --from=builder /app/target/release/near-playground-backend /app/near-playground-backend

# Copy base_project template
COPY --from=builder /app/base_project /app/base_project

# Create necessary directories with proper permissions
RUN mkdir -p /app/projects && \
    mkdir -p /app/template-storage && \
    mkdir -p /home/nearplay/.cargo && \
    mkdir -p /home/nearplay/.rustup && \
    mkdir -p /home/nearplay/.near-credentials && \
    mkdir -p /var/log/near-playground && \
    chown -R nearplay:nearplay /app && \
    chown -R nearplay:nearplay /home/nearplay && \
    chown -R nearplay:nearplay /var/log/near-playground && \
    chmod -R 755 /app/projects && \
    chmod -R 755 /app/template-storage

# Copy cargo and rustup to nearplay user
RUN cp -r /root/.cargo /home/nearplay/ && \
    cp -r /root/.rustup /home/nearplay/ && \
    chown -R nearplay:nearplay /home/nearplay/.cargo && \
    chown -R nearplay:nearplay /home/nearplay/.rustup

# Environment variables
ENV RUST_LOG=info
ENV HOST=0.0.0.0
ENV PORT=8080
ENV PATH="/home/nearplay/.cargo/bin:${PATH}"
ENV CARGO_HOME=/home/nearplay/.cargo
ENV RUSTUP_HOME=/home/nearplay/.rustup

# Expose port
EXPOSE 8080

# Switch to non-root user
USER nearplay

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:8080/health || exit 1

# Run the application
CMD ["/app/near-playground-backend"]