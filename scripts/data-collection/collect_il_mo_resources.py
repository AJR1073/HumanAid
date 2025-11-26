#!/usr/bin/env python3
"""
HumanAid - Illinois & Missouri Resource Collection Script
Collects assistance resources from multiple sources and populates the database
"""

import os
import json
import time
import requests
from typing import List, Dict, Optional
from dataclasses import dataclass, asdict
import psycopg2
from psycopg2.extras import execute_values
from dotenv import load_dotenv

# Try to import optional dependencies
try:
    from googlemaps import Client as GoogleMapsClient
    GOOGLE_MAPS_AVAILABLE = True
except ImportError:
    GOOGLE_MAPS_AVAILABLE = False
    print("⚠️  googlemaps not installed. Run: pip install googlemaps")

try:
    from bs4 import BeautifulSoup
    BS4_AVAILABLE = True
except ImportError:
    BS4_AVAILABLE = False
    print("⚠️  beautifulsoup4 not installed. Run: pip install beautifulsoup4")

load_dotenv()

@dataclass
class Resource:
    """Data class for a single resource"""
    name: str
    address: str
    city: str
    state: str
    zip_code: Optional[str]
    latitude: Optional[float]
    longitude: Optional[float]
    phone: Optional[str]
    website: Optional[str]
    category_slugs: List[str]
    description: Optional[str] = None
    hours: Optional[Dict] = None
    email: Optional[str] = None

class ResourceCollector:
    """Main class for collecting resources from various sources"""
    
    def __init__(self):
        self.db_conn = None
        self.google_maps = None
        self.resources = []
        
        # Initialize Google Maps if available
        if GOOGLE_MAPS_AVAILABLE and os.getenv('GOOGLE_MAPS_API_KEY'):
            self.google_maps = GoogleMapsClient(key=os.getenv('GOOGLE_MAPS_API_KEY'))
            print("✅ Google Maps API initialized")
        else:
            print("⚠️  Google Maps API not available")
    
    def connect_db(self):
        """Connect to PostgreSQL database"""
        try:
            self.db_conn = psycopg2.connect(
                host=os.getenv('DB_HOST', 'localhost'),
                database=os.getenv('DB_NAME', 'humanaid'),
                user=os.getenv('DB_USER', 'postgres'),
                password=os.getenv('DB_PASSWORD')
            )
            print("✅ Connected to database")
        except Exception as e:
            print(f"❌ Database connection failed: {e}")
            raise
    
    def geocode_address(self, address: str) -> Optional[tuple]:
        """Geocode an address to lat/lon using Google Maps"""
        if not self.google_maps:
            return None
        
        try:
            result = self.google_maps.geocode(address)
            if result:
                location = result[0]['geometry']['location']
                return (location['lat'], location['lng'])
        except Exception as e:
            print(f"⚠️  Geocoding failed for {address}: {e}")
        
        return None
    
    def collect_food_pantries_il(self):
        """Collect food pantries in Illinois"""
        print("\n🍽️  Collecting Illinois food pantries...")
        
        # Illinois cities to search
        il_cities = [
            'Chicago', 'Aurora', 'Naperville', 'Joliet', 'Rockford',
            'Springfield', 'Peoria', 'Elgin', 'Waukegan', 'Champaign',
            'Bloomington', 'Decatur', 'Evanston', 'Des Plaines', 'Berwyn'
        ]
        
        for city in il_cities:
            print(f"  Searching {city}...")
            
            if self.google_maps:
                try:
                    # Search for food pantries
                    results = self.google_maps.places(
                        query=f"food pantry {city} IL",
                        type='establishment'
                    )
                    
                    for place in results.get('results', []):
                        details = self.google_maps.place(place['place_id'])['result']
                        
                        resource = Resource(
                            name=details.get('name'),
                            address=details.get('formatted_address', '').split(',')[0],
                            city=city,
                            state='IL',
                            zip_code=self._extract_zip(details.get('formatted_address', '')),
                            latitude=details['geometry']['location']['lat'],
                            longitude=details['geometry']['location']['lng'],
                            phone=details.get('formatted_phone_number'),
                            website=details.get('website'),
                            category_slugs=['food-pantries'],
                            description=f"Food pantry in {city}, IL"
                        )
                        
                        self.resources.append(resource)
                    
                    time.sleep(0.5)  # Rate limiting
                    
                except Exception as e:
                    print(f"    Error searching {city}: {e}")
    
    def collect_shelters_il(self):
        """Collect emergency shelters in Illinois"""
        print("\n🏠 Collecting Illinois shelters...")
        
        il_cities = [
            'Chicago', 'Aurora', 'Rockford', 'Springfield', 'Peoria',
            'Champaign', 'Bloomington', 'Decatur'
        ]
        
        for city in il_cities:
            print(f"  Searching {city}...")
            
            if self.google_maps:
                try:
                    results = self.google_maps.places(
                        query=f"homeless shelter {city} IL",
                        type='establishment'
                    )
                    
                    for place in results.get('results', []):
                        details = self.google_maps.place(place['place_id'])['result']
                        
                        resource = Resource(
                            name=details.get('name'),
                            address=details.get('formatted_address', '').split(',')[0],
                            city=city,
                            state='IL',
                            zip_code=self._extract_zip(details.get('formatted_address', '')),
                            latitude=details['geometry']['location']['lat'],
                            longitude=details['geometry']['location']['lng'],
                            phone=details.get('formatted_phone_number'),
                            website=details.get('website'),
                            category_slugs=['emergency-shelters'],
                            description=f"Emergency shelter in {city}, IL"
                        )
                        
                        self.resources.append(resource)
                    
                    time.sleep(0.5)
                    
                except Exception as e:
                    print(f"    Error searching {city}: {e}")
    
    def collect_food_pantries_mo(self):
        """Collect food pantries in Missouri"""
        print("\n🍽️  Collecting Missouri food pantries...")
        
        mo_cities = [
            'Kansas City', 'St. Louis', 'Springfield', 'Columbia',
            'Independence', 'Lee\'s Summit', 'O\'Fallon', 'St. Joseph',
            'St. Charles', 'Blue Springs'
        ]
        
        for city in mo_cities:
            print(f"  Searching {city}...")
            
            if self.google_maps:
                try:
                    results = self.google_maps.places(
                        query=f"food pantry {city} MO",
                        type='establishment'
                    )
                    
                    for place in results.get('results', []):
                        details = self.google_maps.place(place['place_id'])['result']
                        
                        resource = Resource(
                            name=details.get('name'),
                            address=details.get('formatted_address', '').split(',')[0],
                            city=city,
                            state='MO',
                            zip_code=self._extract_zip(details.get('formatted_address', '')),
                            latitude=details['geometry']['location']['lat'],
                            longitude=details['geometry']['location']['lng'],
                            phone=details.get('formatted_phone_number'),
                            website=details.get('website'),
                            category_slugs=['food-pantries'],
                            description=f"Food pantry in {city}, MO"
                        )
                        
                        self.resources.append(resource)
                    
                    time.sleep(0.5)
                    
                except Exception as e:
                    print(f"    Error searching {city}: {e}")
    
    def collect_health_clinics(self):
        """Collect free/low-cost health clinics"""
        print("\n🏥 Collecting health clinics...")
        
        all_cities = [
            ('Chicago', 'IL'), ('St. Louis', 'MO'), ('Springfield', 'IL'),
            ('Kansas City', 'MO'), ('Rockford', 'IL'), ('Peoria', 'IL')
        ]
        
        for city, state in all_cities:
            print(f"  Searching {city}, {state}...")
            
            if self.google_maps:
                try:
                    results = self.google_maps.places(
                        query=f"free clinic {city} {state}",
                        type='health'
                    )
                    
                    for place in results.get('results', []):
                        details = self.google_maps.place(place['place_id'])['result']
                        
                        resource = Resource(
                            name=details.get('name'),
                            address=details.get('formatted_address', '').split(',')[0],
                            city=city,
                            state=state,
                            zip_code=self._extract_zip(details.get('formatted_address', '')),
                            latitude=details['geometry']['location']['lat'],
                            longitude=details['geometry']['location']['lng'],
                            phone=details.get('formatted_phone_number'),
                            website=details.get('website'),
                            category_slugs=['free-clinics'],
                            description=f"Free or low-cost health clinic in {city}, {state}"
                        )
                        
                        self.resources.append(resource)
                    
                    time.sleep(0.5)
                    
                except Exception as e:
                    print(f"    Error searching {city}: {e}")
    
    def _extract_zip(self, address: str) -> Optional[str]:
        """Extract ZIP code from address string"""
        import re
        match = re.search(r'\b\d{5}(?:-\d{4})?\b', address)
        return match.group(0) if match else None
    
    def save_to_database(self):
        """Save collected resources to database"""
        if not self.db_conn or not self.resources:
            print("❌ No database connection or no resources to save")
            return
        
        print(f"\n💾 Saving {len(self.resources)} resources to database...")
        
        cursor = self.db_conn.cursor()
        saved_count = 0
        
        for resource in self.resources:
            try:
                # Insert resource
                cursor.execute("""
                    INSERT INTO resources (
                        name, slug, address, city, state, zip_code,
                        location, phone, website, description,
                        approval_status, is_active
                    ) VALUES (
                        %s, %s, %s, %s, %s, %s,
                        ST_SetSRID(ST_MakePoint(%s, %s), 4326)::geography,
                        %s, %s, %s, 'approved', true
                    ) RETURNING id
                """, (
                    resource.name,
                    self._slugify(resource.name),
                    resource.address,
                    resource.city,
                    resource.state,
                    resource.zip_code,
                    resource.longitude,
                    resource.latitude,
                    resource.phone,
                    resource.website,
                    resource.description
                ))
                
                resource_id = cursor.fetchone()[0]
                
                # Link to categories
                for category_slug in resource.category_slugs:
                    cursor.execute("""
                        INSERT INTO resource_categories (resource_id, category_id)
                        SELECT %s, id FROM categories WHERE slug = %s
                        ON CONFLICT DO NOTHING
                    """, (resource_id, category_slug))
                
                saved_count += 1
                
            except Exception as e:
                print(f"  ⚠️  Error saving {resource.name}: {e}")
                continue
        
        self.db_conn.commit()
        print(f"✅ Saved {saved_count} resources successfully!")
    
    def _slugify(self, text: str) -> str:
        """Convert text to URL-friendly slug"""
        import re
        text = text.lower()
        text = re.sub(r'[^a-z0-9]+', '-', text)
        return text.strip('-')
    
    def export_to_json(self, filename: str = 'resources_export.json'):
        """Export collected resources to JSON file"""
        data = [asdict(r) for r in self.resources]
        with open(filename, 'w') as f:
            json.dump(data, f, indent=2)
        print(f"✅ Exported {len(data)} resources to {filename}")
    
    def run_full_collection(self):
        """Run complete data collection process"""
        print("="* 60)
        print("HumanAid Resource Collection - Illinois & Missouri")
        print("="*60)
        
        # Collect from all sources
        self.collect_food_pantries_il()
        self.collect_shelters_il()
        self.collect_food_pantries_mo()
        self.collect_health_clinics()
        
        print(f"\n📊 Total resources collected: {len(self.resources)}")
        
        # Export to JSON
        self.export_to_json()
        
        # Save to database
        if self.db_conn:
            self.save_to_database()
        else:
            print("⚠️  No database connection - resources only exported to JSON")

def main():
    """Main entry point"""
    collector = ResourceCollector()
    
    # Try to connect to database
    try:
        collector.connect_db()
    except:
        print("⚠️  Continuing without database connection")
    
    # Run collection
    collector.run_full_collection()
    
    print("\n✅ Resource collection complete!")

if __name__ == '__main__':
    main()
