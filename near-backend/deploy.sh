#!/bin/bash

# NEAR Playground Backend Deployment Script

set -e  # Exit on error

echo "================================"
echo "NEAR Playground Backend Deployment"
echo "================================"

# Check if .env.production exists
if [ ! -f .env.production ]; then
    echo "❌ .env.production not found!"
    echo "Creating from template..."

    if [ -f .env.production.template ]; then
        cp .env.production.template .env.production
        echo "✅ Created .env.production from template"
        echo ""
        echo "⚠️  IMPORTANT: Edit .env.production and add your NEAR credentials:"
        echo "  - NEAR_ACCOUNT_ID"
        echo "  - NEAR_PRIVATE_KEY"
        echo ""
        echo "Then run this script again."
        exit 1
    else
        echo "❌ .env.production.template not found either!"
        echo "Please create .env.production with your NEAR credentials"
        exit 1
    fi
fi

# Check if required environment variables are set
set -a  # Export all variables
source .env.production
set +a  # Stop exporting

if [ -z "$NEAR_ACCOUNT_ID" ] || [ -z "$NEAR_PRIVATE_KEY" ]; then
    echo "❌ NEAR credentials not set in .env.production!"
    echo "Please edit .env.production and add:"
    echo "  - NEAR_ACCOUNT_ID"
    echo "  - NEAR_PRIVATE_KEY"
    exit 1
fi

echo "✅ Environment file loaded"
echo "   NEAR_ACCOUNT_ID: ${NEAR_ACCOUNT_ID:0:20}..." # Show first 20 chars only

# Check if Cargo.lock exists
if [ ! -f Cargo.lock ]; then
    echo "⚠️  Cargo.lock not found, generating it..."
    cargo generate-lockfile
    echo "✅ Cargo.lock generated"
fi

# Check if proxy network exists
if ! docker network ls | grep -q proxy; then
    echo "Creating proxy network..."
    docker network create proxy
    echo "✅ Proxy network created"
else
    echo "✅ Proxy network exists"
fi

# Check if Traefik is running
if ! docker ps | grep -q traefik; then
    echo "⚠️  WARNING: Traefik is not running!"
    echo "Make sure Traefik is running from iota-playground or wizard backend"
    echo "Continue anyway? (y/n)"
    read -r answer
    if [ "$answer" != "y" ]; then
        exit 1
    fi
else
    echo "✅ Traefik is running"
fi

# Build the Docker image
echo ""
echo "Building Docker image..."
docker-compose -f docker-compose.prod.yml build

# Start the container
echo ""
echo "Starting NEAR backend container..."
docker-compose -f docker-compose.prod.yml up -d

# Wait for container to be healthy
echo ""
echo "Waiting for container to be healthy..."
for i in {1..30}; do
    if docker-compose -f docker-compose.prod.yml ps | grep -q "healthy"; then
        echo "✅ Container is healthy!"
        break
    elif [ $i -eq 30 ]; then
        echo "❌ Container failed to become healthy"
        echo "Check logs with: docker-compose -f docker-compose.prod.yml logs"
        exit 1
    else
        echo -n "."
        sleep 2
    fi
done

# Test the health endpoint
echo ""
echo "Testing health endpoint..."
if curl -f http://localhost:8080/health > /dev/null 2>&1; then
    echo "✅ Local health check passed"
else
    echo "⚠️  Local health check failed, but container might still be starting..."
fi

# Show container status
echo ""
echo "Container status:"
docker ps | grep -E "NAMES|near-playground-backend" || echo "Container not found in docker ps"

echo ""
echo "================================"
echo "Deployment Complete!"
echo "================================"
echo ""
echo "Your NEAR Playground backend should be available at:"
echo "  https://api.nearplay.app/health"
echo ""
echo "To view logs:"
echo "  docker-compose -f docker-compose.prod.yml logs -f"
echo ""
echo "To stop the service:"
echo "  docker-compose -f docker-compose.prod.yml down"