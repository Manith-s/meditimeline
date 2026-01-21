from rest_framework import viewsets
from .models import Medication
from .serializers import MedicationSerializer

class MedicationViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Medication.objects.all().order_by("start_date", "id")
    serializer_class = MedicationSerializer
