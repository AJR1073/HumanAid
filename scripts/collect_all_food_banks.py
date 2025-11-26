#!/usr/bin/env python3
"""
Comprehensive Food Bank Collector for Illinois & Missouri
Collects food banks, food pantries, and food distribution centers
"""

import os
import json
import csv
import time
import argparse
from datetime import datetime
import googlemaps

# All major cities in Illinois (50+)
ILLINOIS_CITIES = [
    # Major metros
    ("Chicago", 20),
    ("Aurora", 15),
    ("Joliet", 15),
    ("Naperville", 15),
    ("Rockford", 15),
    ("Springfield", 12),
    ("Elgin", 12),
    ("Peoria", 12),
    ("Champaign", 10),
    ("Waukegan", 10),
    
    # Mid-size cities
    ("Cicero", 10),
    ("Bloomington", 10),
    ("Decatur", 10),
    ("Evanston", 10),
    ("Des Plaines", 8),
    ("Berwyn", 8),
    ("Wheaton", 8),
    ("Belleville", 8),
    ("Quincy", 8),
    ("Moline", 8),
    ("Oak Lawn", 8),
    ("Downers Grove", 8),
    ("Elmhurst", 8),
    ("DeKalb", 8),
    ("Urbana", 8),
    
    # Smaller cities
    ("Schaumburg", 8),
    ("Bolingbrook", 8),
    ("Palatine", 8),
    ("Skokie", 8),
    ("Normal", 8),
    ("Carol Stream", 8),
    ("Carpentersville", 8),
    ("Rock Island", 8),
    ("Romeoville", 8),
    ("Plainfield", 8),
    ("Tinley Park", 8),
    ("Oak Park", 8),
    ("Calumet City", 8),
    ("Glenview", 8),
    ("Mount Prospect", 8),
    ("Hanover Park", 8),
    ("Wheeling", 8),
    ("Addison", 8),
    ("Glendale Heights", 8),
    ("Northbrook", 8),
    ("Hoffman Estates", 8),
    ("Buffalo Grove", 8),
    ("Bartlett", 8),
    ("Crystal Lake", 8),
    ("Streamwood", 8),
    ("St. Charles", 8),
    ("Lombard", 8),
    ("Algonquin", 8),
    ("Oswego", 8),
    ("Danville", 8),
]

# All major cities in Missouri (40+)
MISSOURI_CITIES = [
    # Major metros
    ("Kansas City", 20),
    ("St. Louis", 20),
    ("Springfield", 15),
    ("Columbia", 12),
    ("Independence", 12),
    
    # Mid-size cities
    ("Lee's Summit", 10),
    ("O'Fallon", 10),
    ("St. Joseph", 10),
    ("St. Charles", 10),
    ("St. Peters", 10),
    ("Blue Springs", 10),
    ("Florissant", 10),
    ("Joplin", 10),
    ("Chesterfield", 10),
    ("Jefferson City", 10),
    ("Cape Girardeau", 8),
    ("Wentzville", 8),
    ("Wildwood", 8),
    ("University City", 8),
    ("Ballwin", 8),
    
    # Smaller cities
    ("Raytown", 8),
    ("Liberty", 8),
    ("Gladstone", 8),
    ("Grandview", 8),
    ("Belton", 8),
    ("Lees Summit", 8),
    ("Kirkwood", 8),
    ("Maryland Heights", 8),
    ("Hazelwood", 8),
    ("Ferguson", 8),
    ("Webster Groves", 8),
    ("Affton", 8),
    ("Mehlville", 8),
    ("Arnold", 8),
    ("Oakville", 8),
    ("Nixa", 8),
    ("Ozark", 8),
    ("Sedalia", 8),
    ("Rolla", 8),
    ("Poplar Bluff", 8),
    ("Sikeston", 8),
    ("Hannibal", 8),
    ("Warrensburg", 8),
    ("Farmington", 8),
    ("West Plains", 8),
]

# Food-specific search queries
FOOD_QUERIES = [
    "food bank",
    "food pantry",
    "food distribution center",
    "free food",
    "food assistance",
    "community food",
    "emergency food",
    "soup kitchen",
    "meals on wheels",
    "food shelf",
    "county outreach food",
    "food distribution program",
    "church food pantry",
    "nonprofit food assistance",
    "community outreach food",
    "food ministry",
    "feeding program",
]

class FoodBankCollector:
    def __init__(self, api_key):
        self.gmaps = googlemaps.Client(key=api_key)
        self.results = []
        self.query_count = 0
        self.cost_estimate = 0
        self.seen_place_ids = set()
        
    def collect_all_cities(self, state):
        """Collect food banks from all cities in a state"""
        cities = ILLINOIS_CITIES if state == "IL" else MISSOURI_CITIES
        state_name = "Illinois" if state == "IL" else "Missouri"
        
        print(f"\n{'='*60}")
        print(f"🍽️  COLLECTING FOOD BANKS IN {state_name}")
        print(f"{'='*60}")
        print(f"📊 Total cities: {len(cities)}")
        print(f"🎯 Target: 300+ food resources")
        print(f"{'='*60}\n")
        
        for i, (city, radius) in enumerate(cities, 1):
            print(f"\n[{i}/{len(cities)}] 🏙️  {city}, {state}")
            print("-" * 50)
            self.collect_city(city, state, radius)
            
            # Progress update
            if i % 5 == 0:
                print(f"\n📈 PROGRESS: {i}/{len(cities)} cities • {len(self.results)} resources • ${self.cost_estimate:.2f}")
            
            # Rate limiting - be nice to the API
            time.sleep(1)
        
        print(f"\n{'='*60}")
        print(f"✅ COMPLETED {state_name}")
        print(f"{'='*60}")
        print(f"📊 Total resources: {len(self.results)}")
        print(f"💰 Total cost: ${self.cost_estimate:.2f}")
        print(f"🔢 Total queries: {self.query_count}")
        print(f"{'='*60}\n")
    
    def collect_city(self, city, state, radius_miles):
        """Collect food banks in a specific city"""
        try:
            # Geocode the city
            geocode_result = self.gmaps.geocode(f"{city}, {state}, USA")
            if not geocode_result:
                print(f"  ❌ Could not geocode {city}")
                return
            
            location = geocode_result[0]['geometry']['location']
            lat, lng = location['lat'], location['lng']
            radius_meters = int(radius_miles * 1609.34)
            
            city_results = 0
            
            # Search with each query using both methods
            for query in FOOD_QUERIES:
                # Method 1: Places Nearby (radius-based)
                found_nearby = self._search_query(query, city, state, lat, lng, radius_meters)
                city_results += found_nearby
                time.sleep(0.3)
                
                # Method 2: Text Search (broader, finds more specific organizations)
                found_text = self._search_text(query, city, state, lat, lng, radius_meters)
                city_results += found_text
                time.sleep(0.3)
            
            print(f"  ✅ Found {city_results} new food resources in {city}")
            
        except Exception as e:
            print(f"  ❌ Error in {city}: {str(e)}")
    
    def _search_query(self, query, city, state, lat, lng, radius):
        """Execute a single search query"""
        try:
            places_result = self.gmaps.places_nearby(
                location=(lat, lng),
                radius=radius,
                keyword=query,
                type='point_of_interest'
            )
            
            self.query_count += 1
            self.cost_estimate = self.query_count * 0.017
            
            results = places_result.get('results', [])
            new_count = 0
            
            for place in results:
                place_id = place['place_id']
                
                # Skip duplicates
                if place_id in self.seen_place_ids:
                    continue
                
                self.seen_place_ids.add(place_id)
                
                # Get detailed info
                details = self.gmaps.place(place_id=place_id, fields=[
                    'name', 'formatted_address', 'formatted_phone_number',
                    'website', 'geometry', 'business_status'
                ])['result']
                
                # Parse address components
                address_parts = details.get('formatted_address', '').split(',')
                street = address_parts[0] if len(address_parts) > 0 else ''
                zip_code = ''
                if len(address_parts) >= 3:
                    zip_match = address_parts[-1].strip().split()
                    zip_code = zip_match[-1] if zip_match else ''
                
                resource = {
                    'place_id': place_id,
                    'name': details.get('name'),
                    'address': street,
                    'city': city,
                    'state': state,
                    'zip_code': zip_code,
                    'latitude': details['geometry']['location']['lat'],
                    'longitude': details['geometry']['location']['lng'],
                    'phone': details.get('formatted_phone_number', ''),
                    'website': details.get('website', ''),
                    'category': 'food-pantries',
                    'search_query': query,
                    'business_status': details.get('business_status', 'OPERATIONAL'),
                    'collected_at': datetime.now().isoformat()
                }
                
                self.results.append(resource)
                new_count += 1
            
            return new_count
            
        except Exception as e:
            print(f"    ⚠️  Query '{query}' failed: {str(e)}")
            return 0
    
    def _search_text(self, query, city, state, lat, lng, radius):
        """Execute a text search query (broader than places_nearby)"""
        try:
            # Build location-specific query
            search_query = f"{query} in {city}, {state}"
            
            text_result = self.gmaps.places(
                query=search_query,
                location=(lat, lng),
                radius=radius
            )
            
            self.query_count += 1
            self.cost_estimate = self.query_count * 0.017
            
            results = text_result.get('results', [])
            new_count = 0
            
            for place in results:
                place_id = place['place_id']
                
                # Skip duplicates
                if place_id in self.seen_place_ids:
                    continue
                
                self.seen_place_ids.add(place_id)
                
                # Get detailed info
                try:
                    details = self.gmaps.place(place_id=place_id, fields=[
                        'name', 'formatted_address', 'formatted_phone_number',
                        'website', 'geometry', 'business_status',
                        'opening_hours', 'rating'
                    ])['result']
                    
                    # Parse address components
                    address_parts = details.get('formatted_address', '').split(',')
                    street = address_parts[0] if len(address_parts) > 0 else ''
                    zip_code = ''
                    if len(address_parts) >= 3:
                        zip_match = address_parts[-1].strip().split()
                        zip_code = zip_match[-1] if zip_match else ''
                    
                    resource = {
                        'place_id': place_id,
                        'name': details.get('name'),
                        'address': street,
                        'city': city,
                        'state': state,
                        'zip_code': zip_code,
                        'latitude': details['geometry']['location']['lat'],
                        'longitude': details['geometry']['location']['lng'],
                        'phone': details.get('formatted_phone_number', ''),
                        'website': details.get('website', ''),
                        'category': 'food-pantries',
                        'search_query': query + ' (text search)',
                        'business_status': details.get('business_status', 'OPERATIONAL'),
                        'rating': details.get('rating', ''),
                        'collected_at': datetime.now().isoformat()
                    }
                    
                    self.results.append(resource)
                    new_count += 1
                    
                except Exception as detail_error:
                    # Skip if we can't get details
                    continue
            
            return new_count
            
        except Exception as e:
            # Text search might not always work, that's OK
            return 0
    
    def export_to_csv(self, filename):
        """Export results to CSV"""
        if not self.results:
            print("❌ No results to export")
            return
        
        os.makedirs(os.path.dirname(filename) if os.path.dirname(filename) else '.', exist_ok=True)
        
        with open(filename, 'w', newline='', encoding='utf-8') as csvfile:
            fieldnames = ['name', 'address', 'city', 'state', 'zip_code', 'latitude', 
                         'longitude', 'phone', 'website', 'category', 'search_query', 
                         'business_status', 'place_id']
            writer = csv.DictWriter(csvfile, fieldnames=fieldnames, extrasaction='ignore')
            
            writer.writeheader()
            for row in self.results:
                writer.writerow(row)
        
        print(f"\n✅ Exported {len(self.results)} food resources to {filename}")
        print(f"💰 Total API Cost: ${self.cost_estimate:.2f}")
        print(f"🔢 Total Queries: {self.query_count}")

def main():
    parser = argparse.ArgumentParser(description='Collect all food banks in IL and MO')
    parser.add_argument('--state', choices=['IL', 'MO', 'BOTH'], default='BOTH',
                       help='State to collect (IL, MO, or BOTH)')
    parser.add_argument('--output-dir', default='../data',
                       help='Output directory for CSV files')
    parser.add_argument('--api-key', help='Google Places API key (or set GOOGLE_PLACES_API_KEY env var)')
    
    args = parser.parse_args()
    
    # Get API key
    api_key = args.api_key or os.environ.get('GOOGLE_PLACES_API_KEY')
    if not api_key:
        print("❌ Error: Google Places API key required")
        print("   Set GOOGLE_PLACES_API_KEY environment variable or use --api-key")
        return 1
    
    # Create output directory
    os.makedirs(args.output_dir, exist_ok=True)
    
    # Collect data
    if args.state in ['IL', 'BOTH']:
        print("\n🌽 Starting Illinois collection...")
        collector_il = FoodBankCollector(api_key)
        collector_il.collect_all_cities('IL')
        collector_il.export_to_csv(f"{args.output_dir}/il_all_food_banks.csv")
    
    if args.state in ['MO', 'BOTH']:
        print("\n🎺 Starting Missouri collection...")
        collector_mo = FoodBankCollector(api_key)
        collector_mo.collect_all_cities('MO')
        collector_mo.export_to_csv(f"{args.output_dir}/mo_all_food_banks.csv")
    
    print("\n" + "="*60)
    print("🎉 COLLECTION COMPLETE!")
    print("="*60)
    print("\nNext steps:")
    print("1. Review the CSV files in", args.output_dir)
    print("2. Import to database:")
    print(f"   python import_csv.py --file {args.output_dir}/il_all_food_banks.csv")
    print(f"   python import_csv.py --file {args.output_dir}/mo_all_food_banks.csv")
    
    return 0

if __name__ == '__main__':
    exit(main())
