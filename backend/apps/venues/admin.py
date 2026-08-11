from django.contrib import admin

from .models import Venue, VenueAvailability, VenueGame

admin.site.register(Venue)
admin.site.register(VenueAvailability)
admin.site.register(VenueGame)
