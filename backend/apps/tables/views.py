from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from . import services
from .models import Table
from .serializers import SeatReservationSerializer, TableCreateSerializer, TableSerializer


class TableListCreateView(generics.ListCreateAPIView):
    def get_permissions(self):
        if self.request.method in permissions.SAFE_METHODS:
            return [permissions.AllowAny()]
        return [permissions.IsAuthenticated()]

    def get_serializer_class(self):
        return TableCreateSerializer if self.request.method == "POST" else TableSerializer

    def get_queryset(self):
        qs = Table.objects.all().order_by("starts_at")
        params = self.request.query_params
        if venue_id := params.get("venueId"):
            qs = qs.filter(venue_id=venue_id)
        if status_ := params.get("status"):
            qs = qs.filter(status=status_)
        if game := params.get("game"):
            qs = qs.filter(game_title__icontains=game)
        return qs

    def create(self, request, *args, **kwargs):
        serializer = TableCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        table = services.create_table(organizer=request.user, **serializer.validated_data)
        return Response(TableSerializer(table).data, status=status.HTTP_201_CREATED)


class TableDetailView(generics.RetrieveAPIView):
    queryset = Table.objects.all()
    serializer_class = TableSerializer
    permission_classes = [permissions.AllowAny]


class TableConfirmView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        table = generics.get_object_or_404(Table, pk=pk)
        table = services.confirm_table(table=table, by_user=request.user)
        return Response(TableSerializer(table).data)


class TableRejectView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        table = generics.get_object_or_404(Table, pk=pk)
        table = services.reject_table(table=table, by_user=request.user)
        return Response(TableSerializer(table).data)


class SeatReserveView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        table = generics.get_object_or_404(Table, pk=pk)
        seat = services.reserve_seat(table=table, user=request.user)
        return Response(SeatReservationSerializer(seat).data, status=status.HTTP_201_CREATED)


class SeatCancelView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        table = generics.get_object_or_404(Table, pk=pk)
        seat = services.cancel_seat(table=table, user=request.user)
        return Response(SeatReservationSerializer(seat).data)
