## Project Overview

This project displays a patient's medication history as a timeline, based on records from multiple facilities.

- **Backend:** Django + Django REST Framework (GET `/api/medications/`)
- **Frontend:** React + TypeScript + Material UI Timeline
- **Mock data:** Seeded via JSON fixture (`backend/medications/fixtures/medications.json`)
- **UI cues:** Flags medication **overlaps**, **gaps**, and **switches** (dose / facility changes)

## Live Demo

- **Frontend (Vercel):** https://meditimeline.vercel.app
- **Backend API (Render):** https://meditimeline.onrender.com/api/medications/

> Note: The backend root (`/`) may return **404** on Render — that’s expected. Use the API endpoint above.




## Local Development

### Backend (Django)

    cd backend

    # activate venv (Windows PowerShell)
    .\.venv\Scripts\Activate.ps1

    # run server
    python manage.py runserver

- Backend runs at: http://127.0.0.1:8000
- API endpoint: http://127.0.0.1:8000/api/medications/

### Frontend (React)

    cd frontend
    npm start

- Frontend runs at: http://localhost:3000

### CORS (dev)

The Django backend is configured to allow requests from:
- http://localhost:3000
