from django.db import models

class Medication(models.Model):
    name = models.CharField(max_length=200)
    dose = models.CharField(max_length=100)
    route = models.CharField(max_length=50)
    start_date = models.DateField()
    end_date = models.DateField(null=True, blank=True)  # null = ongoing/unknown
    facility = models.CharField(max_length=200)

    def __str__(self) -> str:
        return f"{self.name} ({self.dose})"


# Create your models here.
