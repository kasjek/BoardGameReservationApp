from django.db.models import CharField
from django.db.models.functions import Cast
from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.bgg.services import GAME_TYPE_IDS

from . import services
from .models import SeatStatus, Table
from .serializers import SeatReservationSerializer, TableCreateSerializer, TableSerializer
from .services import JOINABLE_FILTER_STATUSES, STATUS_QUERY_ALIASES


class TableListCreateView(generics.ListCreateAPIView):
    def get_permissions(self):
        if self.request.method in permissions.SAFE_METHODS:
            return [permissions.AllowAny()]
        return [permissions.IsAuthenticated()]

    def get_serializer_class(self):
        return TableCreateSerializer if self.request.method == "POST" else TableSerializer

    def get_queryset(self):
        from rest_framework.exceptions import PermissionDenied

        user = self.request.user
        params = self.request.query_params
        qs = Table.objects.all().order_by("starts_at")

        # Role scoping: a VENUE_USER may only see tables at their own venue
        # (docs/Permissions.md). USER/anonymous may browse platform-wide; ADMIN unrestricted.
        is_admin = user.is_authenticated and getattr(user, "role", None) == "ADMIN"
        if user.is_authenticated and getattr(user, "role", None) == "VENUE_USER":
            qs = qs.filter(venue_id=user.venue_id)

        if venue_id := params.get("venueId"):
            qs = qs.filter(venue_id=venue_id)
        if status_ := params.get("status"):
            if status_ == "available":
                # Tables a user can still join (browse default).
                qs = qs.filter(status__in=JOINABLE_FILTER_STATUSES)
            elif status_ in STATUS_QUERY_ALIASES:
                qs = qs.filter(status__in=STATUS_QUERY_ALIASES[status_])
            else:
                qs = qs.filter(status=status_)
        if game := params.get("game"):
            qs = qs.filter(game_title__icontains=game)
        type_ = (params.get("type") or "").strip().lower()
        if type_ in GAME_TYPE_IDS:
            qs = qs.annotate(_game_types_txt=Cast("game_types", CharField())).filter(
                _game_types_txt__icontains=f'"{type_}"'
            )

        # Personal filters expose another user's bookings — restrict to self (or ADMIN).
        def owns(requested: str) -> bool:
            return user.is_authenticated and (is_admin or str(user.id) == requested)

        if organizer_id := params.get("organizerId"):
            if not owns(organizer_id):
                raise PermissionDenied("You may only query your own tables.")
            qs = qs.filter(organizer_id=organizer_id)
        if attendee_id := params.get("attendeeId"):
            if not owns(attendee_id):
                raise PermissionDenied("You may only query your own bookings.")
            qs = qs.filter(
                seats__user_id=attendee_id,
                seats__status__in=("reserved", "waitlisted"),
            ).distinct()
        return qs

    def create(self, request, *args, **kwargs):
        serializer = TableCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        payload = dict(serializer.validated_data)
        bgg_id = payload.pop("bgg_id", None)
        table = services.create_table(organizer=request.user, bgg_id=bgg_id, **payload)
        return Response(TableSerializer(table).data, status=status.HTTP_201_CREATED)


class TableDetailView(generics.RetrieveAPIView):
    queryset = Table.objects.all()
    serializer_class = TableSerializer
    permission_classes = [permissions.AllowAny]

    def retrieve(self, request, *args, **kwargs):
        table = self.get_object()
        if not table.game_types:
            from apps.bgg.services import resolve_game_types

            types = resolve_game_types(table.game_title, live=True)
            if types:
                table.game_types = types
                table.save(update_fields=["game_types"])
        return Response(self.get_serializer(table).data)


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


class TableCancelView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        table = generics.get_object_or_404(Table, pk=pk)
        table = services.cancel_table(table=table, by_user=request.user)
        return Response(TableSerializer(table).data)


class SeatReserveView(APIView):
    # GET lists attendees (usernames) — all logged-in users may see it, but not
    # anonymous clients (privacy, NFR-1). POST (reserve) also requires auth.
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request, pk):
        table = generics.get_object_or_404(Table, pk=pk)
        seats = (
            table.seats.filter(status__in=(SeatStatus.RESERVED, SeatStatus.WAITLISTED))
            .select_related("user")
            .order_by("-is_organizer", "status", "waitlist_position", "created_at")
        )
        return Response(SeatReservationSerializer(seats, many=True).data)

    def post(self, request, pk):
        table = generics.get_object_or_404(Table, pk=pk)
        seat = services.reserve_seat(table=table, user=request.user)
        return Response(SeatReservationSerializer(seat).data, status=status.HTTP_201_CREATED)


class SeatPayView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        table = generics.get_object_or_404(Table, pk=pk)
        seat = services.pay_seat(table=table, user=request.user)
        return Response(SeatReservationSerializer(seat).data)


class SeatCancelView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request, pk):
        table = generics.get_object_or_404(Table, pk=pk)
        seat = services.cancel_seat(table=table, user=request.user)
        return Response(SeatReservationSerializer(seat).data)
