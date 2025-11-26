#!/usr/bin/env python3
"""
Apply AI Validation Results (Safe Mode)
Only applies HIGH-CONFIDENCE changes from ai_validation_results.json
"""

import psycopg2
import os
import json
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

# HIGH-CONFIDENCE removals (definitely commercial)
HIGH_CONF_REMOVE = [
    "plato's closet", 'once upon a child', 'liquidation warehouse',
    'max clothing', 'bohemian rose', 'wave avenue', "smiley's vintage",
    'hidden treasures mall', 'art deli', 'americold logistics',
    "kelley's market", 'bloom plant based kitchen'
]

# PROTECTED - never remove these
PROTECTED_ORGS = [
    'goodwill', 'salvation army', 'st. vincent', 'rescue mission',
    'thrift shop', 'auxiliary'
]

def is_protected(name):
    """Check if organization is protected from removal"""
    name_lower = name.lower()
    return any(protected in name_lower for protected in PROTECTED_ORGS)

def is_high_confidence_removal(name):
    """Check if this is definitely a commercial business"""
    name_lower = name.lower()
    return any(commercial in name_lower for commercial in HIGH_CONF_REMOVE)

def apply_safe_changes(dry_run=True):
    """Apply only HIGH-CONFIDENCE changes"""
    
    # Load results
    try:
        with open('ai_validation_results.json', 'r') as f:
            results = json.load(f)
    except FileNotFoundError:
        print("❌ Error: ai_validation_results.json not found!")
        print("Run: python ai_validate_resources.py --limit 7000 first")
        return
    
    to_remove = results.get('to_remove', [])
    to_recategorize = results.get('to_recategorize', [])
    
    # Filter to HIGH-CONFIDENCE removals only
    safe_removals = [
        r for r in to_remove 
        if is_high_confidence_removal(r['name']) and not is_protected(r['name'])
    ]
    
    # Filter to SAFE recategorizations (skip food pantries being moved away)
    safe_recat = [
        r for r in to_recategorize
        if not (r['current'] == 'Food Pantries' and 'food' in r['name'].lower())
    ]
    
    print(f"\n{'='*80}")
    print(f"🛡️  SAFE MODE VALIDATION")
    print(f"{'='*80}\n")
    print(f"📊 Original Results:")
    print(f"  • To Remove: {len(to_remove)}")
    print(f"  • To Recategorize: {len(to_recategorize)}")
    print(f"\n📊 HIGH-CONFIDENCE Changes:")
    print(f"  • Safe Removals: {len(safe_removals)}")
    print(f"  • Safe Recategorizations: {len(safe_recat)}")
    print(f"\n⚠️  Skipped (needs manual review):")
    print(f"  • Questionable Removals: {len(to_remove) - len(safe_removals)}")
    print(f"  • Questionable Recat: {len(to_recategorize) - len(safe_recat)}")
    print(f"{'='*80}\n")
    
    # Show what will be removed
    if safe_removals:
        print(f"\n❌ WILL REMOVE ({len(safe_removals)} commercial businesses):")
        for r in safe_removals[:20]:
            print(f"  • {r['name']} - {r['city']}, {r['state']}")
        if len(safe_removals) > 20:
            print(f"  ... and {len(safe_removals) - 20} more")
    
    # Show what will be recategorized
    if safe_recat:
        print(f"\n🔄 WILL RECATEGORIZE ({len(safe_recat)} resources):")
        by_cat = {}
        for r in safe_recat:
            cat = r.get('new_category_name', r.get('new_category', 'Unknown'))
            if cat not in by_cat:
                by_cat[cat] = []
            by_cat[cat].append(r)
        
        for cat, items in sorted(by_cat.items())[:5]:
            print(f"\n  {cat}: {len(items)}")
            for item in items[:3]:
                print(f"    • {item['name']}")
    
    if dry_run:
        print(f"\n🔵 DRY RUN MODE - No changes made")
        print(f"\nTo apply these HIGH-CONFIDENCE changes:")
        print(f"  python apply_ai_validation.py --apply")
        print(f"\nTo review ALL changes (including questionable):")
        print(f"  cat ai_validation_results.json | less")
        return
    
    # Confirm
    print(f"\n⚠️  This will:")
    print(f"  - DELETE {len(safe_removals)} commercial businesses")
    print(f"  - RECATEGORIZE {len(safe_recat)} resources")
    print(f"\n❌ Skipped changes (need manual review):")
    print(f"  - {len(to_remove) - len(safe_removals)} removals")
    print(f"  - {len(to_recategorize) - len(safe_recat)} recategorizations")
    
    response = input("\nType 'APPLY' to confirm: ")
    if response != 'APPLY':
        print("❌ Cancelled.")
        return
    
    # Apply changes
    conn = connect_db()
    cur = conn.cursor()
    
    print("\n🔧 Applying changes...")
    
    # Remove commercial businesses
    removed = 0
    for res in safe_removals:
        try:
            cur.execute("DELETE FROM resource_categories WHERE resource_id = %s", (res['id'],))
            cur.execute("DELETE FROM resources WHERE id = %s", (res['id'],))
            removed += 1
        except Exception as e:
            print(f"❌ Error removing {res['name']}: {str(e)}")
    
    # Recategorize (simplified - would need full implementation)
    print(f"\n⚠️  Recategorization not yet implemented in safe mode")
    print(f"Please run the full validation script with --fix for recategorizations")
    
    conn.commit()
    cur.close()
    conn.close()
    
    print(f"\n✅ COMPLETE!")
    print(f"  ❌ Removed: {removed} commercial businesses")
    print(f"\n📋 Next Steps:")
    print(f"  1. Refresh your browser to see changes")
    print(f"  2. Review questionable changes in ai_validation_results.json")
    print(f"  3. Manually adjust any remaining issues")

def main():
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument('--apply', action='store_true', help='Apply HIGH-CONFIDENCE changes')
    args = parser.parse_args()
    
    apply_safe_changes(dry_run=not args.apply)

if __name__ == '__main__':
    main()
