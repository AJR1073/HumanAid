#!/usr/bin/env python3
"""
Smart Database Cleanup - Only makes HIGHLY CONFIDENT changes
"""

import psycopg2
import os
from dotenv import load_dotenv

load_dotenv()

def connect_db():
    return psycopg2.connect(
        host='localhost',
        port='5432',
        database='humanaid',
        user='postgres',
        password='humanaid2025'
    )

# REMOVALS - High confidence commercial businesses
REMOVE_PATTERNS = [
    # Retail chains
    ('Maximum Clothing', 'retail clothing chain'),
    ('Great Hang-Ups', 'retail store'),
    ('Carpenter\'s Corner Rural', 'retail lumber'),
    ('TLC Living Community', 'restaurant/cafe'),
    ('Luther Center', 'appears to be restaurant'),
    ('Javon Bea Hospital—Riverside', 'hospital cafe, not a social service'),
    # Shopping & Markets
    ('14 Mill Market | Food Hall', 'food hall/restaurant court'),
    ('Alton Square Mall', 'shopping mall'),
    ('Angelo Caputo\'s Fresh Markets', 'grocery store chain'),
    ('Aladdin Kitchen and Market', 'restaurant/market'),
    ('2nd Avenue Market', 'market/grocery'),
    ('Abis Market', 'market/grocery'),
    # Logistics & Warehouses
    ('ADM Distribution warehouse', 'commercial warehouse'),
    ('Advantage Logistics Inc', 'commercial logistics'),
    ('Ark Logistics', 'commercial logistics'),
    ('B & C Logistics group', 'commercial logistics'),
    # Restaurants & Food Service
    ('Jersey Mike\'s Subs', 'restaurant chain'),
    ('Portillo\'s & Barnelli\'s', 'restaurant chain'),
    ('The Patio - Lombard', 'restaurant'),
    ('Sam\'s Ristorante & Pizzeria', 'restaurant'),
    ('Head West Sub Stop', 'restaurant'),
    ('Penn Station East Coast Subs', 'restaurant chain'),
    ('Fat Sandwich Company', 'restaurant'),
    ('Lou Malnati\'s Pizzeria', 'restaurant chain'),
    ('Spread N Buns Craft Soups & Sandwiches', 'restaurant'),
    ('Jibaritos on Harlem', 'restaurant'),
    ('Leona\'s Pizzeria', 'restaurant'),
    ('Giuseppe\'s Pizzeria', 'restaurant'),
    ('Cracker Barrel Old Country Store', 'restaurant chain'),
    ('The J Bar Davenport', 'bar/restaurant'),
    ('Iniga Pizzeria Napoletana', 'restaurant'),
    ('Barnes & Noble', 'bookstore chain'),
    ('JoJo\'s Shake Bar', 'restaurant'),
]

# RECATEGORIZATIONS - Only obvious ones
RECATEGORIZE = {
    # Goodwill does job training (this is correct!)
    'Goodwill Industries of Northern Illinois': {
        'from': 'clothing-closets',
        'to': 'job-training',
        'reason': 'Primary mission is job training/employment services'
    },
}

def find_and_remove_commercial(dry_run=True):
    """Remove obvious commercial businesses"""
    conn = connect_db()
    cur = conn.cursor()
    
    removed = []
    
    for name_pattern, reason in REMOVE_PATTERNS:
        cur.execute("""
            SELECT id, name, city, state
            FROM resources
            WHERE name ILIKE %s
            AND is_active = true
        """, (f'%{name_pattern}%',))
        
        matches = cur.fetchall()
        for res_id, name, city, state in matches:
            removed.append({
                'id': res_id,
                'name': name,
                'city': city,
                'state': state,
                'reason': reason
            })
    
    print(f"\n{'='*80}")
    print(f"❌ COMMERCIAL BUSINESSES TO REMOVE: {len(removed)}")
    print(f"{'='*80}\n")
    
    for item in removed:
        print(f"  • {item['name']} - {item['city']}, {item['state']}")
        print(f"    Reason: {item['reason']}")
    
    if not dry_run:
        print(f"\nRemoving {len(removed)} businesses...")
        for item in removed:
            cur.execute("DELETE FROM resource_categories WHERE resource_id = %s", (item['id'],))
            cur.execute("DELETE FROM resources WHERE id = %s", (item['id'],))
        conn.commit()
        print(f"✅ Removed {len(removed)} businesses")
    
    cur.close()
    conn.close()
    
    return len(removed)

def recategorize_resources(dry_run=True):
    """Recategorize obvious mismatches"""
    conn = connect_db()
    cur = conn.cursor()
    
    changes = []
    
    for name, config in RECATEGORIZE.items():
        # Find the resource
        cur.execute("""
            SELECT r.id, r.name, r.city, r.state, c.slug, c.name as cat_name
            FROM resources r
            JOIN resource_categories rc ON r.id = rc.resource_id
            JOIN categories c ON rc.category_id = c.id
            WHERE r.name ILIKE %s
            AND c.slug = %s
        """, (f'%{name}%', config['from']))
        
        matches = cur.fetchall()
        for res_id, res_name, city, state, current_cat, cat_name in matches:
            changes.append({
                'id': res_id,
                'name': res_name,
                'city': city,
                'state': state,
                'from': cat_name,
                'to': config['to'],
                'reason': config['reason']
            })
    
    print(f"\n{'='*80}")
    print(f"🔄 RECATEGORIZATIONS: {len(changes)}")
    print(f"{'='*80}\n")
    
    for item in changes:
        print(f"  • {item['name']} - {item['city']}, {item['state']}")
        print(f"    {item['from']} → {item['to']}")
        print(f"    Reason: {item['reason']}\n")
    
    if not dry_run:
        print(f"\nApplying {len(changes)} recategorizations...")
        for item in changes:
            # Get new category ID
            cur.execute("SELECT id FROM categories WHERE slug = %s", (item['to'],))
            new_cat_id = cur.fetchone()[0]
            
            # Update
            cur.execute("""
                UPDATE resource_categories 
                SET category_id = %s 
                WHERE resource_id = %s
            """, (new_cat_id, item['id']))
        
        conn.commit()
        print(f"✅ Recategorized {len(changes)} resources")
    
    cur.close()
    conn.close()
    
    return len(changes)

def main():
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument('--fix', action='store_true', help='Apply changes')
    args = parser.parse_args()
    
    dry_run = not args.fix
    
    print(f"\n🧹 SMART CLEANUP - Only High-Confidence Changes")
    
    removed = find_and_remove_commercial(dry_run)
    recategorized = recategorize_resources(dry_run)
    
    if dry_run:
        print(f"\n🔵 DRY RUN MODE - No changes made")
        print(f"\nTo apply these changes:")
        print(f"  python smart_cleanup.py --fix")
    else:
        print(f"\n✅ CLEANUP COMPLETE!")
        print(f"  ❌ Removed: {removed} commercial businesses")
        print(f"  🔄 Recategorized: {recategorized} resources")

if __name__ == '__main__':
    main()
