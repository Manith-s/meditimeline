# Medication Timeline

A patient medication timeline viewer that helps clinicians understand medication history across multiple facilities. This project demonstrates handling of inconsistent, incomplete, and contradictory medication records from fragmented healthcare systems.

## Live Demo

- **Frontend (Vercel):** https://meditimeline.vercel.app
- **Backend API (Render):** https://meditimeline.onrender.com/api/medications/

> Note: The backend root (`/`) may return **404** on Render — that's expected. Use the API endpoint above.

## Tech Stack

- **Backend:** Python with Django and Django REST Framework
- **Database:** SQLite (for simplicity)
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

1. **Same medication from different facilities** — Shows CONFLICT + FACILITY CHANGE chips when overlapping dates with different facilities
2. **Dose changes over time** — Shows DOSE CHANGE chip for sequential records with different doses
3. **Missing/incomplete data** — Handles null `end_date` as "ongoing" medication
4. **Conflicting records** — Detects overlapping dates with contradictory data (dose, facility, or route changes)
5. **Invalid date ranges** — Backend validation prevents end_date < start_date; frontend displays warning for legacy invalid data
6. **Gaps between medications** — Calculates and displays gap duration between sequential records

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
2. **Filtering/Search**: Allow filtering by medication name, facility, or date range
3. **Visual Enhancements**: Color-code timeline by medication type, add duration bars
4. **Testing**: Add unit tests for edge case detection logic (overlap, conflict, gap calculations)
5. **Performance**: Add pagination for large medication histories
6. **Accessibility**: Improve keyboard navigation and screen reader support
7. **Data Export**: Allow exporting medication timeline as PDF or CSV

## What I Found Tricky

1. **Overlap Detection Logic**: Handling ongoing medications (null end_date) required treating null as "infinity" to correctly detect overlaps with future records. Using UTC dates consistently (`toUtcMs` function) was key to avoiding timezone issues.

2. **Finding Previous Record**: Initially used O(n²) approach (reverse search for each medication). Optimized to O(n) by precomputing a lookup map that tracks the most recent previous record of each medication name.

3. **Conflict vs Transition**: Distinguishing between conflicts (overlapping contradictory data) and transitions (sequential changes) required careful logic. Conflicts only occur when dates overlap AND data differs; transitions occur when records are sequential.

4. **Date Handling**: Avoiding timezone issues by parsing dates as UTC consistently across all comparisons. Added defensive parsing to handle invalid date strings gracefully.

5. **Deployment**: Getting CORS configured correctly for both local dev and production (Vercel + Render) required understanding both platforms' requirements and environment variable handling.

## AI Tools Used

I used **Claude (Anthropic)** for:
- Code review and optimization suggestions
- Edge case analysis and validation logic review
- README structure and technical writing
- Debugging deployment and CORS issues
- TypeScript type checking and best practices

The AI helped accelerate development and catch potential issues, but all architectural decisions, data modeling choices, and implementation details were made by me.

## Time Spent

Approximately **4-5 hours** total:
- **1 hour**: Data modeling, backend setup (Django models, serializers, API endpoints)
- **1.5 hours**: Frontend timeline implementation (React, Material-UI, edge case detection logic)
- **1 hour**: Edge case handling and conflict detection (overlap, gaps, transitions)
- **0.5 hours**: Performance optimization (O(n) lookup map)
- **1 hour**: Deployment, debugging, and documentation

## Project Structure

```
meditimeline/
├── backend/
│   ├── medications/
│   │   ├── models.py          # Medication data model
│   │   ├── serializers.py      # DRF serializer with validation
│   │   ├── views.py            # API viewset
│   │   └── fixtures/
│   │       └── medications.json # Mock medication data
│   └── config/
│       └── settings.py         # Django settings (CORS, etc.)
├── frontend/
│   └── src/
│       ├── App.tsx             # Main timeline component
│       └── api/
│           └── medications.ts  # API client
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
