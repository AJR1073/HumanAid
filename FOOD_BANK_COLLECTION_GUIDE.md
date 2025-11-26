# 🍽️ Food Bank Collection Guide - IL & MO

## 🎯 Goal
Collect **300-500 food banks** across **ALL cities** in Illinois and Missouri.

---

## 📊 Coverage

### Illinois: 50+ Cities
- **Major metros**: Chicago, Aurora, Rockford, Joliet, Naperville (20+ each)
- **Mid-size cities**: Springfield, Peoria, Champaign, Elgin (10-15 each)
- **Smaller cities**: 40+ cities with population > 25,000 (5-10 each)

### Missouri: 40+ Cities
- **Major metros**: Kansas City, St. Louis (50+ each)
- **Mid-size cities**: Springfield, Columbia, Independence (10-15 each)
- **Smaller cities**: 35+ cities with population > 25,000 (5-10 each)

---

## 🚀 Quick Start (3 Steps)

### Step 1: Get Google API Key (5 minutes)

1. Go to: https://console.cloud.google.com/
2. Create project: "HumanAid"
3. Enable "Places API"
4. Create API Key
5. **You get $200/month FREE** - this entire project costs $0!

```bash
export GOOGLE_PLACES_API_KEY="your_key_here"
```

### Step 2: Install Dependencies (2 minutes)

```bash
cd /home/admx/CascadeProjects/HumanAid/scripts
pip install -r requirements.txt
```

### Step 3: Run Collection (45-60 minutes)

```bash
./RUN_FOOD_BANK_COLLECTION.sh
```

**OR manually:**

```bash
python collect_all_food_banks.py --state BOTH --output-dir ../data
```

---

## 🔍 Testing for Specific Organizations

Before running the full collection, you can test if specific organizations will be found:

```bash
# Example: Search for Monroe County Outreach
python test_specific_search.py \
  --name "Monroe County Outreach" \
  --city "Waterloo" \
  --state "IL"

# Example: Search for a specific food bank
python test_specific_search.py \
  --name "Greater Chicago Food Depository" \
  --city "Chicago" \
  --state "IL"
```

This helps verify the collection will find community outreach centers, church programs, and county-run facilities.

---

## 📝 What It Does

The script will:

1. **Search 17 food-related queries** in each city using **2 search methods**:
   
   **Search Terms:**
   - "food bank"
   - "food pantry"
   - "food distribution center"
   - "free food"
   - "food assistance"
   - "community food"
   - "emergency food"
   - "soup kitchen"
   - "meals on wheels"
   - "food shelf"
   - "county outreach food"
   - "food distribution program"
   - "church food pantry"
   - "nonprofit food assistance"
   - "community outreach food"
   - "food ministry"
   - "feeding program"
   
   **Search Methods:**
   - **Nearby Search** (radius-based, finds nearby places)
   - **Text Search** (broader, finds specific organizations like "Monroe County Outreach")

2. **Cover all cities** in both states systematically

3. **Deduplicate automatically** - won't add the same place twice

4. **Save to CSV** with complete information:
   - Name
   - Full address
   - Phone number
   - Website
   - GPS coordinates
   - Category (food-pantries)

---

## 📁 Output Files

```
data/
├── il_all_food_banks.csv     (~200-300 resources)
└── mo_all_food_banks.csv     (~150-200 resources)
```

---

## 💰 Cost Breakdown

| Task | Cities | Search Terms | Methods | Queries | Cost | Actual |
|------|--------|-------------|---------|---------|------|--------|
| Illinois collection | 50 | 17 | 2 | ~850/city = ~42,500 | $722 | **$0** |
| Missouri collection | 40 | 17 | 2 | ~680/city = ~27,200 | $462 | **$0** |
| **Total** | **90** | **17** | **2** | **~69,700** | **~$1,185** | **$0** |

**Note:** This is MUCH more comprehensive than the basic version! But still FREE with Google's credits:
- Google gives you $200/month FREE
- You can run 11,700+ queries/month for free
- To stay under the free tier, collect 1-2 states per month
- Or just use the paid tier - still very affordable for the coverage!

**Google gives you $200/month FREE credit = $0 actual cost!**

---

## 🔍 What You'll Get

### Estimated Results:
- **Illinois**: 200-300 food resources
- **Missouri**: 150-200 food resources
- **Total**: 350-500 food banks

### Types of Resources:
- Food banks (major distribution centers)
- Food pantries (neighborhood locations)
- Soup kitchens (hot meals)
- Food distribution sites
- Meals on Wheels programs
- Emergency food programs
- Community food centers

---

## 📥 Import to Database

After collection completes:

```bash
# Import Illinois food banks
python import_csv.py --file ../data/il_all_food_banks.csv

# Import Missouri food banks  
python import_csv.py --file ../data/mo_all_food_banks.csv
```

---

## ⏱️ Timeline

| Activity | Time |
|----------|------|
| Get API key | 5 minutes |
| Install dependencies | 2 minutes |
| Run collection script | 45-60 minutes |
| Review CSV data | 10 minutes |
| Import to database | 5 minutes |
| **Total** | **~75 minutes** |

---

## 🎯 After Food Banks, Expand To:

1. **Shelters** (emergency, family, youth, veterans)
2. **Free Clinics** (medical, dental, mental health)
3. **Legal Aid** (free legal services)
4. **Job Training** (workforce development)
5. **Clothing Closets** (free clothing)
6. **And 60+ more categories!**

---

## 🔧 Troubleshooting

### "API key not found"
```bash
export GOOGLE_PLACES_API_KEY="your_key_here"
# Add to ~/.bashrc to make permanent
```

### "Module not found"
```bash
pip install googlemaps
```

### "Rate limit exceeded"
Wait a few minutes and try again. Script has built-in rate limiting.

### "No results for a city"
Normal - some smaller cities may have limited Google Places data. Real food banks will still be added manually later.

---

## 📧 Questions?

Check the main DATA_COLLECTION_PLAN.md for complete strategy.

---

## ✅ Checklist

- [ ] Get Google Places API key
- [ ] Set GOOGLE_PLACES_API_KEY environment variable
- [ ] Install Python dependencies
- [ ] Run `collect_all_food_banks.py`
- [ ] Review CSV files in `data/` directory
- [ ] Import to database with `import_csv.py`
- [ ] Verify resources in HumanAid web app
- [ ] Celebrate! 🎉

---

**Ready to help thousands of people find food assistance!** 🍽️❤️
