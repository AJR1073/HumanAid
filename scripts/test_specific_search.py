#!/usr/bin/env python3
"""
Test script to search for specific organizations by name
Useful for verifying that community outreach centers are found
"""

import os
import argparse
import googlemaps

def search_specific_org(api_key, org_name, city=None, state=None):
    """Search for a specific organization"""
    gmaps = googlemaps.Client(key=api_key)
    
    # Build search query
    if city and state:
        query = f"{org_name} {city} {state}"
    else:
        query = org_name
    
    print(f"\n🔍 Searching for: '{query}'")
    print("="*60)
    
    try:
        # Text search (broader)
        results = gmaps.places(query=query)
        
        if results['results']:
            print(f"\n✅ Found {len(results['results'])} results:\n")
            
            for i, place in enumerate(results['results'], 1):
                print(f"{i}. {place['name']}")
                print(f"   📍 {place.get('formatted_address', 'No address')}")
                
                # Get detailed info
                place_id = place['place_id']
                details = gmaps.place(place_id=place_id, fields=[
                    'formatted_phone_number', 'website', 'rating', 'business_status'
                ])['result']
                
                if details.get('formatted_phone_number'):
                    print(f"   📞 {details['formatted_phone_number']}")
                if details.get('website'):
                    print(f"   🌐 {details['website']}")
                if details.get('rating'):
                    print(f"   ⭐ {details['rating']}")
                
                print()
        else:
            print("❌ No results found")
            print("\nTry:")
            print("  - Checking the spelling")
            print("  - Adding the city name")
            print("  - Using a broader search term")
    
    except Exception as e:
        print(f"❌ Error: {str(e)}")

def main():
    parser = argparse.ArgumentParser(description='Search for specific organizations')
    parser.add_argument('--name', required=True, help='Organization name to search for')
    parser.add_argument('--city', help='City (optional, helps narrow results)')
    parser.add_argument('--state', help='State (IL or MO)')
    parser.add_argument('--api-key', help='Google Places API key')
    
    args = parser.parse_args()
    
    # Get API key
    api_key = args.api_key or os.environ.get('GOOGLE_PLACES_API_KEY')
    if not api_key:
        print("❌ Error: Google Places API key required")
        return 1
    
    search_specific_org(api_key, args.name, args.city, args.state)
    return 0

if __name__ == '__main__':
    exit(main())
