#!/bin/bash
# Helper script to connect to production PostgreSQL database
# This uses credentials from backend/.env.production

set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${YELLOW}🔐 Connecting to Production Database...${NC}"

# Check if .env.production exists
if [ ! -f "backend/.env.production" ]; then
    echo -e "${RED}❌ Error: backend/.env.production not found!${NC}"
    echo "Create it with production credentials first."
    exit 1
fi

# Load environment variables
source backend/.env.production

# Validate required variables
if [ -z "$DB_HOST" ] || [ -z "$DB_USER" ] || [ -z "$DB_PASSWORD" ] || [ -z "$DB_NAME" ]; then
    echo -e "${RED}❌ Error: Missing required database credentials in .env.production${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Connecting to: $DB_HOST:$DB_PORT/$DB_NAME as $DB_USER${NC}"
echo ""

# Connect to PostgreSQL
PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME"
