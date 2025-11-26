#!/usr/bin/env python3
"""
Supplemental Collection - Small Illinois Towns & County Seats
Captures community outreach centers in smaller communities
"""

import os
import csv
import time
from datetime import datetime
import googlemaps

# Smaller Illinois cities and county seats (population 5,000-30,000)
SMALL_IL_CITIES = [
    # County seats and regional centers
    ("Waterloo", 8),      # Monroe County - Monroe County Outreach!
    ("Belleville", 10),    # St. Clair County
    ("Edwardsville", 8),   # Madison County
    ("Alton", 8),          # Madison County
    ("Carbondale", 8),     # Jackson County
    ("Marion", 8),         # Williamson County
    ("Mt. Vernon", 8),     # Jefferson County
    ("Centralia", 8),      # Marion County
    ("Effingham", 8),      # Effingham County
    ("Mattoon", 8),        # Coles County
    ("Charleston", 8),     # Coles County
    ("Taylorville", 8),    # Christian County
    ("Jacksonville", 8),   # Morgan County
    ("Macomb", 8),         # McDonough County
    ("Galesburg", 8),      # Knox County
    ("Kankakee", 8),       # Kankakee County
    ("Ottawa", 8),         # LaSalle County
    ("Peru", 8),           # LaSalle County
    ("Dixon", 8),          # Lee County
    ("Sterling", 8),       # Whiteside County
    ("Freeport", 8),       # Stephenson County
    ("Loves Park", 8),     # Winnebago County
    ("Belvidere", 8),      # Boone County
    ("McHenry", 8),        # McHenry County
    ("Woodstock", 8),      # McHenry County
    ("Waukegan", 10),      # Lake County
    ("Highland Park", 8),  # Lake County
    ("Lake Forest", 8),    # Lake County
    ("Mundelein", 8),      # Lake County
    ("Vernon Hills", 8),   # Lake County
    ("Gurnee", 8),         # Lake County
    ("Round Lake", 8),     # Lake County
    ("Zion", 8),           # Lake County
    ("Libertyville", 8),   # Lake County
    ("Park Ridge", 8),     # Cook County
    ("Oak Park", 8),       # Cook County
    ("Berwyn", 8),         # Cook County
    ("Cicero", 8),         # Cook County
    ("Evanston", 8),       # Cook County
    ("Skokie", 8),         # Cook County
    ("Lincolnwood", 8),    # Cook County
    ("Niles", 8),          # Cook County
    ("Morton Grove", 8),   # Cook County
    ("Melrose Park", 8),   # Cook County
    ("Maywood", 8),        # Cook County
    ("Blue Island", 8),    # Cook County
    ("Calumet City", 8),   # Cook County
    ("Harvey", 8),         # Cook County
    ("Dolton", 8),         # Cook County
    ("South Holland", 8),  # Cook County
]

# Enhanced search terms for community outreach and county programs
COMMUNITY_QUERIES = [
    "food bank",
    "food pantry",
    "food distribution center",
    "county outreach food",
    "community outreach",
    "church food pantry",
    "salvation army food",
    "catholic charities food",
    "food ministry",
    "community food",
]

class SmallTownCollector:
    def __init__(self, api_key):
        self.gmaps = googlemaps.Client(key=api_key)
        self.results = []
        self.query_count = 0
        self.seen_place_ids = set()
    
    def collect_all(self):
        print(f"\n{'='*60}")
        print(f"🏘️  SMALL TOWNS & COUNTY SEATS - ILLINOIS")
        print(f"{'='*60}")
        print(f"📊 Total locations: {len(SMALL_IL_CITIES)}")
        print(f"🎯 Target: Community outreach centers & county programs")
        print(f"{'='*60}\n")
        
        for i, (city, radius) in enumerate(SMALL_IL_CITIES, 1):
            print(f"\n[{i}/{len(SMALL_IL_CITIES)}] 🏘️  {city}, IL")
            print("-" * 50)
            self.collect_city(city, radius)
            time.sleep(1)
            
            if i % 10 == 0:
                print(f"\n📈 PROGRESS: {i}/{len(SMALL_IL_CITIES)} • {len(self.results)} resources • ${self.query_count * 0.017:.2f}")
        
        print(f"\n{'='*60}")
        print(f"✅ COLLECTION COMPLETE")
        print(f"{'='*60}")
        print(f"📊 Resources: {len(self.results)}")
        print(f"💰 Cost: ${self.query_count * 0.017:.2f}")
        print(f"{'='*60}\n")
    
    def collect_city(self, city, radius_miles):
        try:
            geocode = self.gmaps.geocode(f"{city}, IL, USA")
            if not geocode:
                print(f"  ❌ Could not geocode")
                return
            
            loc = geocode[0]['geometry']['location']
            lat, lng = loc['lat'], loc['lng']
            radius = int(radius_miles * 1609.34)
            
            city_count = 0
            
            for query in COMMUNITY_QUERIES:
                # Text search (better for finding specific named organizations)
                search_query = f"{query} in {city}, IL"
                result = self.gmaps.places(query=search_query, location=(lat, lng), radius=radius)
                self.query_count += 1
                
                for place in result.get('results', []):
                    place_id = place['place_id']
                    if place_id in self.seen_place_ids:
                        continue
                    
                    self.seen_place_ids.add(place_id)
                    
                    try:
                        details = self.gmaps.place(place_id=place_id, fields=[
                            'name', 'formatted_address', 'formatted_phone_number',
                            'website', 'geometry', 'business_status', 'rating'
                        ])['result']
                        
                        address_parts = details.get('formatted_address', '').split(',')
                        street = address_parts[0] if address_parts else ''
                        zip_code = address_parts[-1].strip().split()[-1] if len(address_parts) >= 3 else ''
                        
                        self.results.append({
                            'place_id': place_id,
                            'name': details.get('name'),
                            'address': street,
                            'city': city,
                            'state': 'IL',
                            'zip_code': zip_code,
                            'latitude': details['geometry']['location']['lat'],
                            'longitude': details['geometry']['location']['lng'],
                            'phone': details.get('formatted_phone_number', ''),
                            'website': details.get('website', ''),
                            'category': 'food-pantries',
                            'search_query': query,
                            'collected_at': datetime.now().isoformat()
                        })
                        city_count += 1
                    except:
                        continue
                
                time.sleep(0.3)
            
            print(f"  ✅ {city_count} resources")
            
        except Exception as e:
            print(f"  ❌ Error: {str(e)}")
    
    def export_csv(self, filename):
        if not self.results:
            print("❌ No results")
            return
        
        os.makedirs(os.path.dirname(filename) or '.', exist_ok=True)
        
        with open(filename, 'w', newline='', encoding='utf-8') as f:
            writer = csv.DictWriter(f, fieldnames=[
                'name', 'address', 'city', 'state', 'zip_code', 'latitude',
                'longitude', 'phone', 'website', 'category', 'place_id'
            ], extrasaction='ignore')
            writer.writeheader()
            writer.writerows(self.results)
        
        print(f"\n✅ Saved {len(self.results)} resources to {filename}")
        print(f"💰 Cost: ${self.query_count * 0.017:.2f}")

def main():
    api_key = os.environ.get('GOOGLE_PLACES_API_KEY')
    if not api_key:
        print("❌ Need GOOGLE_PLACES_API_KEY")
        return 1
    
    collector = SmallTownCollector(api_key)
    collector.collect_all()
    collector.export_csv('../data/il_small_towns_food_banks.csv')
    
    print(f"\nNext: python import_csv.py --file ../data/il_small_towns_food_banks.csv")
    return 0

if __name__ == '__main__':
    exit(main())
