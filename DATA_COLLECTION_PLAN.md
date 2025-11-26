# HumanAid - IL & MO Data Collection Plan

## 🎯 Goal
Populate database with **1,000+ verified resources** across all major cities in Illinois and Missouri within 60 days.

---

## 📊 Target Coverage

### Illinois (Top 20 Cities)
1. **Chicago** (2.7M) - 250+ resources
2. **Aurora** (180K) - 25+ resources
3. **Joliet** (150K) - 20+ resources
4. **Naperville** (149K) - 20+ resources
5. **Rockford** (148K) - 20+ resources
6. **Springfield** (114K) - 15+ resources
7. **Elgin** (112K) - 15+ resources
8. **Peoria** (111K) - 15+ resources
9. **Champaign** (88K) - 12+ resources
10. **Waukegan** (87K) - 12+ resources
11. **Cicero** (81K) - 10+ resources
12. **Bloomington** (78K) - 10+ resources
13. **Decatur** (70K) - 10+ resources
14. **Evanston** (75K) - 10+ resources
15. **Des Plaines** (58K) - 8+ resources
16. **Berwyn** (56K) - 8+ resources
17. **Wheaton** (53K) - 8+ resources
18. **Belleville** (42K) - 8+ resources
19. **Quincy** (40K) - 8+ resources
20. **Moline** (42K) - 8+ resources

### Missouri (Top 20 Cities)
1. **Kansas City** (509K) - 100+ resources
2. **St. Louis** (301K) - 100+ resources
3. **Springfield** (169K) - 30+ resources
4. **Columbia** (126K) - 20+ resources
5. **Independence** (123K) - 20+ resources
6. **Lee's Summit** (101K) - 15+ resources
7. **O'Fallon** (91K) - 12+ resources
8. **St. Joseph** (72K) - 10+ resources
9. **St. Charles** (70K) - 10+ resources
10. **St. Peters** (57K) - 10+ resources
11. **Blue Springs** (56K) - 8+ resources
12. **Florissant** (51K) - 8+ resources
13. **Joplin** (51K) - 8+ resources
14. **Chesterfield** (47K) - 8+ resources
15. **Jefferson City** (43K) - 8+ resources
16. **Cape Girardeau** (40K) - 8+ resources
17. **Wentzville** (40K) - 8+ resources
18. **Wildwood** (35K) - 6+ resources
19. **University City** (34K) - 6+ resources
20. **Ballwin** (30K) - 6+ resources

---

## 🔧 Data Collection Methods

### Method 1: Web Scraping (Automated) 🤖
**Priority: HIGH**

#### Target Websites:
1. **211 Illinois** (https://www.illinois211.org)
2. **211 Missouri** (https://www.211helps.org)
3. **IDHS Illinois** (https://www.dhs.state.il.us)
4. **Missouri DHSS** (https://health.mo.gov)
5. **Feeding America** - Food banks
6. **SAMHSA** - Substance abuse treatment
7. **HUD** - Housing resources
8. **FoodFinder.org**
9. **FindHelp.org**

#### Tools:
- Python + BeautifulSoup/Scrapy
- Selenium for JavaScript-heavy sites
- Rate limiting (1 request/second)
- User-agent rotation
- Error logging

### Method 2: API Integration (Semi-Automated) 🔌
**Priority: MEDIUM**

#### APIs to Use:
1. **Google Places API**
   - Search queries: "food bank", "homeless shelter", "free clinic"
   - Cost: $17 per 1,000 requests (Places API)
   - Estimated: $50-100 for 5,000 searches

2. **Yelp Fusion API** (Free tier)
   - Non-profit organizations
   - Community services
   - Free: 5,000 API calls/day

3. **Open Street Map (Overpass API)** (Free)
   - Query: social_facility, food_bank, shelter
   - Unlimited, rate-limited

4. **211 API** (If available)
   - Direct access to 211 database
   - Need to request access

### Method 3: Manual Data Entry (Human-Verified) 👥
**Priority: MEDIUM**

#### Sources:
1. Government directories
2. United Way listings
3. Chamber of Commerce directories
4. Local church/community bulletins
5. Facebook community groups

#### CSV Template:
```csv
name,address,city,state,zip_code,latitude,longitude,phone,website,description,categories
```

### Method 4: Partnerships & Crowdsourcing 🤝
**Priority: LOW (Long-term)**

1. Partner with local nonprofits
2. Volunteer data entry program
3. Community submission portal (Phase 2)
4. University partnerships (social work students)

---

## 📅 Implementation Timeline

### Week 1-2: Setup & Infrastructure
- [x] Create Python scraping scripts
- [ ] Set up Google Places API credentials
- [ ] Create CSV import pipeline
- [ ] Build data validation system
- [ ] Create deduplication logic

### Week 3-4: Chicago Metro Area (IL)
- [ ] Scrape 211 Illinois for Chicago
- [ ] Google Places API - Chicago (500 queries)
- [ ] Manual verification of top 50 resources
- [ ] Target: 250+ Chicago resources

### Week 5-6: St. Louis Metro Area (MO)
- [ ] Scrape 211 Missouri for St. Louis
- [ ] Google Places API - St. Louis (500 queries)
- [ ] Manual verification of top 50 resources
- [ ] Target: 100+ St. Louis resources

### Week 7-8: Other Major Cities (IL)
- [ ] Aurora, Rockford, Springfield, Peoria, Joliet
- [ ] Google Places API (1,000 queries)
- [ ] Target: 150+ resources

### Week 9-10: Other Major Cities (MO)
- [ ] Kansas City, Springfield, Columbia, Independence
- [ ] Google Places API (500 queries)
- [ ] Target: 100+ resources

### Week 11-12: Smaller Cities & Rural Areas
- [ ] Remaining cities (population > 30K)
- [ ] County-level coverage
- [ ] Target: 200+ resources

---

## 🛠️ Tools to Build

### 1. Web Scraper (`scripts/scraper.py`)
```python
# Features:
- Multi-threaded scraping
- Automatic retry with exponential backoff
- CSV export
- Error logging
- Progress tracking
```

### 2. Google Places Collector (`scripts/google_places_collector.py`)
```python
# Features:
- Query builder for each category
- Location-based radius search
- Geocoding integration
- Rate limiting
- Cost tracking
```

### 3. CSV Import Tool (`scripts/import_csv.py`)
```python
# Features:
- Validate all fields
- Geocode addresses if lat/lon missing
- Check for duplicates
- Batch insert to database
- Generate report
```

### 4. Data Validator (`scripts/validate_data.py`)
```python
# Features:
- Phone number validation
- Address validation
- URL checking
- Duplicate detection
- Category matching
```

### 5. Deduplication Tool (`scripts/deduplicate.py`)
```python
# Features:
- Fuzzy name matching
- Address similarity
- Phone number matching
- Merge duplicates
```

---

## 📝 Data Quality Standards

### Required Fields:
- ✅ Name
- ✅ Address
- ✅ City
- ✅ State
- ✅ ZIP Code
- ✅ At least one category

### Highly Recommended:
- Phone number (90%+ coverage)
- Latitude/Longitude (100% via geocoding)
- Description (80%+ coverage)

### Optional:
- Website
- Hours of operation
- Eligibility requirements
- Languages spoken

---

## 💰 Budget Estimate

| Item | Cost |
|------|------|
| Google Places API (5,000 queries) | $85 |
| Mapbox Geocoding (if needed) | $0 (free tier) |
| Developer time (100 hours @ $0) | $0 (volunteer) |
| **Total** | **~$100** |

---

## 🎯 Success Metrics

### Phase 1 (30 days):
- [x] 13 resources (current)
- [ ] 500+ resources total
- [ ] 20+ cities covered
- [ ] 90%+ data accuracy

### Phase 2 (60 days):
- [ ] 1,000+ resources total
- [ ] 40+ cities covered
- [ ] 95%+ data accuracy
- [ ] All major categories represented

### Phase 3 (90 days):
- [ ] 2,000+ resources total
- [ ] 100+ cities covered
- [ ] Community submission portal live
- [ ] Partnership with 211 established

---

## 🚀 Getting Started

### Step 1: Install Dependencies
```bash
pip install requests beautifulsoup4 selenium pandas googlemaps
```

### Step 2: Set Up API Keys
```bash
# Add to backend/.env
GOOGLE_PLACES_API_KEY=your_key_here
MAPBOX_GEOCODING_TOKEN=your_token_here
```

### Step 3: Run Data Collection
```bash
# Scrape 211 sites
python scripts/scrape_211.py --state IL --output data/il_resources.csv

# Collect from Google Places
python scripts/google_places_collector.py --city Chicago --state IL

# Import to database
python scripts/import_csv.py --file data/il_resources.csv
```

---

## 📧 Contact & Support

For questions or to volunteer for data collection:
- Email: [your email]
- GitHub: [repository issues]
- Discord: [community server]

---

**Last Updated:** 2025-01-25
**Status:** In Progress - Week 1
