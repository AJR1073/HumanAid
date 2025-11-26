#!/bin/bash
# Quick Start Script for Food Bank Collection
# Run this after setting your GOOGLE_PLACES_API_KEY

echo "=========================================="
echo "🍽️  HumanAid Food Bank Collection"
echo "=========================================="
echo ""

# Check for API key
if [ -z "$GOOGLE_PLACES_API_KEY" ]; then
    echo "❌ Error: GOOGLE_PLACES_API_KEY not set"
    echo ""
    echo "Please set your API key:"
    echo "  export GOOGLE_PLACES_API_KEY='your_key_here'"
    echo ""
    echo "Get a key at: https://console.cloud.google.com/"
    exit 1
fi

echo "✅ API Key found"
echo ""

# Install dependencies if needed
if ! python3 -c "import googlemaps" 2>/dev/null; then
    echo "📦 Installing dependencies..."
    pip install -r requirements.txt
fi

# Create data directory
mkdir -p ../data

echo ""
echo "=========================================="
echo "Starting collection..."
echo "=========================================="
echo ""
echo "This will:"
echo "  • Collect food banks from 50+ cities in Illinois"
echo "  • Collect food banks from 40+ cities in Missouri"
echo "  • Save to data/il_all_food_banks.csv and data/mo_all_food_banks.csv"
echo "  • Estimated time: 45-60 minutes"
echo "  • Estimated cost: ~$50 (FREE with Google credit)"
echo ""

read -p "Press Enter to start (or Ctrl+C to cancel)..."

echo ""
echo "🚀 Starting collection (this may take a while)..."
echo ""

# Run collection
python3 collect_all_food_banks.py --state BOTH --output-dir ../data

echo ""
echo "=========================================="
echo "✅ Collection complete!"
echo "=========================================="
echo ""
echo "Files created:"
ls -lh ../data/*_all_food_banks.csv 2>/dev/null || echo "  (check ../data/ directory)"
echo ""
echo "Next step: Import to database"
echo "  python3 import_csv.py --file ../data/il_all_food_banks.csv"
echo "  python3 import_csv.py --file ../data/mo_all_food_banks.csv"
echo ""
