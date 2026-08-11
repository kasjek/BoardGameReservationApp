from django.contrib import admin

from .models import Venue, VenueAvailability, VenueClosure, VenueGame, VenueWeeklyHours

admin.site.register(Venue)
admin.site.register(VenueAvailability)
admin.site.register(VenueWeeklyHours)
admin.site.register(VenueClosure)
admin.site.register(VenueGame)
