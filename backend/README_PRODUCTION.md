# Production Database Access

## Security Notice ⚠️
The `.env.production` file contains **sensitive production credentials** and is:
- ✅ **Excluded from Git** (via `.gitignore`)
- ✅ **Stored locally only**
- ⚠️ **NEVER commit this file to version control**

## Production Database Details

**Instance**: humanaid-db-small (Google Cloud SQL)  
**Host**: 34.132.37.162  
**Database**: humanaid  
**Region**: us-central1-c  
**Type**: PostgreSQL 14  

## Quick Access

### Option 1: Use the helper script (Recommended)
```bash
# From project root
./scripts/connect_to_production_db.sh
```

### Option 2: Manual connection
```bash
# Load credentials
source backend/.env.production

# Connect
PGPASSWORD="$DB_PASSWORD" psql -h $DB_HOST -U $DB_USER -d $DB_NAME
```

## Running SQL Scripts on Production

```bash
# Load environment
source backend/.env.production

# Run a script
PGPASSWORD="$DB_PASSWORD" psql -h $DB_HOST -U $DB_USER -d $DB_NAME < script.sql

# Run a query
PGPASSWORD="$DB_PASSWORD" psql -h $DB_HOST -U $DB_USER -d $DB_NAME -c "SELECT COUNT(*) FROM resources;"
```

## Common Queries

### Check database stats
```sql
SELECT 
  (SELECT COUNT(*) FROM resources) as total_resources,
  (SELECT COUNT(*) FROM categories) as total_categories,
  (SELECT COUNT(*) FROM resource_categories) as total_categorizations;
```

### View category distribution
```sql
SELECT c.name, COUNT(rc.resource_id) as count
FROM categories c 
LEFT JOIN resource_categories rc ON c.id = rc.category_id 
GROUP BY c.id, c.name
ORDER BY count DESC;
```

### Check empty categories
```sql
SELECT c.name
FROM categories c 
LEFT JOIN resource_categories rc ON c.id = rc.category_id 
GROUP BY c.id, c.name
HAVING COUNT(rc.resource_id) = 0;
```

## Backup Production Database

```bash
source backend/.env.production
PGPASSWORD="$DB_PASSWORD" pg_dump -h $DB_HOST -U $DB_USER $DB_NAME > backup_$(date +%Y%m%d).sql
```

## Restore from Backup

```bash
source backend/.env.production
PGPASSWORD="$DB_PASSWORD" psql -h $DB_HOST -U $DB_USER $DB_NAME < backup_file.sql
```

## Production Environment Variables (Google Cloud Run)

The backend service running on Cloud Run uses environment variables set in the deployment:
- Database credentials
- API keys
- JWT secrets
- CORS origins

Store or update the database password in Google Secret Manager. Reference the
secret by name and a pinned version when binding it to the Firebase Function or
to Cloud Run's runtime `DB_PASSWORD` variable. Apply bindings only through a
separately approved release. Never put plaintext passwords in command-line
arguments or ordinary deployment environment-variable assignments.

## Security Best Practices

1. ✅ **Never commit** `.env.production` to Git
2. ✅ **Use read-only access** when possible
3. ✅ **Test changes locally** before applying to production
4. ✅ **Create backups** before major operations
5. ✅ **Monitor query performance** on production
6. ✅ **Use transactions** for multi-step operations
7. ✅ **Keep credentials secure** - don't share in Slack/email

## Troubleshooting

### Connection timeout
- Check if your IP is whitelisted in Google Cloud SQL
- Verify firewall rules allow PostgreSQL port (5432)

### Authentication failed
- Verify password in `.env.production` is correct
- Check user permissions in database

### SSL/TLS errors
- Add `sslmode=require` to connection string if needed
- Use Cloud SQL Proxy for secure connections

## Contact

If you need to update production credentials or access:
- Check Google Cloud Console: https://console.cloud.google.com
- Project: gocasino-1ecc9
- SQL Instance: humanaid-db-small
