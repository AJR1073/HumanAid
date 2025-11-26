#!/usr/bin/env python3
"""
Remove business/commercial organizations from database
These are chambers of commerce, theaters, convention centers, etc.
"""

import psycopg2
import os
from dotenv import load_dotenv

load_dotenv()

# Keywords for business/commercial organizations to remove
BUSINESS_ORG_KEYWORDS = [
    'chamber of commerce',
    'convention center',
    'philharmonic',
    'symphony',
    'theater',
    'theatre',
    'museum',
    'historical society',
    'arts council',
    'studio',
    'gallery',
    'performing arts'
]

# Keep these even if they match (food-related)
KEEP_KEYWORDS = [
    'food bank', 'food pantry', 'food distribution', 'soup kitchen',
    'feeding', 'meals', 'food ministry', 'community kitchen',
    'food shelf', 'emergency food', 'food rescue'
]

def connect_db():
    return psycopg2.connect(
        host=os.getenv('DB_HOST', 'localhost'),
        port=os.getenv('DB_PORT', '5432'),
        database=os.getenv('DB_NAME', 'humanaid'),
        user=os.getenv('DB_USER', 'postgres'),
        password=os.getenv('DB_PASSWORD', 'humanaid2025')
    )

def find_business_orgs():
    """Find business organizations to remove"""
    conn = connect_db()
    cur = conn.cursor()
    
    cur.execute("""
        SELECT id, name, address, city, state, website
        FROM resources
        WHERE is_active = true AND approval_status = 'approved'
        ORDER BY name
    """)
    
    resources = cur.fetchall()
    to_remove = []
    
    for resource in resources:
        res_id, name, address, city, state, website = resource
        name_lower = name.lower()
        
        # Keep if food-related
        if any(kw in name_lower for kw in KEEP_KEYWORDS):
            continue
        
        # Remove if business org
        if any(kw in name_lower for kw in BUSINESS_ORG_KEYWORDS):
            to_remove.append({
                'id': res_id,
                'name': name,
                'address': address,
                'city': city,
                'state': state,
                'website': website
            })
    
    cur.close()
    conn.close()
    
    return to_remove

def remove_business_orgs(dry_run=True):
    """Remove business organizations"""
    orgs = find_business_orgs()
    
    print(f"\n{'='*80}")
    print(f"🔍 Found {len(orgs)} business organizations to remove")
    print(f"{'='*80}\n")
    
    if not orgs:
        print("✅ No business organizations found!")
        return
    
    for i, org in enumerate(orgs, 1):
        print(f"{i}. {org['name']}")
        print(f"   📍 {org['address']}, {org['city']}, {org['state']}")
        if org['website']:
            print(f"   🌐 {org['website']}")
        print()
    
    if dry_run:
        print("🔵 DRY RUN MODE - No changes made")
        print("\nTo remove these, run:")
        print("  python cleanup_business_orgs.py --remove")
        return
    
    # Confirm
    print(f"\n⚠️  WARNING: This will DELETE {len(orgs)} resources!")
    response = input("Type 'DELETE' to confirm: ")
    
    if response != 'DELETE':
        print("❌ Cancelled.")
        return
    
    # Delete
    conn = connect_db()
    cur = conn.cursor()
    
    deleted = 0
    for org in orgs:
        try:
            cur.execute("DELETE FROM resource_categories WHERE resource_id = %s", (org['id'],))
            cur.execute("DELETE FROM resources WHERE id = %s", (org['id'],))
            deleted += 1
        except Exception as e:
            print(f"❌ Error deleting {org['name']}: {str(e)}")
    
    conn.commit()
    cur.close()
    conn.close()
    
    print(f"\n✅ Deleted {deleted} business organizations")

def main():
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument('--remove', action='store_true')
    args = parser.parse_args()
    
    remove_business_orgs(dry_run=not args.remove)

if __name__ == '__main__':
    main()
