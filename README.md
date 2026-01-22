# Medication Timeline

A patient medication timeline viewer that helps clinicians understand medication history across multiple facilities. This project demonstrates handling of inconsistent, incomplete, and contradictory medication records from fragmented healthcare systems.

## Live Demo

- **Frontend (Vercel):** https://meditimeline.vercel.app
- **Backend API (Render):** https://meditimeline.onrender.com/api/medications/

> Note: The backend root (`/`) may return **404** on Render — that's expected. Use the API endpoint above.

## Tech Stack

- **Backend:** Python with Django and Django REST Framework
- **Database:** SQLite (for simplicity - PostgreSQL could be used in production)
- **Frontend:** React with TypeScript
- **Styling:** Material-UI

## Local Development

### Backend (Django)

```bash
cd backend

# Create and activate virtual environment (Windows PowerShell)
python -m venv .venv
.\.venv\Scripts\Activate.ps1

# Install dependencies
pip install -r requirements.txt

# Run migrations
python manage.py migrate

# Load medication fixtures
python manage.py loaddata medications

# Start development server
python manage.py runserver
```

- Backend runs at: http://127.0.0.1:8000
- API endpoint: http://127.0.0.1:8000/api/medications/

### Frontend (React)

```bash
cd frontend

# Install dependencies
npm install

# Start development server
npm start
```

- Frontend runs at: http://localhost:3000

### CORS Configuration

The Django backend is configured to allow requests from:
- http://localhost:3000 (local development)
- https://meditimeline.vercel.app (production)

## Edge Cases Handled

1. **Same medication from two different facilities** — Shows CONFLICT + FACILITY CHANGE chips when overlapping dates with different facilities
2. **Dose changes over time** — Shows DOSE CHANGE chip for sequential records with different doses
3. **Missing or incomplete date information** — Handles null `end_date` as "ongoing" medication
4. **Conflicting records** — Detects overlapping dates with contradictory data (dose, facility, or route changes)
5. **Invalid date ranges** — Backend validation prevents end_date < start_date; frontend displays warning for legacy invalid data
6. **Gaps between medications** — Calculates and displays gap duration between sequential records

## How I Thought About Structuring the Data

### Data Model Design

I structured the medication data model around the core clinical question: "What medications was the patient taking, when, and from where?" The model includes:

- **`name`** (CharField, max 200): Medication name (e.g., "Metformin", "Lisinopril")
- **`dose`** (CharField, max 100): Dosage as string to handle various formats (e.g., "500 mg", "10 units")
- **`route`** (CharField, max 50): Administration route (e.g., "oral", "IV", "subcutaneous")
- **`start_date`** (DateField): When the medication started (required)
- **`end_date`** (DateField, nullable): When it ended, or `null` for ongoing medications
- **`facility`** (CharField, max 200): Prescribing facility or source

**Rationale**: This structure captures the essential information clinicians need while remaining flexible enough to handle real-world data inconsistencies. I chose to store `dose` as a string rather than parsing it into numeric values and units because:
1. Real-world data often has inconsistent formatting ("500mg", "500 mg", "0.5g")
2. Parsing would add complexity without clear clinical benefit
3. String comparison is sufficient for detecting dose changes

### Representing "Ongoing" Medications

I used `null` for `end_date` to represent ongoing medications rather than a separate boolean field. This approach:
- **Pros**: Simpler data model, one less field to maintain, naturally represents "unknown end date" vs "ongoing"
- **Cons**: Requires frontend logic to interpret `null` correctly
- **Tradeoff**: Chose simplicity over explicit semantics, accepting that the frontend needs to handle this interpretation

### Mock Dataset Design

The fixture data (`medications.json`) includes 10 records designed to test edge cases:
- **Metformin**: Ongoing medication from different facilities (tests facility conflicts)
- **Lisinopril**: Multiple dose changes (5mg → 10mg → 20mg) and facility changes
- **Insulin Glargine**: Short-term medication with specific route
- **Prednisone**: Scheduled future medication
- **Route changes**: Same medication, different routes (oral vs IV)

This dataset intentionally creates overlaps, gaps, conflicts, and transitions to validate the edge case detection logic.

## What Tradeoffs I Considered

### Data Modeling Tradeoffs

1. **`end_date` as nullable vs separate `is_ongoing` boolean**
   - **Chose**: Nullable `end_date`
   - **Tradeoff**: Simpler schema but requires frontend interpretation
   - **Reason**: One less field to maintain, naturally represents both "ongoing" and "unknown end date"

2. **Dose as string vs parsed numeric + unit**
   - **Chose**: String storage
   - **Tradeoff**: Can't do numeric comparisons but handles inconsistent formatting
   - **Reason**: Real-world data is messy; string comparison sufficient for detecting changes

### Algorithm Tradeoffs

1. **O(n) lookup map vs O(n²) reverse search**
   - **Chose**: Precomputed lookup map (`prevByMedId`)
   - **Tradeoff**: Uses more memory but significantly faster
   - **Reason**: Scales better for large medication histories

2. **Same-medication-only comparison vs cross-medication analysis**
   - **Chose**: Only compare with previous record of same medication name
   - **Tradeoff**: Fast O(n) comparison but misses cross-medication interactions
   - **Reason**: Most clinical questions focus on continuity of specific medications

### UI/UX Tradeoffs

1. **Newest-first vs oldest-first timeline**
   - **Chose**: Newest-first (reverse chronological)
   - **Tradeoff**: Less intuitive for chronological progression but more useful for current status
   - **Reason**: Most recent medications are most relevant to clinicians

2. **Single component vs modular components**
   - **Chose**: Single `App.tsx` component (806 lines)
   - **Tradeoff**: Large file but all edge case logic co-located
   - **Reason**: Easier to reason about relationships between medications

### Validation Tradeoffs

1. **Backend-only vs frontend-only vs both**
   - **Chose**: Both backend and frontend validation
   - **Tradeoff**: Some redundancy but ensures data integrity and graceful error display
   - **Reason**: Backend prevents bad data, frontend handles legacy/invalid data gracefully

## What I Show (And What I Left Out)

### What I Show

1. **Timeline Visualization**: Chronological display (newest first for readability)
2. **Active Status**: Visual indicators for currently active medications (green dot, ACTIVE chip)
3. **Conflict Indicators**: CONFLICT chip for overlapping contradictory records
4. **Change Indicators**: DOSE CHANGE, FACILITY CHANGE, ROUTE CHANGE chips
5. **Gap Information**: Number of days between sequential records (e.g., "GAP: 5 day(s)")
6. **Date Ranges**: Human-readable format ("Aug 1st, 2023 → Sep 9th, 2024" or "→ ongoing")
7. **Search & Filter**: Filter by active/all, search by medication name
8. **Empty States**: Helpful messages when no medications match filters
9. **Data Validation Warnings**: INVALID DATE RANGE chip for legacy bad data
10. **Overlap Indicators**: OVERLAP chip when dates overlap but no conflict exists

### What I Left Out (And Why)

1. **Cross-Medication Interactions**: We don't analyze relationships between different medications (e.g., drug-drug interactions). **Why**: Focuses on medication continuity, which is the core requirement. Cross-medication analysis would require medication knowledge bases and is beyond scope.

2. **Dose Parsing**: We treat doses as strings rather than parsing into numeric values and units. **Why**: Real-world data has inconsistent formatting. Parsing would add complexity without clear benefit for timeline visualization.

3. **Facility Hierarchy**: We don't prioritize or rank facilities. **Why**: All facilities are treated equally - the timeline shows conflicts but doesn't judge which facility's record is "correct."

4. **Medication Grouping**: We don't group medications by type (e.g., "Cardiovascular", "Diabetes"). **Why**: Timeline focuses on chronological order and conflicts, not medication categorization.

5. **Duration Visualization**: We don't show visual bars representing medication duration. **Why**: Timeline dots and date ranges provide sufficient information. Duration bars would add visual complexity.

6. **Edit/Create Functionality**: Read-only viewer. **Why**: Assessment requirement was to display timeline, not build a full CRUD application.

7. **Pagination**: All medications load at once. **Why**: Mock dataset is small (10 records). Pagination would add complexity without benefit for this assessment.

8. **Export Functionality**: No PDF/CSV export. **Why**: Nice-to-have feature, not core requirement.

9. **Medication Details Modal**: No expandable details view. **Why**: All essential information is visible in the timeline cards.

10. **Conflict Resolution UI**: No UI to mark conflicts as resolved. **Why**: Focus is on identifying conflicts, not resolving them.

## Design Decisions & Tradeoffs

### Data Modeling
- **Decision**: Used `end_date` as nullable to represent "ongoing" medications
- **Tradeoff**: Simple but requires frontend logic to interpret null as ongoing
- **Alternative considered**: Separate boolean `is_ongoing` field (rejected for simplicity)

### Edge Case Detection
- **Decision**: Only compare with previous record of the same medication name
- **Tradeoff**: Fast O(n) comparison using precomputed lookup map, but may miss cross-medication interactions
- **Rationale**: Most clinical questions focus on continuity of specific medications

### Conflict Detection
- **Decision**: Explicit conflict detection for overlapping records with contradictory data
- **Tradeoff**: More complex logic, but provides clear data quality signals
- **Rationale**: Helps clinicians identify records that need reconciliation. Shows both CONFLICT chip and specific change indicators (FACILITY CHANGE, DOSE CHANGE) for clarity.

### Date Range Validation
- **Decision**: Validate at both backend (model/serializer) and frontend (display) layers
- **Tradeoff**: Some redundancy, but ensures data integrity and graceful error display
- **Rationale**: Backend prevents bad data, frontend handles legacy/invalid data gracefully

### Performance Optimization
- **Decision**: Precompute previous medication lookup map in O(n) instead of O(n²) search
- **Tradeoff**: Slightly more memory, but significantly faster for large datasets
- **Rationale**: Scales better as medication history grows

## What I'd Improve With More Time

1. **Error Handling**: Add retry logic with exponential backoff for failed API calls
2. **Filtering/Search**: Expand filtering to include facility and date range filters
3. **Visual Enhancements**: Color-code timeline by medication type, add duration bars
4. **Testing**: Add unit tests for edge case detection logic (overlap, conflict, gap calculations)
5. **Performance**: Add pagination for large medication histories
6. **Accessibility**: Improve keyboard navigation and screen reader support
7. **Data Export**: Allow exporting medication timeline as PDF or CSV
8. **Medication Details**: Add expandable details view showing full medication information
9. **Conflict Resolution UI**: Allow clinicians to mark conflicts as resolved or merge records

## What I Found Tricky

1. **Overlap Detection Logic**: Handling ongoing medications (`null` end_date) required treating `null` as "infinity" (`Number.POSITIVE_INFINITY`) to correctly detect overlaps with future records. Using UTC dates consistently (`toUtcMs` function) was key to avoiding timezone issues. The logic `currStartMs < prevEndMs` works correctly when `prevEndMs` is `Number.POSITIVE_INFINITY` for ongoing medications.

2. **Finding Previous Record**: Initially used O(n²) approach (reverse search for each medication). Optimized to O(n) by precomputing a lookup map (`prevByMedId`) that tracks the most recent previous record of each medication name. The key insight was to iterate chronologically and maintain a `lastByName` map.

3. **Conflict vs Transition**: Distinguishing between conflicts (overlapping contradictory data) and transitions (sequential changes) required careful logic. Conflicts only occur when dates overlap AND data differs; transitions occur when records are sequential (no overlap). This distinction is important because conflicts indicate data quality issues that need reconciliation.

4. **Date Handling**: Avoiding timezone issues by parsing dates as UTC consistently across all comparisons. Added defensive parsing to handle invalid date strings gracefully. The `toUtcMs` function appends `T00:00:00Z` to ensure UTC parsing.

5. **Gap Calculation**: Calculating gaps correctly required understanding that a medication ending on day X and starting on day X+1 has 0 gap days (not 1). The formula `daysBetween(prevEnd, currStart) - 1` accounts for this.

6. **Active Medication Logic**: Determining if a medication is "active" required handling multiple cases:
   - Ongoing (`end_date === null`) → always active
   - Future start date → only active if ongoing
   - Ended today or earlier → not active
   - Invalid date range → not active

7. **Deployment**: Getting CORS configured correctly for both local dev and production (Vercel + Render) required understanding both platforms' requirements and environment variable handling. Render needed `ALLOWED_HOSTS` configuration, Vercel needed environment variables for API URL.

## AI Tools Used

I used **Claude (Anthropic)** for:
- Code review and optimization suggestions
- Edge case analysis and validation logic review
- README structure and technical writing
- Debugging deployment and CORS issues
- TypeScript type checking and best practices
- Performance optimization suggestions (O(n) lookup map)

The AI helped accelerate development and catch potential issues, but all architectural decisions, data modeling choices, and implementation details were made by me.

## Time Spent

Approximately **4-5 hours** total:
- **1 hour**: Data modeling, backend setup (Django models, serializers, API endpoints)
- **1.5 hours**: Frontend timeline implementation (React, Material-UI, edge case detection logic)
- **1 hour**: Edge case handling and conflict detection (overlap, gaps, transitions)
- **0.5 hours**: Performance optimization (O(n) lookup map)
- **1 hour**: Deployment, debugging, and documentation

## Git Commit Practices

This project uses meaningful, incremental commits showing the evolution of the work:
- Initial backend setup with Django models and API
- Frontend scaffolding and timeline rendering
- Edge case detection and conflict handling
- Performance optimizations
- Deployment configuration
- Bug fixes and UI improvements

Each commit represents a logical unit of work, making it easy to understand how the project evolved.

## Project Structure

```
meditimeline/
├── backend/
│   ├── medications/
│   │   ├── models.py          # Medication data model with validation
│   │   ├── serializers.py      # DRF serializer with validation
│   │   ├── views.py            # API viewset (ReadOnlyModelViewSet)
│   │   ├── urls.py             # URL routing
│   │   └── fixtures/
│   │       └── medications.json # Mock medication data (10 records)
│   ├── config/
│   │   ├── settings.py         # Django settings (CORS, database, etc.)
│   │   └── urls.py             # Root URL configuration
│   ├── requirements.txt        # Python dependencies
│   ├── Procfile                # Render deployment configuration
│   └── start.sh                # Startup script
├── frontend/
│   └── src/
│       ├── App.tsx             # Main timeline component (806 lines)
│       ├── api/
│       │   └── medications.ts  # API client with type definitions
│       └── index.tsx           # React entry point
└── README.md
```

## Key Features

- **Timeline Visualization**: Chronological display of medications with Material-UI Timeline component
- **Conflict Detection**: Identifies overlapping records with contradictory data
- **Change Indicators**: Shows dose changes, facility changes, route changes
- **Gap Detection**: Calculates and displays gaps between medication records
- **Data Validation**: Backend and frontend validation for data integrity
- **Empty State Handling**: Graceful display when no medications are found
- **Error Handling**: Basic error display with user-friendly messages
- **Search & Filter**: Filter by active/all, search by medication name
- **LocalStorage Persistence**: Remembers filter and search preferences
- **Responsive Design**: Works on desktop and mobile devices
