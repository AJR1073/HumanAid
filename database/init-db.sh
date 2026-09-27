#!/bin/bash
# Database initialization script for HumanAid

echo "🗄️  Initializing HumanAid Database..."

# Database credentials (modify as needed)
DB_NAME="humanaid"
DB_USER="postgres"
DB_HOST="localhost"
DB_PORT="5432"

# Check if PGPASSWORD is set, otherwise use sudo for postgres user
if [ -z "$PGPASSWORD" ]; then
    echo "ℹ️  No PGPASSWORD set, using sudo authentication"
    USE_SUDO=true
else
    echo "ℹ️  Using password authentication"
    USE_SUDO=false
fi

# Check if PostgreSQL is running
if ! pg_isready -h $DB_HOST -p $DB_PORT > /dev/null 2>&1; then
    echo "❌ PostgreSQL is not running on $DB_HOST:$DB_PORT"
    echo "Please start PostgreSQL first."
    exit 1
fi

echo "✅ PostgreSQL is running"

# Create database if it doesn't exist
echo "📦 Creating database '$DB_NAME'..."
if [ "$USE_SUDO" = true ]; then
    sudo -u postgres psql -tc "SELECT 1 FROM pg_database WHERE datname = '$DB_NAME'" | grep -q 1 || \
        sudo -u postgres psql -c "CREATE DATABASE $DB_NAME"
else
    PGPASSWORD=$PGPASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -tc "SELECT 1 FROM pg_database WHERE datname = '$DB_NAME'" | grep -q 1 || \
        PGPASSWORD=$PGPASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -c "CREATE DATABASE $DB_NAME"
fi

echo "✅ Database created/verified"

# Run schema
echo "📊 Creating database schema..."
if [ "$USE_SUDO" = true ]; then
    sudo -u postgres psql -d $DB_NAME -f schema.sql
else
    PGPASSWORD=$PGPASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -f schema.sql
fi

if [ $? -eq 0 ]; then
    echo "✅ Schema created successfully"
else
    echo "❌ Schema creation failed"
    exit 1
fi

# Run seeds if they exist
if [ -d "seeds" ] && [ "$(ls -A seeds/*.sql 2>/dev/null)" ]; then
    echo "🌱 Seeding database..."
    for seed_file in seeds/*.sql; do
        echo "   - Running $(basename $seed_file)..."
        if [ "$USE_SUDO" = true ]; then
            sudo -u postgres psql -d $DB_NAME -f "$seed_file"
        else
            PGPASSWORD=$PGPASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $DB_NAME -f "$seed_file"
        fi
    done
    echo "✅ Database seeded successfully"
fi

echo ""
echo "🎉 Database initialization complete!"
echo ""
echo "Database Info:"
echo "  - Database: $DB_NAME"
echo "  - User: $DB_USER"
echo "  - Host: $DB_HOST"
echo "  - Port: $DB_PORT"
echo ""
echo "Next steps:"
echo "  1. Copy backend/.env.example to backend/.env"
echo "  2. Configure backend/.env with your own local database credentials"
echo "  3. Run 'npm install' in backend and frontend directories"
echo "  4. Run 'npm run dev' in both directories"
