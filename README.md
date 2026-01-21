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
