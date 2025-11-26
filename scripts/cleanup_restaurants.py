#!/usr/bin/env python3
"""
Data Cleanup Script - Remove Restaurants and Commercial Food Businesses
Keeps only legitimate food assistance resources
"""

import psycopg2
import os
from dotenv import load_dotenv

load_dotenv()

# Commercial food business indicators
COMMERCIAL_KEYWORDS = [
    # Restaurants
    'restaurant', 'grill', 'cafe', 'diner', 'bistro', 'eatery',
    'chicken shack', 'hot chicken', 'fish & chicken', 'fish and chicken',
    'pizza', 'burger', 'taco', 'bbq', 'bar & grill', 'bar and grill',
    'steakhouse', 'seafood', 'sushi', 'buffet', 'fast food',
    "mcdonald's", 'burger king', 'subway', 'taco bell', 'kfc',
    'popeyes', "wendy's", "arby's", 'chipotle', 'panera',
    'captain hooks', "dave's hot", "church's texas", 'brooster',
    'disco chicken', 'dolphin chicken', "byrd's hot", "harold's chicken",
    'pop-up chicken', 'chicken shop', 'food mart', 'off the hook',
    'wings', 'sports bar', 'pub', 'tavern', 'lounge',
    
    # Meal prep & coffee shops
    'meal prep', 'meal-prep', 'coffee shop', 'coffee', 'espresso',
    'bakery', 'cafe', 'café', 'patisserie', 'pastries',
    
    # Wholesalers & Distributors
    'wholesale', 'wholesaler', 'distributor', 'distribution center',
    'import', 'export', 'importer', 'exporter',
    'supplier', 'supply', 'vendor',
    
    # Big box stores
    'costco', 'walmart', "sam's club", 'target',
    
    # Food service companies
    'food service', 'foodservice', 'catering service',
    'vending', 'commercial food',
    
    # Manufacturers
    'manufacturing', 'manufacturer', 'processing', 'processor'
]

# Legitimate food assistance keywords (to keep)
FOOD_ASSISTANCE_KEYWORDS = [
    'food bank', 'food pantry', 'pantry', 'feeding', 
    'salvation army', 'catholic charities', 'community outreach',
    'st. vincent', 'food distribution center', 'food ministry',
    'soup kitchen', 'community kitchen', 'food shelf',
    'meals on wheels', 'emergency food', 'free food',
    'food rescue', 'food recovery', 'greater.*food depository',
    'community services', 'human services', 'family services',
    'loaves & fishes', 'loaves and fishes', 'food mission',
    'church.*food', 'temple.*food', 'synagogue.*food'
]

def connect_db():
    """Connect to PostgreSQL database"""
    return psycopg2.connect(
        host=os.getenv('DB_HOST', 'localhost'),
        port=os.getenv('DB_PORT', '5432'),
        database=os.getenv('DB_NAME', 'humanaid'),
        user=os.getenv('DB_USER', 'postgres'),
        password=os.getenv('DB_PASSWORD', 'humanaid2025')
    )

def is_commercial_business(name, website=''):
    """Check if a resource is a commercial food business (not food assistance)"""
    name_lower = name.lower()
    website_lower = (website or '').lower()
    
    # Check if name contains food assistance keywords (keep these)
    for keyword in FOOD_ASSISTANCE_KEYWORDS:
        if keyword in name_lower:
            return False
    
    # Check if name/website contains commercial keywords
    for keyword in COMMERCIAL_KEYWORDS:
        if keyword in name_lower or keyword in website_lower:
            return True
    
    return False

def find_commercial_businesses():
    """Find all resources that appear to be commercial businesses"""
    conn = connect_db()
    cur = conn.cursor()
    
    # Get all resources
    cur.execute("""
        SELECT id, name, address, city, state, website
        FROM resources
        WHERE is_active = true AND approval_status = 'approved'
        ORDER BY name
    """)
    
    resources = cur.fetchall()
    commercial = []
    
    for resource in resources:
        res_id, name, address, city, state, website = resource
        if is_commercial_business(name, website):
            commercial.append({
                'id': res_id,
                'name': name,
                'address': address,
                'city': city,
                'state': state,
                'website': website
            })
    
    cur.close()
    conn.close()
    
    return commercial

def remove_commercial_businesses(dry_run=True):
    """Remove commercial businesses from database"""
    businesses = find_commercial_businesses()
    
    print(f"\n{'='*80}")
    print(f"🔍 Found {len(businesses)} commercial businesses to remove")
    print(f"{'='*80}\n")
    
    if not businesses:
        print("✅ No commercial businesses found! Database is clean.")
        return
    
    # Show first 20
    print("First 20 commercial businesses found:\n")
    for i, biz in enumerate(businesses[:20], 1):
        print(f"{i}. {biz['name']}")
        print(f"   📍 {biz['address']}, {biz['city']}, {biz['state']}")
        if biz['website']:
            print(f"   🌐 {biz['website']}")
        print()
    
    if len(businesses) > 20:
        print(f"... and {len(businesses) - 20} more\n")
    
    if dry_run:
        print("🔵 DRY RUN MODE - No changes made to database")
        print("\nTo actually remove these, run:")
        print("  python cleanup_restaurants.py --remove")
        return
    
    # Confirm deletion
    print(f"\n⚠️  WARNING: This will DELETE {len(businesses)} resources!")
    response = input("Type 'DELETE' to confirm: ")
    
    if response != 'DELETE':
        print("❌ Cancelled. No changes made.")
        return
    
    # Delete businesses
    conn = connect_db()
    cur = conn.cursor()
    
    deleted = 0
    for biz in businesses:
        try:
            # Delete from resource_categories first (foreign key)
            cur.execute("DELETE FROM resource_categories WHERE resource_id = %s", (biz['id'],))
            # Delete resource
            cur.execute("DELETE FROM resources WHERE id = %s", (biz['id'],))
            deleted += 1
        except Exception as e:
            print(f"❌ Error deleting {biz['name']}: {str(e)}")
    
    conn.commit()
    cur.close()
    conn.close()
    
    print(f"\n✅ Deleted {deleted} commercial businesses from database")
    print(f"📊 Remaining resources: Check your app!")

def main():
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument('--remove', action='store_true', help='Actually remove commercial businesses (default is dry run)')
    args = parser.parse_args()
    
    remove_commercial_businesses(dry_run=not args.remove)

if __name__ == '__main__':
    main()
