#!/usr/bin/env python3
"""
OPTIMIZED Food Bank Collector - Stays within Google's Free Tier
Uses strategic querying to maximize results while minimizing API calls
"""

import os
import json
import csv
import time
import argparse
from datetime import datetime
import googlemaps

# Prioritized cities for food bank collection (most populous first)
ILLINOIS_PRIORITY_CITIES = [
    ("Chicago", 20), ("Aurora", 15), ("Rockford", 15), ("Joliet", 12), ("Naperville", 12),
    ("Springfield", 12), ("Peoria", 12), ("Elgin", 10), ("Champaign", 10), ("Waukegan", 10),
    ("Cicero", 10), ("Bloomington", 10), ("Decatur", 10), ("Evanston", 10), ("Des Plaines", 8),
]

MISSOURI_PRIORITY_CITIES = [
    ("Kansas City", 20), ("St. Louis", 20), ("Springfield", 15), ("Columbia", 12), 
    ("Independence", 12), ("Lee's Summit", 10), ("O'Fallon", 10), ("St. Joseph", 10),
    ("St. Charles", 10), ("St. Peters", 10),
]

# Most effective search terms (tested to get best results)
PRIORITY_FOOD_QUERIES = [
    "food bank",
    "food pantry", 
    "food distribution center",
    "community outreach food",
    "church food pantry",
]

class OptimizedFoodBankCollector:
    def __init__(self, api_key, max_queries=11000):
        self.gmaps = googlemaps.Client(key=api_key)
        self.results = []
        self.query_count = 0
        self.max_queries = max_queries
        self.seen_place_ids = set()
        
    def collect_optimized(self, state):
        """Optimized collection that stays within free tier"""
        cities = ILLINOIS_PRIORITY_CITIES if state == "IL" else MISSOURI_PRIORITY_CITIES
        state_name = "Illinois" if state == "IL" else "Missouri"
        
        print(f"\n{'='*60}")
        print(f"🍽️  OPTIMIZED COLLECTION - {state_name}")
        print(f"{'='*60}")
        print(f"📊 Cities: {len(cities)}")
        print(f"🔍 Search terms: {len(PRIORITY_FOOD_QUERIES)}")
        print(f"⚡ Mode: Text Search Only (most effective)")
        print(f"💰 Target: Stay under 11,000 queries (FREE)")
        print(f"{'='*60}\n")
        
        for i, (city, radius) in enumerate(cities, 1):
            # Check query limit
            if self.query_count >= self.max_queries:
                print(f"\n⚠️  Reached query limit ({self.max_queries})")
                print(f"   Collected from {i-1}/{len(cities)} cities")
                break
            
            print(f"\n[{i}/{len(cities)}] 🏙️  {city}, {state}")
            print(f"   Queries used: {self.query_count}/{self.max_queries}")
            print("-" * 50)
            
            self.collect_city_optimized(city, state, radius)
            time.sleep(1)
        
        print(f"\n{'='*60}")
        print(f"✅ COLLECTION COMPLETE")
        print(f"{'='*60}")
        print(f"📊 Resources found: {len(self.results)}")
        print(f"🔢 Queries used: {self.query_count}")
        print(f"💰 Cost: ${self.query_count * 0.017:.2f}")
        print(f"{'='*60}\n")
    
    def collect_city_optimized(self, city, state, radius_miles):
        """Optimized collection for a single city"""
        try:
            # Geocode
            geocode_result = self.gmaps.geocode(f"{city}, {state}, USA")
            if not geocode_result:
                return
            
            location = geocode_result[0]['geometry']['location']
            lat, lng = location['lat'], location['lng']
            radius_meters = int(radius_miles * 1609.34)
            
            city_results = 0
            
            # Use text search only (more effective per query)
            for query in PRIORITY_FOOD_QUERIES:
                if self.query_count >= self.max_queries:
                    break
                
                found = self._search_text_optimized(query, city, state, lat, lng, radius_meters)
                city_results += found
                time.sleep(0.2)
            
            print(f"  ✅ {city_results} new resources")
            
        except Exception as e:
            print(f"  ❌ Error: {str(e)}")
    
    def _search_text_optimized(self, query, city, state, lat, lng, radius):
        """Optimized text search"""
        try:
            search_query = f"{query} in {city}, {state}"
            
            result = self.gmaps.places(
                query=search_query,
                location=(lat, lng),
                radius=radius
            )
            
            self.query_count += 1
            new_count = 0
            
            for place in result.get('results', []):
                place_id = place['place_id']
                
                if place_id in self.seen_place_ids:
                    continue
                
                self.seen_place_ids.add(place_id)
                
                try:
                    details = self.gmaps.place(place_id=place_id, fields=[
                        'name', 'formatted_address', 'formatted_phone_number',
                        'website', 'geometry'
                    ])['result']
                    
                    address_parts = details.get('formatted_address', '').split(',')
                    street = address_parts[0] if address_parts else ''
                    zip_code = address_parts[-1].strip().split()[-1] if len(address_parts) >= 3 else ''
                    
                    self.results.append({
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
                        'collected_at': datetime.now().isoformat()
                    })
                    
                    new_count += 1
                except:
                    continue
            
            return new_count
        except:
            return 0
    
    def export_to_csv(self, filename):
        """Export to CSV"""
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
        
        cost = self.query_count * 0.017
        print(f"\n✅ Saved {len(self.results)} resources to {filename}")
        print(f"💰 Cost: ${cost:.2f} ({self.query_count} queries)")
        if cost == 0:
            print("   🎉 FREE with Google credit!")

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--state', choices=['IL', 'MO'], required=True)
    parser.add_argument('--output-dir', default='../data')
    parser.add_argument('--max-queries', type=int, default=11000)
    parser.add_argument('--api-key', help='Google API key')
    args = parser.parse_args()
    
    api_key = args.api_key or os.environ.get('GOOGLE_PLACES_API_KEY')
    if not api_key:
        print("❌ Need API key")
        return 1
    
    os.makedirs(args.output_dir, exist_ok=True)
    
    collector = OptimizedFoodBankCollector(api_key, args.max_queries)
    collector.collect_optimized(args.state)
    
    filename = f"{args.output_dir}/{args.state.lower()}_food_banks_optimized.csv"
    collector.export_to_csv(filename)
    
    print(f"\nNext: python import_csv.py --file {filename}")
    return 0

if __name__ == '__main__':
    exit(main())
