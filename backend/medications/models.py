from django.db import models
from django.core.exceptions import ValidationError

class Medication(models.Model):
    name = models.CharField(max_length=200)
    dose = models.CharField(max_length=100)
    route = models.CharField(max_length=50)
    start_date = models.DateField()
    end_date = models.DateField(null=True, blank=True)  # null = ongoing/unknown
    facility = models.CharField(max_length=200)

    def clean(self):
        """Validate that end_date is not before start_date."""
        super().clean()
        if self.end_date and self.end_date < self.start_date:
            raise ValidationError({
                'end_date': 'End date cannot be before start date.'
            })

    def save(self, *args, **kwargs):
        """Ensure validation runs on save."""
        self.full_clean()
        super().save(*args, **kwargs)

    def __str__(self) -> str:
        return f"{self.name} ({self.dose})"


# Create your models here.
