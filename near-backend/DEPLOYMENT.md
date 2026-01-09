# NEAR Playground Backend - Docker Deployment Guide

This guide explains how to deploy the NEAR Playground backend using Docker and Traefik for SSL/TLS.

## Prerequisites

- Docker and Docker Compose installed on your server
- Domain name (api.nearplay.app) pointed to your server's IP
- NEAR testnet account with credentials
- Linux server (Ubuntu/Debian recommended)

## Deployment Steps

### 1. Initial Server Setup

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Install Docker Compose
sudo apt install docker-compose-plugin

# Add your user to docker group
sudo usermod -aG docker $USER
newgrp docker
```

### 2. Create Docker Network

Create the external proxy network that Traefik will use:

```bash
docker network create proxy
```

### 3. Setup Environment Variables

Copy the environment template and configure it:

```bash
cp .env.production.template .env.production
nano .env.production
```

Fill in your NEAR credentials:
- `NEAR_ACCOUNT_ID`: Your NEAR testnet account
- `NEAR_PRIVATE_KEY`: Private key from `~/.near-credentials/testnet/your-account.json`
- Update email address for Let's Encrypt

### 4. Deploy Traefik (Reverse Proxy)

Start Traefik first for SSL certificate generation:

```bash
# Start Traefik
docker-compose -f traefik-docker-compose.yml up -d

# Check Traefik logs
docker-compose -f traefik-docker-compose.yml logs -f
```

### 5. Build and Deploy Backend

```bash
# Build the Docker image
docker-compose build

# Start the backend service
docker-compose up -d

# Check logs
docker-compose logs -f near-backend
```

### 6. Verify Deployment

Test the health endpoint:

```bash
# From the server
curl http://localhost:8080/health

# From external (after DNS propagation)
curl https://api.nearplay.app/health
```

## Common Commands

### Service Management

```bash
# Start services
docker-compose up -d

# Stop services
docker-compose down

# Restart services
docker-compose restart

# View logs
docker-compose logs -f near-backend

# View all running containers
docker ps
```

### Updating the Application

```bash
# Pull latest code
git pull

# Rebuild and restart
docker-compose build
docker-compose up -d

# Or in one command
docker-compose up -d --build
```

### Monitoring

```bash
# Check container status
docker-compose ps

# View resource usage
docker stats

# Check health endpoint
curl http://localhost:8080/health

# View logs with timestamps
docker-compose logs -t -f --tail=100 near-backend
```

### Backup and Restore

```bash
# Backup volumes
docker run --rm -v near-playground_near-projects:/data -v $(pwd):/backup alpine tar czf /backup/projects-backup.tar.gz -C /data .

# Restore volumes
docker run --rm -v near-playground_near-projects:/data -v $(pwd):/backup alpine tar xzf /backup/projects-backup.tar.gz -C /data
```

## SSL Certificate Management

Traefik automatically handles SSL certificates via Let's Encrypt. Certificates are stored in the `letsencrypt` volume and auto-renewed.

To force certificate renewal:
```bash
docker-compose -f traefik-docker-compose.yml restart
```

## Troubleshooting

### Port Already in Use
```bash
# Check what's using port 80/443
sudo lsof -i :80
sudo lsof -i :443

# Kill the process or change Traefik ports
```

### Permission Issues
```bash
# Fix volume permissions
sudo chown -R 1000:1000 ./projects
sudo chmod -R 755 ./projects
```

### Container Won't Start
```bash
# Check logs
docker-compose logs near-backend

# Check environment variables
docker-compose config

# Rebuild from scratch
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```

### DNS Issues
```bash
# Check DNS propagation
nslookup api.nearplay.app
dig api.nearplay.app

# Test locally with /etc/hosts
echo "YOUR_SERVER_IP api.nearplay.app" | sudo tee -a /etc/hosts
```

### NEAR Connection Issues
```bash
# Test NEAR credentials
near login
near state YOUR_ACCOUNT_ID --networkId testnet

# Verify environment variables
docker-compose exec near-backend env | grep NEAR
```

## Production Checklist

- [ ] Domain DNS configured and propagated
- [ ] Environment variables set correctly
- [ ] SSL certificates generated
- [ ] Health endpoint responding
- [ ] CORS configured for frontend domain
- [ ] Firewall rules configured (ports 80, 443)
- [ ] Monitoring/alerting setup
- [ ] Backup strategy implemented
- [ ] Log rotation configured
- [ ] Resource limits set in docker-compose

## Security Notes

1. **Never commit `.env.production` to git** - it contains secrets
2. **Use strong passwords** for NEAR accounts
3. **Restrict firewall** to only necessary ports (80, 443)
4. **Regular updates** - Keep Docker and dependencies updated
5. **Monitor logs** for suspicious activity
6. **Rate limiting** is configured by default

## Support

For issues or questions:
- Check container logs: `docker-compose logs -f`
- Health endpoint: `https://api.nearplay.app/health`
- Traefik dashboard: `https://traefik.nearplay.app` (if enabled)