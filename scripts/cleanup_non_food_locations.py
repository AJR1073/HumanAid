#!/usr/bin/env python3
"""
Data Cleanup - Remove Non-Food Locations
Removes parks, recreation centers, gyms, libraries, VFW posts, etc.
"""

import psycopg2
import os
from dotenv import load_dotenv

load_dotenv()

# Non-food location indicators
NON_FOOD_KEYWORDS = [
    # Parks and Recreation
    'park district', 'recreation center', 'rec center', 'recreation department',
    'community center', 'civic center', 'nature center',
    
    # Athletic facilities
    'gymnasium', 'fitness center', 'gym', 'ymca', 'ywca',
    'bowling', 'sports complex', 'athletic center',
    
    # Veterans organizations (unless food-related)
    'vfw post', 'american legion post', 'veterans of foreign wars',
    
    # Libraries
    'public library', 'library district',
    
    # Other
    'pavilion', 'shelter house',
]

# Keep these even if they match above (food-related community centers)
KEEP_KEYWORDS = [
    'food bank', 'food pantry', 'food distribution', 'soup kitchen',
    'feeding', 'meals on wheels', 'food ministry', 'community kitchen',
    'catholic charities', 'salvation army', 'food rescue',
    'st. vincent', 'food shelf', 'emergency food'
]

def connect_db():
    return psycopg2.connect(
        host=os.getenv('DB_HOST', 'localhost'),
        port=os.getenv('DB_PORT', '5432'),
        database=os.getenv('DB_NAME', 'humanaid'),
        user=os.getenv('DB_USER', 'postgres'),
        password=os.getenv('DB_PASSWORD', 'humanaid2025')
    )

def is_non_food_location(name, website=''):
    """Check if location is not food assistance"""
    name_lower = name.lower()
    website_lower = (website or '').lower()
    
    # Keep if it has food assistance keywords
    for keyword in KEEP_KEYWORDS:
        if keyword in name_lower:
            return False
    
    # Remove if it matches non-food keywords
    for keyword in NON_FOOD_KEYWORDS:
        if keyword in name_lower:
            return True
    
    return False

def find_non_food_locations():
    """Find non-food locations"""
    conn = connect_db()
    cur = conn.cursor()
    
    cur.execute("""
        SELECT id, name, address, city, state, website
        FROM resources
        WHERE is_active = true AND approval_status = 'approved'
        ORDER BY name
    """)
    
    resources = cur.fetchall()
    non_food = []
    
    for resource in resources:
        res_id, name, address, city, state, website = resource
        if is_non_food_location(name, website):
            non_food.append({
                'id': res_id,
                'name': name,
                'address': address,
                'city': city,
                'state': state,
                'website': website
            })
    
    cur.close()
    conn.close()
    
    return non_food

def remove_non_food_locations(dry_run=True):
    """Remove non-food locations from database"""
    locations = find_non_food_locations()
    
    print(f"\n{'='*80}")
    print(f"🔍 Found {len(locations)} non-food locations to remove")
    print(f"{'='*80}\n")
    
    if not locations:
        print("✅ No non-food locations found!")
        return
    
    # Show first 30
    print("First 30 non-food locations:\n")
    for i, loc in enumerate(locations[:30], 1):
        print(f"{i}. {loc['name']}")
        print(f"   📍 {loc['address']}, {loc['city']}, {loc['state']}")
        if loc['website']:
            print(f"   🌐 {loc['website']}")
        print()
    
    if len(locations) > 30:
        print(f"... and {len(locations) - 30} more\n")
    
    if dry_run:
        print("🔵 DRY RUN MODE - No changes made")
        print("\nTo remove these, run:")
        print("  python cleanup_non_food_locations.py --remove")
        return
    
    # Confirm deletion
    print(f"\n⚠️  WARNING: This will DELETE {len(locations)} resources!")
    response = input("Type 'DELETE' to confirm: ")
    
    if response != 'DELETE':
        print("❌ Cancelled.")
        return
    
    # Delete
    conn = connect_db()
    cur = conn.cursor()
    
    deleted = 0
    for loc in locations:
        try:
            cur.execute("DELETE FROM resource_categories WHERE resource_id = %s", (loc['id'],))
            cur.execute("DELETE FROM resources WHERE id = %s", (loc['id'],))
            deleted += 1
        except Exception as e:
            print(f"❌ Error deleting {loc['name']}: {str(e)}")
    
    conn.commit()
    cur.close()
    conn.close()
    
    print(f"\n✅ Deleted {deleted} non-food locations")

def main():
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument('--remove', action='store_true')
    args = parser.parse_args()
    
    remove_non_food_locations(dry_run=not args.remove)

if __name__ == '__main__':
    main()
