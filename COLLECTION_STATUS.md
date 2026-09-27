# HumanAid historical data collection notes

**Original observation date:** November 25, 2025, 8:35 PM

**Status wording clarified:** September 27, 2026

These are historical collection notes, not a current inventory or evidence of complete coverage. The reported counts below have not been recounted in this review. They describe different collection, import, and cleanup stages; some totals and geographic counts were not reconciled in the original notes.

Automated collection, duplicate detection, categorization, and AI cleanup do not establish human or provider verification, current service availability, or exhaustive coverage of Illinois or Missouri. No statewide completeness or verification claim is supported by these notes.

## Reported collection observations

The original notes recorded growth from 13 resources to 8,416 before the later cleanup count, described at the time as approximately 647 times the starting size. They mentioned records from 95 or more cities across Illinois and Missouri, including Waterloo, Illinois. These are historical observations about collected records, not counts of fully mapped cities.

### Illinois food bank collection

- **Records reported collected:** 5,094
- **Records reported imported:** 4,000, with 1,094 skipped as duplicates
- **Reported collection geography:** 55 Illinois cities
- **Recorded output file:** `data/il_all_food_banks.csv`
- **Reported elapsed time:** approximately 35 minutes
- **Original cost estimate:** approximately $50; no billing verification was recorded here

### Rockford collection

- **Records reported collected:** 252
- **Records reported imported:** 226
- **Categories mentioned:** food, shelters, clinics, mental health, legal aid, job training, and clothing
- **Recorded output file:** `data/rockford_food_banks.csv`

These import counts describe reported batches. They do not establish that every relevant service in a city or state was collected, or that the records remain accurate.

## Reported post-cleanup database observations

- **Resource count:** 7,614
- **Automated cleanup notes:** 802 records removed as non-relevant businesses; 847 records automatically categorized; an AI assessment was also reported
- **Category count:** 66 categories reported seeded
- **Resource types mentioned:** food banks, pantries, soup kitchens, distribution centers, outreach programs
- **Geographic counts recorded separately:** 55 major Illinois cities, 50 small Illinois towns, 40 Missouri cities, and a separate total described as 95 or more cities

The geographic figures may overlap or refer to different runs; the original notes do not establish a reconciled unique-city total. The resource totals also belong to different stages. Treat the AI assessment as automated output, not human or provider confirmation.

## Archived workflow notes

The original document mixed completion announcements with pending Illinois and Missouri tasks. Those labels were inconsistent, so no current completion state is inferred from them. The following commands preserve the historical workflow only. Review targets, data provenance, credentials, cost, and script behavior before any separately authorized run; this document is not authorization to collect or import data.

1. Import an Illinois collection file:

   ```bash
   cd /home/admx/CascadeProjects/HumanAid/scripts
   python import_csv.py --file ../data/il_all_food_banks.csv
   ```

2. Collect Missouri records:

   ```bash
   : "${GOOGLE_PLACES_API_KEY:?Load the key through a secure environment}"
   python collect_all_food_banks.py --state MO --output-dir ../data
   ```

3. Import a Missouri collection file:

   ```bash
   python import_csv.py --file ../data/mo_all_food_banks.csv
   ```

## Historical cost and planning notes

The original notes reported $0.41 for 24 Rockford queries, estimated $50–70 for 3,000–4,000 Illinois queries, and separately listed a running total of $0.41. These figures were not reconciled as a final bill. The assumed $200 monthly credit and $199.59 remaining balance were historical planning assumptions, not current pricing, available credit, or a guarantee of free collection.

The archived targets were 252 Rockford records, approximately 500 Illinois food banks, approximately 400 Missouri food banks, and 1,000 or more total records by the end of that week. They describe the original plan and do not supersede the reported batch counts above or establish current collection status.

## Historical diagnostic commands

These commands were recorded for checking a collection process and an output file. No currently running process or scheduled completion is asserted.

```bash
ps aux | grep collect_all_food_banks
tail -20 /home/admx/CascadeProjects/HumanAid/data/il_all_food_banks.csv
```

The historical restart example was:

```bash
cd /home/admx/CascadeProjects/HumanAid/scripts
: "${GOOGLE_PLACES_API_KEY:?Load the key through a secure environment}"
python collect_all_food_banks.py --state IL --output-dir ../data
```

Check actual API usage and billing in the authorized Google Cloud account before any new collection. No new collection, import, dataset verification, or billing check was performed for this documentation update.
