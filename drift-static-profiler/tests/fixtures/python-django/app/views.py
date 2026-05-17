from django.http import HttpResponse
from .models import User, Post


def show_users(request):
    """Canonical N+1: iterate qs + access .posts inside loop.
    Should fire DJ-N1-001 (qs iter without prefetch) and SQLIR-N+1 family."""
    qs = User.objects.filter(active=True)
    parts = []
    for user in qs:
        parts.append(f"{user.name}: {user.posts.count()}")
    return HttpResponse("\n".join(parts))


def create_users(request):
    """Manager.create() in loop — DJ-PERF-007 (bulk_create candidate)."""
    for i in range(10):
        User.objects.create(name=f"u{i}", email=f"u{i}@example.com")
    return HttpResponse("ok")


def len_check(request):
    """len(qs) — DJ-N1-003 (use .count() instead)."""
    qs = User.objects.filter(active=True)
    n = len(qs)
    return HttpResponse(str(n))


def count_for_exists(request):
    """qs.count() used as existence — DJ-N1-004 (use .exists())."""
    qs = User.objects.filter(active=True)
    n = qs.count()
    return HttpResponse(str(n))


def raw_with_fstring(request, who):
    """SQLi: f-string inside .raw() — DJ-RAW-011."""
    rows = list(User.objects.raw(f"SELECT * FROM app_user WHERE name = '{who}'"))
    return HttpResponse(str(len(rows)))


def clean_handler(request):
    """Negative: prefetch_related present, no findings expected."""
    qs = User.objects.filter(active=True).prefetch_related("posts")
    parts = []
    for user in qs:
        parts.append(f"{user.name}: {user.posts.count()}")
    return HttpResponse("\n".join(parts))


def cartesian_values(request):
    """DJ-PROJ-010: `.values('groups')` over an m2m relation produces
    a cartesian-shaped result. Only fires with cross-file ModelGraph
    (Phase 5) — the matcher consults the workspace registry to confirm
    `groups` is a *-to-many on `User`."""
    return HttpResponse(str(list(User.objects.values("groups"))))
