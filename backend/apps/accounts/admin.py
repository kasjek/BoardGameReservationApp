from django.contrib import admin
from django.contrib.auth.admin import UserAdmin

from .models import DirectMessage, Friendship, User

admin.site.register(User, UserAdmin)
admin.site.register(Friendship)
admin.site.register(DirectMessage)
