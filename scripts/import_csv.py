#!/usr/bin/env python3
"""
CSV Resource Importer for HumanAid
Imports resources from CSV into PostgreSQL database
"""

import os
import csv
import sys
import argparse
import psycopg2
from psycopg2.extras import execute_values
import re

# Add parent directory to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

# Category mapping
CATEGORY_MAPPING = {
    'food-pantries': 'food-pantries',
    'food bank': 'food-pantries',
    'food pantry': 'food-pantries',
    'emergency-shelters': 'emergency-shelters',
    'homeless shelter': 'emergency-shelters',
    'shelter': 'emergency-shelters',
    'free-clinics': 'free-clinics',
    'health center': 'free-clinics',
    'clinic': 'free-clinics',
    'mental-health': 'mental-health',
    'counseling': 'mental-health',
    'substance-abuse': 'substance-abuse',
    'rehab': 'substance-abuse',
    'legal-aid': 'legal-aid',
    'job-training': 'job-training',
    'employment': 'job-search',
    'clothing': 'clothing',
}

class ResourceImporter:
    def __init__(self, db_config):
        self.conn = psycopg2.connect(**db_config)
        self.cursor = self.conn.cursor()
        self.imported_count = 0
        self.skipped_count = 0
        self.error_count = 0
    
    def import_from_csv(self, filename):
        """Import resources from CSV file"""
        print(f"\n📂 Reading {filename}...")
        
        with open(filename, 'r', encoding='utf-8') as csvfile:
            reader = csv.DictReader(csvfile)
            resources = list(reader)
        
        print(f"📊 Found {len(resources)} resources to import")
        
        for i, resource in enumerate(resources, 1):
            if i % 10 == 0:
                print(f"  Processing {i}/{len(resources)}...", end='\r')
            
            try:
                self._import_resource(resource)
            except Exception as e:
                print(f"\n❌ Error importing {resource.get('name', 'Unknown')}: {str(e)}")
                self.error_count += 1
        
        self.conn.commit()
        
        print(f"\n\n✅ Import complete!")
        print(f"   Imported: {self.imported_count}")
        print(f"   Skipped (duplicates): {self.skipped_count}")
        print(f"   Errors: {self.error_count}")
    
    def _import_resource(self, resource):
        """Import a single resource"""
        # Validate required fields
        if not resource.get('name') or not resource.get('city'):
            self.skipped_count += 1
            return
        
        # Check for duplicates
        if self._is_duplicate(resource['name'], resource.get('address', '')):
            self.skipped_count += 1
            return
        
        # Create slug
        slug = re.sub(r'[^a-z0-9]+', '-', resource['name'].lower()).strip('-')
        
        # Insert resource
        self.cursor.execute("""
            INSERT INTO resources (
                name, slug, address, city, state, zip_code,
                location, phone, website, description,
                approval_status, is_active, verified
            ) VALUES (
                %s, %s, %s, %s, %s, %s,
                ST_SetSRID(ST_MakePoint(%s, %s), 4326),
                %s, %s, %s, 'approved', true, false
            )
            RETURNING id
        """, (
            resource['name'],
            slug + '-' + str(hash(resource['name']))[:8],
            resource.get('address', ''),
            resource['city'],
            resource['state'],
            resource.get('zip_code', resource.get('zip', '')),
            float(resource.get('longitude', 0)),
            float(resource.get('latitude', 0)),
            resource.get('phone', ''),
            resource.get('website', ''),
            resource.get('description', f"{resource['name']} in {resource['city']}, {resource['state']}")
        ))
        
        resource_id = self.cursor.fetchone()[0]
        
        # Link to category
        category_slug = self._map_category(resource.get('category', ''))
        if category_slug:
            self._link_category(resource_id, category_slug)
        
        self.imported_count += 1
    
    def _is_duplicate(self, name, address):
        """Check if resource already exists"""
        self.cursor.execute("""
            SELECT COUNT(*) FROM resources 
            WHERE LOWER(name) = LOWER(%s) 
            OR (address != '' AND LOWER(address) = LOWER(%s))
        """, (name, address))
        
        count = self.cursor.fetchone()[0]
        return count > 0
    
    def _map_category(self, category):
        """Map category name to slug"""
        category_lower = category.lower()
        return CATEGORY_MAPPING.get(category_lower, None)
    
    def _link_category(self, resource_id, category_slug):
        """Link resource to category"""
        self.cursor.execute("""
            INSERT INTO resource_categories (resource_id, category_id)
            SELECT %s, id FROM categories WHERE slug = %s
            ON CONFLICT DO NOTHING
        """, (resource_id, category_slug))
    
    def close(self):
        """Close database connection"""
        self.cursor.close()
        self.conn.close()

def main():
    parser = argparse.ArgumentParser(description='Import resources from CSV to database')
    parser.add_argument('--file', required=True, help='CSV file to import')
    parser.add_argument('--db-host', default='localhost', help='Database host')
    parser.add_argument('--db-port', default='5432', help='Database port')
    parser.add_argument('--db-name', default='humanaid', help='Database name')
    parser.add_argument('--db-user', default='postgres', help='Database user')
    parser.add_argument('--db-password', help='Database password (or set DB_PASSWORD env var)')
    
    args = parser.parse_args()
    
    # Database config
    db_config = {
        'host': args.db_host,
        'port': args.db_port,
        'database': args.db_name,
        'user': args.db_user,
        'password': args.db_password or os.environ.get('DB_PASSWORD', 'humanaid2025')
    }
    
    # Import resources
    importer = ResourceImporter(db_config)
    
    try:
        importer.import_from_csv(args.file)
    finally:
        importer.close()
    
    return 0

if __name__ == '__main__':
    exit(main())
