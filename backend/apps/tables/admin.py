from django.contrib import admin

from .models import LateCancellationMark, SeatReservation, Table

admin.site.register(Table)
admin.site.register(SeatReservation)
admin.site.register(LateCancellationMark)
