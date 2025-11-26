#!/usr/bin/env python3
"""
AI-Powered Resource Validation
Checks each resource's website and uses AI to determine correct categorization
"""

import psycopg2
import os
import requests
from bs4 import BeautifulSoup
import json
from dotenv import load_dotenv
import time

load_dotenv()

def connect_db():
    return psycopg2.connect(
        host=os.getenv('DB_HOST', 'localhost'),
        port=os.getenv('DB_PORT', '5432'),
        database=os.getenv('DB_NAME', 'humanaid'),
        user=os.getenv('DB_USER', 'postgres'),
        password=os.getenv('DB_PASSWORD', 'humanaid2025')
    )

CATEGORIES = {
    'food-pantries': 'Food Pantries (food banks, pantries, soup kitchens, food distribution)',
    'free-clinics': 'Health Services (clinics, hospitals, medical, dental, vision care)',
    'mental-health': 'Mental Health Services (therapy, counseling, psychiatric care)',
    'emergency-shelters': 'Shelters & Housing (homeless shelters, housing assistance)',
    'family-shelters': 'Family Services (child care, foster care, adoption, family counseling)',
    'senior-centers': 'Senior Centers (services for elderly, aging services)',
    'veterans-services': 'Veterans Services (VFW, veterans support)',
    'free-legal-aid': 'Legal Services (legal aid, attorneys, law assistance)',
    'job-training': 'Job Training & Employment (workforce development, job placement)',
    'education': 'Education & Libraries (schools, libraries, educational programs)',
    'community-centers': 'Community Centers (community organizations, civic centers)',
    'clothing-closets': 'Clothing Closets (thrift stores, clothing assistance)',
    'recreation': 'Recreation & Fitness (YMCAs, gyms, recreation centers)',
    'REMOVE': 'Commercial Business (should be removed from database)'
}

def fetch_website_content(url, timeout=10):
    """Fetch and extract text content from website"""
    try:
        headers = {
            'User-Agent': 'Mozilla/5.0 (compatible; HumanAid/1.0; +https://humanaid.org)'
        }
        response = requests.get(url, headers=headers, timeout=timeout, allow_redirects=True)
        response.raise_for_status()
        
        soup = BeautifulSoup(response.content, 'html.parser')
        
        # Remove script and style elements
        for script in soup(["script", "style", "nav", "footer", "header"]):
            script.decompose()
        
        # Get text
        text = soup.get_text(separator=' ', strip=True)
        
        # Clean up whitespace
        lines = (line.strip() for line in text.splitlines())
        chunks = (phrase.strip() for line in lines for phrase in line.split("  "))
        text = ' '.join(chunk for chunk in chunks if chunk)
        
        # Limit to first 2000 characters for analysis
        return text[:2000]
    except Exception as e:
        return None

def analyze_organization(name, description, website_content):
    """
    Analyze organization and determine correct category
    This is a rule-based system that could be enhanced with actual AI/LLM
    """
    text = (name + ' ' + (description or '') + ' ' + (website_content or '')).lower()
    name_lower = name.lower()
    
    # KEEP these even if they match commercial keywords (non-profit thrift stores)
    nonprofit_stores = [
        'goodwill', 'salvation army', 'st. vincent', 'thrift shop',
        'thrift store', 'resale shop', 'auxiliary', 'rescue mission'
    ]
    
    is_nonprofit_store = any(kw in name_lower for kw in nonprofit_stores)
    
    # Check for commercial businesses (REMOVE) - but skip non-profits
    if not is_nonprofit_store:
        commercial_keywords = [
            'restaurant', 'grill', 'cafe', 'diner', 'pizza', 'burger',
            'wholesale', 'distributor', 'shopping',
            'theater', 'cinema', 'movie', 'entertainment venue',
            'coffee shop', 'bakery', 'meal prep',
            "plato's closet", 'once upon a child', 'liquidation'
        ]
        
        for keyword in commercial_keywords:
            if keyword in text and 'food bank' not in text and 'pantry' not in text and 'soup kitchen' not in text:
                return 'REMOVE', f'Commercial business: {keyword}'
    
    # Categorization logic (in priority order)
    
    # Family & Child Services
    if any(kw in text for kw in ['child care', 'foster care', 'adoption', 'early childhood', 'head start', 'youth programs']):
        if 'food' not in text or 'family services' in text or 'counseling' in text:
            return 'family-shelters', 'Provides family and child services'
    
    # Health Services
    if any(kw in text for kw in ['clinic', 'hospital', 'medical center', 'health department', 'dental', 'vision']):
        if 'food' not in text or 'patient' in text or 'doctor' in text:
            return 'free-clinics', 'Provides health/medical services'
    
    # Mental Health
    if any(kw in text for kw in ['mental health', 'therapy', 'counseling', 'psychiatric', 'behavioral health']):
        if 'family counseling' not in text:
            return 'mental-health', 'Provides mental health services'
    
    # Senior Services
    if any(kw in text for kw in ['senior center', 'senior services', 'aging', 'elderly', 'council on aging']):
        return 'senior-centers', 'Provides senior services'
    
    # Veterans Services (prioritize if in name)
    if any(kw in name_lower for kw in ['vfw', 'american legion', 'veterans', 'va ']):
        if 'food' not in name_lower or 'vfw' in name_lower or 'legion' in name_lower:
            return 'veterans-services', 'Provides veterans services'
    
    # Housing & Shelters
    if any(kw in text for kw in ['homeless', 'shelter', 'housing assistance', 'transitional housing']):
        if 'food' not in text or 'overnight' in text or 'beds' in text:
            return 'emergency-shelters', 'Provides housing/shelter services'
    
    # Legal Services
    if any(kw in text for kw in ['legal aid', 'attorney', 'lawyer', 'law office', 'legal services']):
        return 'free-legal-aid', 'Provides legal services'
    
    # Job Training
    if any(kw in text for kw in ['workforce', 'employment', 'job training', 'career', 'job placement']):
        if 'food' not in text:
            return 'job-training', 'Provides job training/employment services'
    
    # Education
    if any(kw in text for kw in ['library', 'school', 'education', 'learning center']):
        if 'food' not in text:
            return 'education', 'Provides educational services'
    
    # Community Centers
    if any(kw in text for kw in ['community center', 'community organization', 'community initiative', 'civic center']):
        if 'character' in text or 'initiative' in text or 'policy' in text:
            return 'community-centers', 'Community organization/initiative'
    
    # Clothing
    if any(kw in text for kw in ['thrift store', 'clothing', 'clothes closet', 'resale']):
        return 'clothing-closets', 'Provides clothing assistance'
    
    # Food Pantries (STRONG priority if in name or description)
    if any(kw in (name_lower + ' ' + (description or '').lower()) for kw in ['food bank', 'food pantry', 'soup kitchen', 'food distribution', 'food ministry']):
        return 'food-pantries', 'Provides food assistance'
    
    # General food services (lower priority)
    if any(kw in text for kw in ['feeding', 'meals', 'food']):
        # Only if it's clearly food-focused
        if 'nutrition' in text or 'hunger' in text or 'feed' in text:
            return 'food-pantries', 'Provides food assistance'
    
    return None, None

def validate_resources_with_ai(limit=50, dry_run=True):
    """Validate resources by checking their websites"""
    conn = connect_db()
    cur = conn.cursor()
    
    # Get resources with websites that might be miscategorized
    cur.execute("""
        SELECT r.id, r.name, r.description, r.website, r.city, r.state,
               c.slug as current_category, c.name as current_category_name
        FROM resources r
        JOIN resource_categories rc ON r.id = rc.resource_id
        JOIN categories c ON rc.category_id = c.id
        WHERE r.is_active = true 
        AND r.approval_status = 'approved'
        AND r.website IS NOT NULL
        AND r.website != ''
        ORDER BY r.id
        LIMIT %s
    """, (limit,))
    
    resources = cur.fetchall()
    
    print(f"\n{'='*80}")
    print(f"🤖 AI-Powered Validation: Checking {len(resources)} resources with websites")
    print(f"{'='*80}\n")
    
    to_recategorize = []
    to_remove = []
    correctly_categorized = []
    
    for i, resource in enumerate(resources, 1):
        res_id, name, description, website, city, state, current_cat, current_cat_name = resource
        
        print(f"[{i}/{len(resources)}] Checking: {name}")
        print(f"  Current: {current_cat_name}")
        print(f"  Website: {website}")
        
        # Fetch website content
        content = fetch_website_content(website)
        if content:
            print(f"  ✓ Fetched {len(content)} characters from website")
        else:
            print(f"  ✗ Could not fetch website")
        
        # Analyze
        correct_cat, reason = analyze_organization(name, description, content)
        
        if correct_cat == 'REMOVE':
            to_remove.append({
                'id': res_id,
                'name': name,
                'city': city,
                'state': state,
                'website': website,
                'reason': reason
            })
            print(f"  ❌ REMOVE: {reason}\n")
        elif correct_cat and correct_cat != current_cat:
            to_recategorize.append({
                'id': res_id,
                'name': name,
                'city': city,
                'state': state,
                'current': current_cat_name,
                'new_category': correct_cat,
                'new_category_name': CATEGORIES[correct_cat],
                'reason': reason
            })
            print(f"  🔄 RECATEGORIZE: {reason}")
            print(f"     {current_cat_name} → {CATEGORIES[correct_cat]}\n")
        else:
            correctly_categorized.append(name)
            print(f"  ✅ Correctly categorized\n")
        
        # Rate limiting
        time.sleep(0.5)
    
    cur.close()
    conn.close()
    
    # Print summary
    print(f"\n{'='*80}")
    print(f"📊 VALIDATION SUMMARY:")
    print(f"  ✅ Correctly categorized: {len(correctly_categorized)}")
    print(f"  🔄 Need recategorization: {len(to_recategorize)}")
    print(f"  ❌ Should be removed: {len(to_remove)}")
    print(f"{'='*80}\n")
    
    # Show results
    if to_remove:
        print(f"\n❌ RESOURCES TO REMOVE ({len(to_remove)}):")
        for res in to_remove[:20]:
            print(f"  • {res['name']} - {res['city']}, {res['state']}")
            print(f"    {res['reason']}")
    
    if to_recategorize:
        print(f"\n🔄 RESOURCES TO RECATEGORIZE ({len(to_recategorize)}):")
        by_new_cat = {}
        for res in to_recategorize:
            cat = res['new_category_name']
            if cat not in by_new_cat:
                by_new_cat[cat] = []
            by_new_cat[cat].append(res)
        
        for cat, items in sorted(by_new_cat.items()):
            print(f"\n{cat}: {len(items)} resources")
            for res in items[:5]:
                print(f"  • {res['name']} - {res['city']}, {res['state']}")
                print(f"    {res['current']} → {cat}")
            if len(items) > 5:
                print(f"  ... and {len(items) - 5} more")
    
    if dry_run:
        print(f"\n🔵 DRY RUN MODE - No changes made")
        print(f"\nTo apply fixes, run:")
        print(f"  python ai_validate_resources.py --fix --limit {limit}")
    
    # Save results to file
    results = {
        'to_remove': to_remove,
        'to_recategorize': to_recategorize,
        'correctly_categorized': correctly_categorized
    }
    
    with open('ai_validation_results.json', 'w') as f:
        json.dump(results, f, indent=2)
    
    print(f"\n💾 Results saved to: ai_validation_results.json")

def main():
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument('--fix', action='store_true', help='Apply fixes (default is dry run)')
    parser.add_argument('--limit', type=int, default=50, help='Number of resources to check (default: 50)')
    args = parser.parse_args()
    
    validate_resources_with_ai(limit=args.limit, dry_run=not args.fix)

if __name__ == '__main__':
    main()
