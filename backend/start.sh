#!/usr/bin/env bash
set -e

python manage.py migrate --noinput
python manage.py collectstatic --noinput

# seed only if empty
python manage.py shell -c "from medications.models import Medication; exit(0 if Medication.objects.exists() else 1)" \
  || python manage.py loaddata medications

gunicorn config.wsgi:application --bind 0.0.0.0:${PORT:-8000}
