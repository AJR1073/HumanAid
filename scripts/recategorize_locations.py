#!/usr/bin/env python3
"""
Recategorize Non-Food Locations
Moves parks, recreation centers, etc. to appropriate categories
"""

import psycopg2
import os
from dotenv import load_dotenv

load_dotenv()

def connect_db():
    return psycopg2.connect(
        host=os.getenv('DB_HOST', 'localhost'),
        port=os.getenv('DB_PORT', '5432'),
        database=os.getenv('DB_NAME', 'humanaid'),
        user=os.getenv('DB_USER', 'postgres'),
        password=os.getenv('DB_PASSWORD', 'humanaid2025')
    )

# Category mappings
RECATEGORIZE_RULES = [
    {
        'keywords': ['senior center', 'senior services', 'senior citizens', 'older persons', 
                     'aging', 'elderly', 'council on aging', 'agency on aging', 
                     'senior living', 'senior care', 'senior home'],
        'new_category': 'senior-centers',
        'category_name': 'Senior Centers'
    },
    {
        'keywords': ['park district', 'recreation center', 'rec center', 'community center'],
        'new_category': 'community-centers',
        'category_name': 'Community Centers'
    },
    {
        'keywords': ['vfw post', 'american legion', 'veterans post'],
        'new_category': 'veterans-services',
        'category_name': 'Veterans Services'
    },
    {
        'keywords': ['library', 'public library'],
        'new_category': 'education',
        'category_name': 'Education & Libraries'
    },
    {
        'keywords': ['gymnasium', 'fitness center', 'gym', 'ymca', 'ywca'],
        'new_category': 'recreation',
        'category_name': 'Recreation & Fitness'
    }
]

# Keep in food categories if these keywords present
FOOD_KEYWORDS = [
    'food bank', 'food pantry', 'food distribution', 'soup kitchen',
    'feeding', 'meals on wheels', 'food ministry', 'community kitchen',
    'food shelf', 'emergency food'
]

def ensure_categories_exist(conn):
    """Create new categories if they don't exist"""
    cur = conn.cursor()
    
    categories_to_create = [
        ('senior-centers', 'Senior Centers', 'Services for seniors and older adults', 'both'),
        ('community-centers', 'Community Centers', 'Community centers and gathering places', 'both'),
        ('recreation', 'Recreation & Fitness', 'Recreation centers, gyms, and fitness facilities', 'both'),
        ('education', 'Education & Libraries', 'Libraries and educational resources', 'both'),
        ('veterans-services', 'Veterans Services', 'Services specifically for veterans', 'both')
    ]
    
    for slug, name, description, mode in categories_to_create:
        # Check if exists
        cur.execute("SELECT id FROM categories WHERE slug = %s", (slug,))
        if cur.fetchone():
            print(f"  ✓ Category '{name}' already exists")
        else:
            cur.execute("""
                INSERT INTO categories (name, slug, description, mode, parent_id)
                VALUES (%s, %s, %s, %s, NULL)
            """, (name, slug, description, mode))
            print(f"  ✓ Created category '{name}'")
    
    conn.commit()
    cur.close()

def find_resources_to_recategorize(conn):
    """Find resources that need recategorization"""
    cur = conn.cursor()
    
    cur.execute("""
        SELECT r.id, r.name, r.address, r.city, r.state
        FROM resources r
        WHERE r.is_active = true AND r.approval_status = 'approved'
        ORDER BY r.name
    """)
    
    resources = cur.fetchall()
    to_recategorize = []
    
    for resource in resources:
        res_id, name, address, city, state = resource
        name_lower = name.lower()
        
        # Skip if it has food keywords (keep in food categories)
        if any(kw in name_lower for kw in FOOD_KEYWORDS):
            continue
        
        # Check if it matches recategorization rules
        for rule in RECATEGORIZE_RULES:
            if any(kw in name_lower for kw in rule['keywords']):
                to_recategorize.append({
                    'id': res_id,
                    'name': name,
                    'city': city,
                    'state': state,
                    'new_category': rule['new_category'],
                    'category_name': rule['category_name']
                })
                break
    
    cur.close()
    return to_recategorize

def recategorize_resources(dry_run=True):
    """Recategorize resources"""
    conn = connect_db()
    
    print("\n📋 Step 1: Ensuring categories exist...")
    ensure_categories_exist(conn)
    
    print("\n🔍 Step 2: Finding resources to recategorize...")
    to_recategorize = find_resources_to_recategorize(conn)
    
    if not to_recategorize:
        print("✅ No resources need recategorization!")
        conn.close()
        return
    
    # Group by category
    by_category = {}
    for res in to_recategorize:
        cat = res['category_name']
        if cat not in by_category:
            by_category[cat] = []
        by_category[cat].append(res)
    
    print(f"\n{'='*80}")
    print(f"📊 Found {len(to_recategorize)} resources to recategorize")
    print(f"{'='*80}\n")
    
    for cat_name, resources in by_category.items():
        print(f"\n{cat_name}: {len(resources)} resources")
        for i, res in enumerate(resources[:10], 1):
            print(f"  {i}. {res['name']} - {res['city']}, {res['state']}")
        if len(resources) > 10:
            print(f"  ... and {len(resources) - 10} more")
    
    if dry_run:
        print(f"\n🔵 DRY RUN MODE - No changes made")
        print("\nTo recategorize, run:")
        print("  python recategorize_locations.py --recategorize")
        conn.close()
        return
    
    # Confirm
    print(f"\n⚠️  This will recategorize {len(to_recategorize)} resources!")
    response = input("Type 'RECATEGORIZE' to confirm: ")
    
    if response != 'RECATEGORIZE':
        print("❌ Cancelled.")
        conn.close()
        return
    
    # Recategorize
    cur = conn.cursor()
    updated = 0
    
    for res in to_recategorize:
        try:
            # Get the category ID
            cur.execute("SELECT id FROM categories WHERE slug = %s", (res['new_category'],))
            cat_result = cur.fetchone()
            if not cat_result:
                print(f"⚠️  Category {res['new_category']} not found for {res['name']}")
                continue
            
            category_id = cat_result[0]
            
            # Remove old categories
            cur.execute("DELETE FROM resource_categories WHERE resource_id = %s", (res['id'],))
            
            # Add new category
            cur.execute("""
                INSERT INTO resource_categories (resource_id, category_id)
                VALUES (%s, %s)
                ON CONFLICT DO NOTHING
            """, (res['id'], category_id))
            
            updated += 1
        except Exception as e:
            print(f"❌ Error updating {res['name']}: {str(e)}")
    
    conn.commit()
    cur.close()
    conn.close()
    
    print(f"\n✅ Recategorized {updated} resources!")

def main():
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument('--recategorize', action='store_true')
    args = parser.parse_args()
    
    recategorize_resources(dry_run=not args.recategorize)

if __name__ == '__main__':
    main()
