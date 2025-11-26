#!/usr/bin/env python3
"""
Comprehensive Database Validation and Auto-Categorization
Checks every resource and automatically categorizes, recategorizes, or removes
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

# REMOVE these commercial businesses
REMOVE_KEYWORDS = [
    # Restaurants & Food Service
    'restaurant', 'grill', 'diner', 'bistro', 'eatery', 'burger', 'pizza', 'taco',
    'bbq', 'bar & grill', 'steakhouse', 'seafood', 'sushi', 'buffet', 'fast food',
    'chicken shack', 'sports bar', 'pub', 'tavern', 'lounge', 'wings',
    'meal prep', 'meal-prep', 'coffee shop', 'coffee', 'espresso', 'bakery', 'café',
    
    # Wholesalers & Distributors
    'wholesale', 'distributor', 'distribution center', 'supply', 'vendor',
    'import', 'export', 'manufacturer', 'processing',
    
    # Business Organizations
    'chamber of commerce', 'convention center', 'philharmonic', 'symphony',
    'theater', 'theatre', 'museum', 'gallery', 'arts council',
]

# KEEP even if they match remove keywords (legitimate food assistance)
KEEP_KEYWORDS = [
    'food bank', 'food pantry', 'food distribution center', 'soup kitchen',
    'feeding', 'meals on wheels', 'food ministry', 'community kitchen',
    'food shelf', 'emergency food', 'food rescue', 'food recovery',
    'salvation army', 'catholic charities', 'st. vincent', 'loaves & fishes'
]

# AUTO-CATEGORIZATION RULES (in priority order)
CATEGORIZATION_RULES = [
    # Family & Child Services
    {
        'keywords': ['child care', 'childcare', 'early childhood', 'head start', 
                     'foster care', 'adoption', 'family services', 'family counseling',
                     'parenting', 'youth programs', 'children\'s home', 'family support'],
        'exclude': ['food', 'pantry'],
        'category': 'family-shelters',
        'action': 'Family Services'
    },
    
    # Health Services
    {
        'keywords': ['clinic', 'health center', 'medical', 'dental', 'vision', 
                     'hospital', 'urgent care', 'health department'],
        'exclude': ['food', 'pantry', 'meal'],
        'category': 'free-clinics',
        'action': 'Health Services'
    },
    {
        'keywords': ['mental health', 'counseling', 'therapy', 'psychiatric', 'behavioral health'],
        'exclude': ['family counseling', 'parenting'],
        'category': 'mental-health',
        'action': 'Mental Health Services'
    },
    
    # Senior Services
    {
        'keywords': ['senior center', 'senior services', 'senior citizens', 'older persons',
                     'aging', 'elderly', 'council on aging', 'agency on aging'],
        'category': 'senior-centers',
        'action': 'Senior Centers'
    },
    
    # Veterans Services
    {
        'keywords': ['veterans', 'vfw', 'american legion', 'veterans affairs', 'va '],
        'category': 'veterans-services',
        'action': 'Veterans Services'
    },
    
    # Housing & Shelters
    {
        'keywords': ['shelter', 'housing', 'homeless', 'transitional', 'emergency shelter'],
        'category': 'emergency-shelters',
        'action': 'Shelters & Housing'
    },
    
    # Legal Services
    {
        'keywords': ['legal aid', 'legal services', 'law', 'attorney', 'lawyer'],
        'category': 'free-legal-aid',
        'action': 'Legal Services'
    },
    
    # Community Centers & Organizations
    {
        'keywords': ['community center', 'recreation center', 'rec center', 'park district',
                     'community organization', 'community initiative', 'community of character',
                     'civic center', 'neighborhood center'],
        'category': 'community-centers',
        'action': 'Community Centers'
    },
    
    # Recreation & Fitness
    {
        'keywords': ['ymca', 'ywca', 'gym', 'gymnasium', 'fitness center'],
        'category': 'recreation',
        'action': 'Recreation & Fitness'
    },
    
    # Education
    {
        'keywords': ['library', 'school', 'education'],
        'exclude': ['food'],
        'category': 'education',
        'action': 'Education & Libraries'
    },
    
    # Clothing
    {
        'keywords': ['clothing', 'clothes', 'thrift store', 'thrift shop', 'resale'],
        'category': 'clothing-closets',
        'action': 'Clothing Closets'
    },
    
    # Job Services
    {
        'keywords': ['job', 'employment', 'career', 'workforce', 'training'],
        'category': 'job-training',
        'action': 'Job Training & Employment'
    },
    
    # Food Assistance (must be explicit)
    {
        'keywords': ['food bank', 'food pantry', 'soup kitchen', 'food distribution',
                     'food ministry', 'meals on wheels', 'feeding', 'food shelf'],
        'category': 'food-pantries',
        'action': 'Food Pantries'
    },
]

def should_remove(name, website=''):
    """Check if resource should be removed (commercial business)"""
    name_lower = name.lower()
    website_lower = (website or '').lower()
    
    # Keep if legitimate food assistance
    for keyword in KEEP_KEYWORDS:
        if keyword in name_lower:
            return False
    
    # Remove if commercial
    for keyword in REMOVE_KEYWORDS:
        if keyword in name_lower or keyword in website_lower:
            return True
    
    return False

def get_correct_category(name, description=''):
    """Determine the correct category for a resource"""
    text = (name + ' ' + (description or '')).lower()
    
    for rule in CATEGORIZATION_RULES:
        # Check if matches keywords
        if any(kw in text for kw in rule['keywords']):
            # Check exclusions if any
            if 'exclude' in rule and any(ex in text for ex in rule['exclude']):
                continue
            return rule['category'], rule['action']
    
    return None, None

def validate_database(dry_run=True):
    """Validate and fix all resources in database"""
    conn = connect_db()
    cur = conn.cursor()
    
    # Get all resources
    cur.execute("""
        SELECT r.id, r.name, r.description, r.city, r.state, r.website,
               array_agg(c.slug) as current_categories
        FROM resources r
        LEFT JOIN resource_categories rc ON r.id = rc.resource_id
        LEFT JOIN categories c ON rc.category_id = c.id
        WHERE r.is_active = true AND r.approval_status = 'approved'
        GROUP BY r.id
        ORDER BY r.name
    """)
    
    resources = cur.fetchall()
    
    # Statistics
    to_remove = []
    to_recategorize = []
    correctly_categorized = []
    
    print(f"\n{'='*80}")
    print(f"🔍 Validating {len(resources)} resources...")
    print(f"{'='*80}\n")
    
    for resource in resources:
        res_id, name, description, city, state, website, current_cats = resource
        
        # Check if should be removed
        if should_remove(name, website):
            to_remove.append({
                'id': res_id,
                'name': name,
                'city': city,
                'state': state,
                'reason': 'Commercial business'
            })
            continue
        
        # Get correct category
        correct_cat, action = get_correct_category(name, description)
        
        if correct_cat:
            # Check if already correctly categorized
            if current_cats and correct_cat in current_cats:
                correctly_categorized.append(name)
            else:
                to_recategorize.append({
                    'id': res_id,
                    'name': name,
                    'city': city,
                    'state': state,
                    'current': current_cats[0] if current_cats else 'None',
                    'new_category': correct_cat,
                    'action': action
                })
    
    # Print summary
    print(f"📊 VALIDATION SUMMARY:")
    print(f"  ✅ Correctly categorized: {len(correctly_categorized)}")
    print(f"  🔄 Need recategorization: {len(to_recategorize)}")
    print(f"  ❌ Should be removed: {len(to_remove)}")
    print(f"{'='*80}\n")
    
    # Show removals
    if to_remove:
        print(f"\n❌ RESOURCES TO REMOVE ({len(to_remove)}):")
        for i, res in enumerate(to_remove[:20], 1):
            print(f"{i}. {res['name']} - {res['city']}, {res['state']}")
            print(f"   Reason: {res['reason']}")
        if len(to_remove) > 20:
            print(f"   ... and {len(to_remove) - 20} more")
    
    # Show recategorizations by action
    if to_recategorize:
        print(f"\n🔄 RESOURCES TO RECATEGORIZE ({len(to_recategorize)}):")
        
        by_action = {}
        for res in to_recategorize:
            action = res['action']
            if action not in by_action:
                by_action[action] = []
            by_action[action].append(res)
        
        for action, items in sorted(by_action.items()):
            print(f"\n{action}: {len(items)} resources")
            for i, res in enumerate(items[:5], 1):
                print(f"  {i}. {res['name']} - {res['city']}, {res['state']}")
                print(f"     Current: {res['current']} → New: {action}")
            if len(items) > 5:
                print(f"  ... and {len(items) - 5} more")
    
    if dry_run:
        print(f"\n🔵 DRY RUN MODE - No changes made")
        print("\nTo apply fixes, run:")
        print("  python validate_and_categorize.py --fix")
        cur.close()
        conn.close()
        return
    
    # Confirm
    print(f"\n⚠️  WARNING: This will:")
    print(f"  - DELETE {len(to_remove)} commercial businesses")
    print(f"  - RECATEGORIZE {len(to_recategorize)} resources")
    response = input("\nType 'FIX' to confirm: ")
    
    if response != 'FIX':
        print("❌ Cancelled.")
        cur.close()
        conn.close()
        return
    
    # Apply fixes
    print("\n🔧 Applying fixes...")
    
    # Remove commercial businesses
    removed = 0
    for res in to_remove:
        try:
            cur.execute("DELETE FROM resource_categories WHERE resource_id = %s", (res['id'],))
            cur.execute("DELETE FROM resources WHERE id = %s", (res['id'],))
            removed += 1
        except Exception as e:
            print(f"❌ Error removing {res['name']}: {str(e)}")
    
    # Recategorize resources
    recategorized = 0
    for res in to_recategorize:
        try:
            # Get category ID
            cur.execute("SELECT id FROM categories WHERE slug = %s", (res['new_category'],))
            cat_result = cur.fetchone()
            if not cat_result:
                continue
            
            category_id = cat_result[0]
            
            # Remove old categories
            cur.execute("DELETE FROM resource_categories WHERE resource_id = %s", (res['id'],))
            
            # Add new category
            cur.execute("""
                INSERT INTO resource_categories (resource_id, category_id)
                VALUES (%s, %s)
            """, (res['id'], category_id))
            
            recategorized += 1
        except Exception as e:
            print(f"❌ Error recategorizing {res['name']}: {str(e)}")
    
    conn.commit()
    cur.close()
    conn.close()
    
    print(f"\n✅ COMPLETE!")
    print(f"  ❌ Removed: {removed} commercial businesses")
    print(f"  🔄 Recategorized: {recategorized} resources")

def main():
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument('--fix', action='store_true', help='Apply fixes (default is dry run)')
    args = parser.parse_args()
    
    validate_database(dry_run=not args.fix)

if __name__ == '__main__':
    main()
