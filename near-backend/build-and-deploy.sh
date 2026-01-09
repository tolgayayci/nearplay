#!/bin/bash

# Robust Build and Deploy Script for NEAR Playground Backend

set -e  # Exit on error

echo "================================"
echo "NEAR Playground Backend Build & Deploy"
echo "================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if .env.production exists
if [ ! -f .env.production ]; then
    echo -e "${RED}❌ .env.production not found!${NC}"
    if [ -f .env.production.template ]; then
        cp .env.production.template .env.production
        echo -e "${GREEN}✅ Created .env.production from template${NC}"
        echo -e "${YELLOW}⚠️  IMPORTANT: Edit .env.production with your NEAR credentials${NC}"
        exit 1
    fi
fi

# Load and export environment variables
set -a
source .env.production
set +a

# Check required variables
if [ -z "$NEAR_ACCOUNT_ID" ] || [ -z "$NEAR_PRIVATE_KEY" ]; then
    echo -e "${RED}❌ NEAR credentials not set in .env.production!${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Environment loaded${NC}"

# Generate Cargo.lock if missing
if [ ! -f Cargo.lock ]; then
    echo -e "${YELLOW}Generating Cargo.lock...${NC}"
    cargo generate-lockfile
fi

# Check Docker
if ! command -v docker &> /dev/null; then
    echo -e "${RED}❌ Docker is not installed${NC}"
    exit 1
fi

# Check if proxy network exists
if ! docker network ls | grep -q proxy; then
    echo -e "${YELLOW}Creating proxy network...${NC}"
    docker network create proxy
fi

# Build options
echo ""
echo "Build options:"
echo "1) Quick build (use cache)"
echo "2) Clean build (no cache - recommended for issues)"
echo "3) Ultra-clean build (prune everything first)"
read -p "Choose option [1-3]: " BUILD_OPTION

case $BUILD_OPTION in
    1)
        echo -e "${GREEN}Building with cache...${NC}"
        docker-compose -f docker-compose.prod.yml build
        ;;
    2)
        echo -e "${YELLOW}Building without cache...${NC}"
        docker-compose -f docker-compose.prod.yml build --no-cache
        ;;
    3)
        echo -e "${YELLOW}Pruning and rebuilding...${NC}"
        docker-compose -f docker-compose.prod.yml down
        docker system prune -f
        docker-compose -f docker-compose.prod.yml build --no-cache
        ;;
    *)
        echo -e "${RED}Invalid option${NC}"
        exit 1
        ;;
esac

# Check if build succeeded
if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Build failed!${NC}"
    echo "Common fixes:"
    echo "1. Check Dockerfile for correct cargo-near version"
    echo "2. Ensure all system dependencies are installed"
    echo "3. Try option 3 (ultra-clean build)"
    exit 1
fi

echo -e "${GREEN}✅ Build successful!${NC}"

# Start the container
echo -e "${YELLOW}Starting container...${NC}"
docker-compose -f docker-compose.prod.yml up -d

# Wait for health check
echo "Waiting for container to be healthy..."
MAX_ATTEMPTS=30
ATTEMPT=1

while [ $ATTEMPT -le $MAX_ATTEMPTS ]; do
    if docker ps | grep near-playground-backend | grep -q healthy; then
        echo -e "${GREEN}✅ Container is healthy!${NC}"
        break
    elif docker ps | grep near-playground-backend | grep -q unhealthy; then
        echo -e "${RED}❌ Container is unhealthy!${NC}"
        echo "Checking logs:"
        docker logs --tail 50 near-playground-backend
        exit 1
    else
        echo -n "."
        sleep 2
        ATTEMPT=$((ATTEMPT + 1))
    fi
done

if [ $ATTEMPT -gt $MAX_ATTEMPTS ]; then
    echo -e "${RED}❌ Container failed to become healthy${NC}"
    echo "Logs:"
    docker logs near-playground-backend
    exit 1
fi

# Test endpoints
echo ""
echo "Testing endpoints..."

# Local test
if curl -f -s http://localhost:8080/health > /dev/null; then
    echo -e "${GREEN}✅ Local health check passed${NC}"
else
    echo -e "${YELLOW}⚠️  Local health check failed${NC}"
fi

# Production test (may fail if DNS not ready)
if curl -f -s https://api.nearplay.app/health > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Production endpoint working!${NC}"
else
    echo -e "${YELLOW}⚠️  Production endpoint not ready (DNS may be propagating)${NC}"
fi

# Show status
echo ""
echo "================================"
echo -e "${GREEN}Deployment Complete!${NC}"
echo "================================"
echo ""
echo "Container status:"
docker ps | grep -E "NAMES|near-playground-backend"
echo ""
echo "Commands:"
echo "  View logs:    docker logs -f near-playground-backend"
echo "  Stop:         docker-compose -f docker-compose.prod.yml down"
echo "  Restart:      docker-compose -f docker-compose.prod.yml restart"
echo ""
echo "Endpoints:"
echo "  Local:        http://localhost:8080/health"
echo "  Production:   https://api.nearplay.app/health"
echo ""

# Show compilation test command
echo "Test compilation:"
echo 'curl -X POST http://localhost:8080/compile \
  -H "Content-Type: application/json" \
  -d "{\"code\": \"use near_sdk::near_bindgen; #[near_bindgen] pub struct Contract {}\", \"user_id\": \"test\", \"project_id\": \"test\"}"'