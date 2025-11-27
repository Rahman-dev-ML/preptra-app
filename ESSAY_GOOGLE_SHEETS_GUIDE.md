# How to Add Your Essay Data (Google Sheets or CSV)

## Option 1: Using Google Sheets (Recommended)

### Step 1: Prepare Your Google Sheet
1. Create a Google Sheet with your Essay analysis data
2. Structure it with columns like:
   - Year
   - Essay Topic
   - Theme/Category
   - Marks Range
   - Key Points
   - Success Tips

### Step 2: Make it Public and Get Embed URL
1. Click **Share** button → **"Anyone with the link can view"**
2. Click **File** → **Share** → **Publish to web**
3. In the dialog:
   - Choose **Embed** tab
   - Select **Entire Document** or specific sheet
   - Click **Publish**
   - Copy the iframe embed code

### Step 3: Extract the URL
From the iframe code, copy just the URL part:
```
https://docs.google.com/spreadsheets/d/YOUR_SHEET_ID/pubhtml?widget=true&headers=false
```

### Step 4: Update the Code
Edit `css-past-papers-app/app/css/[subject]/page.tsx` and replace:
```typescript
googleSheetUrl="YOUR_GOOGLE_SHEET_EMBED_URL_HERE"
```
with your actual URL:
```typescript
googleSheetUrl="https://docs.google.com/spreadsheets/d/YOUR_SHEET_ID/pubhtml?widget=true&headers=false"
```

## Option 2: Using CSV Files

### Step 1: Convert CSV to JSON
If you have CSV files, first convert them to JSON:

1. Use an online converter like https://csvjson.com/csv2json
2. Or use this PowerShell command:
```powershell
$csv = Import-Csv "your-essay-data.csv"
$csv | ConvertTo-Json | Out-File "essay-data.json"
```

### Step 2: Create a Data File
Create `css-past-papers-app/data/essay-data.ts`:
```typescript
export const essayData = [
  {
    year: 2023,
    topic: "Climate Change and Pakistan",
    category: "Environmental",
    marksRange: "40-50",
    keyPoints: "Focus on local impact, policy suggestions"
  },
  // Add more rows...
];
```

### Step 3: Update the Component
In the subject page, import and pass the CSV data:
```typescript
import { essayData } from '@/data/essay-data';

// Then in the component:
<EssayAnalysis csvData={essayData} />
```

## Option 3: Dynamic Google Sheets (Advanced)

For real-time updates from Google Sheets:

1. Use Google Sheets API
2. Install package: `npm install googleapis`
3. Create API credentials in Google Cloud Console
4. Fetch data dynamically

## Tips:
- Keep your Google Sheet well-organized
- Use clear column headers
- Include years, topics, and analysis
- Add scoring patterns and tips
- Update regularly with new essay topics

## Example Google Sheet Structure:
| Year | Essay Topic | Theme | Avg Marks | Key Focus Areas | Tips |
|------|------------|-------|-----------|-----------------|------|
| 2023 | Democracy in Pakistan | Political | 35-45 | Current challenges, solutions | Use recent examples |
| 2022 | Technology and Society | Science | 40-50 | AI, social media impact | Balance pros/cons | 