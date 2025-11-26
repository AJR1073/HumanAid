#!/usr/bin/env python3
"""
Google Places API Resource Collector for HumanAid
Collects humanitarian resources using Google Places API
"""

import os
import json
import csv
import time
import argparse
from datetime import datetime
import googlemaps

# Category search queries
SEARCH_QUERIES = {
    'food-pantries': ['food bank', 'food pantry', 'food distribution'],
    'emergency-shelters': ['homeless shelter', 'emergency shelter', 'overnight shelter'],
    'free-clinics': ['free clinic', 'community health center', 'free medical clinic'],
    'mental-health': ['mental health clinic', 'counseling center', 'mental health services'],
    'substance-abuse': ['addiction treatment', 'rehab center', 'substance abuse treatment'],
    'legal-aid': ['legal aid', 'free legal services', 'legal assistance'],
    'job-training': ['job training center', 'workforce development', 'employment services'],
    'clothing': ['clothing closet', 'free clothing', 'thrift store nonprofit'],
}

class PlacesCollector:
    def __init__(self, api_key):
        self.gmaps = googlemaps.Client(key=api_key)
        self.results = []
        self.query_count = 0
        self.cost_estimate = 0
        
    def search_location(self, city, state, radius_miles=10):
        """Search for resources in a specific city"""
        print(f"\n🔍 Searching {city}, {state}...")
        
        # Geocode the city to get coordinates
        geocode_result = self.gmaps.geocode(f"{city}, {state}, USA")
        if not geocode_result:
            print(f"❌ Could not geocode {city}, {state}")
            return
        
        location = geocode_result[0]['geometry']['location']
        lat, lng = location['lat'], location['lng']
        radius_meters = int(radius_miles * 1609.34)
        
        print(f"📍 Location: {lat}, {lng} (radius: {radius_miles} miles)")
        
        # Search for each category
        for category, queries in SEARCH_QUERIES.items():
            for query in queries:
                self._search_query(query, category, lat, lng, radius_meters, city, state)
                time.sleep(0.5)  # Rate limiting
    
    def _search_query(self, query, category, lat, lng, radius, city, state):
        """Execute a single search query"""
        try:
            print(f"  🔎 {query}...", end=" ")
            
            places_result = self.gmaps.places_nearby(
                location=(lat, lng),
                radius=radius,
                keyword=query,
                type='point_of_interest'
            )
            
            self.query_count += 1
            self.cost_estimate = self.query_count * 0.017  # $17 per 1000 requests
            
            results = places_result.get('results', [])
            new_count = 0
            
            for place in results:
                place_id = place['place_id']
                
                # Skip if already collected
                if any(r['place_id'] == place_id for r in self.results):
                    continue
                
                # Get detailed info
                details = self.gmaps.place(place_id=place_id, fields=[
                    'name', 'formatted_address', 'formatted_phone_number',
                    'website', 'geometry', 'business_status'
                ])['result']
                
                resource = {
                    'place_id': place_id,
                    'name': details.get('name'),
                    'address': details.get('formatted_address', ''),
                    'city': city,
                    'state': state,
                    'latitude': details['geometry']['location']['lat'],
                    'longitude': details['geometry']['location']['lng'],
                    'phone': details.get('formatted_phone_number', ''),
                    'website': details.get('website', ''),
                    'category': category,
                    'search_query': query,
                    'business_status': details.get('business_status', ''),
                    'collected_at': datetime.now().isoformat()
                }
                
                self.results.append(resource)
                new_count += 1
            
            print(f"✅ Found {new_count} new ({len(results)} total)")
            
        except Exception as e:
            print(f"❌ Error: {str(e)}")
    
    def export_to_csv(self, filename):
        """Export results to CSV"""
        if not self.results:
            print("❌ No results to export")
            return
        
        os.makedirs(os.path.dirname(filename) if os.path.dirname(filename) else '.', exist_ok=True)
        
        with open(filename, 'w', newline='', encoding='utf-8') as csvfile:
            fieldnames = ['name', 'address', 'city', 'state', 'latitude', 'longitude', 
                         'phone', 'website', 'category', 'search_query', 'place_id']
            writer = csv.DictWriter(csvfile, fieldnames=fieldnames, extrasaction='ignore')
            
            writer.writeheader()
            for row in self.results:
                writer.writerow(row)
        
        print(f"\n✅ Exported {len(self.results)} resources to {filename}")
        print(f"💰 API Cost: ${self.cost_estimate:.2f} ({self.query_count} queries)")

def main():
    parser = argparse.ArgumentParser(description='Collect humanitarian resources using Google Places API')
    parser.add_argument('--city', required=True, help='City to search')
    parser.add_argument('--state', required=True, help='State abbreviation (IL, MO)')
    parser.add_argument('--radius', type=int, default=10, help='Search radius in miles (default: 10)')
    parser.add_argument('--output', default='data/collected_resources.csv', help='Output CSV file')
    parser.add_argument('--api-key', help='Google Places API key (or set GOOGLE_PLACES_API_KEY env var)')
    
    args = parser.parse_args()
    
    # Get API key
    api_key = args.api_key or os.environ.get('GOOGLE_PLACES_API_KEY')
    if not api_key:
        print("❌ Error: Google Places API key required")
        print("   Set GOOGLE_PLACES_API_KEY environment variable or use --api-key")
        return 1
    
    # Initialize collector
    collector = PlacesCollector(api_key)
    
    # Search location
    collector.search_location(args.city, args.state, args.radius)
    
    # Export results
    collector.export_to_csv(args.output)
    
    return 0

if __name__ == '__main__':
    exit(main())
