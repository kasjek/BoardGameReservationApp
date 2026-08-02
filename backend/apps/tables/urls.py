from django.urls import path

from .views import (
    SeatCancelView,
    SeatReserveView,
    TableConfirmView,
    TableDetailView,
    TableListCreateView,
    TableRejectView,
)

urlpatterns = [
    path("tables", TableListCreateView.as_view(), name="table-list"),
    path("tables/<int:pk>", TableDetailView.as_view(), name="table-detail"),
    path("tables/<int:pk>/confirm", TableConfirmView.as_view(), name="table-confirm"),
    path("tables/<int:pk>/reject", TableRejectView.as_view(), name="table-reject"),
    path("tables/<int:pk>/seats", SeatReserveView.as_view(), name="seat-reserve"),
    path("tables/<int:pk>/seats/cancel", SeatCancelView.as_view(), name="seat-cancel"),
]
