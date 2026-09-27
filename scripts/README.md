# HumanAid Data Collection Scripts

Python scripts for collecting and importing humanitarian resource data.

## 🚀 Quick Start

### 1. Install Dependencies

```bash
cd scripts
pip install -r requirements.txt
```

### 2. Set Up API Keys

Get a Google Places API key from: https://console.cloud.google.com/

```bash
export GOOGLE_PLACES_API_KEY="your_api_key_here"
```

### 3. Collect Data for a City

```bash
# Example: Collect resources in Rockford, IL
python google_places_collector.py \
  --city Rockford \
  --state IL \
  --radius 15 \
  --output ../data/rockford_resources.csv
```

### 4. Import to Database

Set `DB_PASSWORD` through your secure local environment before running imports. Never pass a database password on the command line.

```bash
python import_csv.py \
  --file ../data/rockford_resources.csv
```

---

## 📖 Script Documentation

### `google_places_collector.py`

Collects humanitarian resources using Google Places API.

**Usage:**
```bash
python google_places_collector.py --city CITY --state STATE [OPTIONS]
```

**Options:**
- `--city` - City to search (required)
- `--state` - State abbreviation: IL or MO (required)
- `--radius` - Search radius in miles (default: 10)
- `--output` - Output CSV file path (default: data/collected_resources.csv)
- `--api-key` - Google Places API key (or set GOOGLE_PLACES_API_KEY env var)

**Example:**
```bash
python google_places_collector.py \
  --city Chicago \
  --state IL \
  --radius 20 \
  --output ../data/chicago_resources.csv
```

**Categories Searched:**
- Food Pantries / Food Banks
- Emergency Shelters
- Free Clinics / Health Centers
- Mental Health Services
- Substance Abuse Treatment
- Legal Aid
- Job Training Centers
- Clothing Closets

**Cost:** ~$0.017 per query (Google Places API)

---

### `import_csv.py`

Imports resources from CSV into PostgreSQL database.

**Usage:**
```bash
python import_csv.py --file FILE [OPTIONS]
```

**Options:**
- `--file` - CSV file to import (required)
- `--db-host` - Database host (default: localhost)
- `--db-port` - Database port (default: 5432)
- `--db-name` - Database name (default: humanaid)
- `--db-user` - Database user (default: postgres)
- `--db-password` - Database password (or set DB_PASSWORD env var)

**CSV Format:**
```csv
name,address,city,state,latitude,longitude,phone,website,category
"Food Pantry",  "123 Main St","Chicago","IL",41.8781,-87.6298,"555-1234","http://example.com","food-pantries"
```

**Features:**
- Automatic duplicate detection
- Category mapping
- Data validation
- Batch imports
- Error reporting

---

## 🏙️ Batch Collection for Multiple Cities

### Illinois Major Cities

```bash
#!/bin/bash
# Collect resources for all major IL cities

cities=(
  "Chicago:20"
  "Aurora:15"
  "Rockford:15"
  "Joliet:12"
  "Naperville:12"
  "Springfield:12"
  "Peoria:12"
  "Elgin:10"
  "Champaign:10"
  "Waukegan:10"
)

for city_data in "${cities[@]}"; do
  IFS=':' read -r city radius <<< "$city_data"
  echo "Collecting $city..."
  python google_places_collector.py \
    --city "$city" \
    --state IL \
    --radius "$radius" \
    --output "../data/il_${city,,}_resources.csv"
  sleep 2
done
```

### Missouri Major Cities

```bash
#!/bin/bash
# Collect resources for all major MO cities

cities=(
  "Kansas City:20"
  "St. Louis:20"
  "Springfield:15"
  "Columbia:12"
  "Independence:12"
  "Lee's Summit:10"
  "O'Fallon:10"
  "St. Joseph:10"
)

for city_data in "${cities[@]}"; do
  IFS=':' read -r city radius <<< "$city_data"
  echo "Collecting $city..."
  python google_places_collector.py \
    --city "$city" \
    --state MO \
    --radius "$radius" \
    --output "../data/mo_${city// /_,,}_resources.csv"
  sleep 2
done
```

---

## 💾 Data Directory Structure

```
HumanAid/
├── data/
│   ├── il_chicago_resources.csv
│   ├── il_aurora_resources.csv
│   ├── mo_kansas_city_resources.csv
│   ├── mo_st_louis_resources.csv
│   └── ...
├── scripts/
│   ├── google_places_collector.py
│   ├── import_csv.py
│   └── requirements.txt
└── database/
    ├── seeds/
    └── migrations/
```

---

## 🔧 Troubleshooting

### "API key not found"
```bash
export GOOGLE_PLACES_API_KEY="your_key_here"
```

### "Database connection failed"
Check your database credentials and ensure PostgreSQL is running:
```bash
sudo systemctl status postgresql
```

### "Permission denied"
Make scripts executable:
```bash
chmod +x *.py
```

---

## 📊 Estimated Costs

### For Complete IL & MO Coverage:

| Task | Queries | Cost |
|------|---------|------|
| Chicago (20 mi radius) | ~500 | $8.50 |
| Other IL major cities (15) | ~2,000 | $34.00 |
| Kansas City / St. Louis | ~800 | $13.60 |
| Other MO major cities (15) | ~1,500 | $25.50 |
| **Total** | **~4,800** | **~$82** |

**Note:** Google provides $200/month free credit, so this is actually FREE!

---

## 🎯 Next Steps

1. **Run for top 5 cities first** (Chicago, St. Louis, Kansas City, Springfield IL, Springfield MO)
2. **Review and validate data** manually for accuracy
3. **Import to database** using import_csv.py
4. **Expand to remaining cities** gradually
5. **Set up automated weekly updates**

---

## 📧 Questions?

See the main DATA_COLLECTION_PLAN.md for the full strategy.
