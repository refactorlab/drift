from sqlalchemy import text, select
from sqlalchemy.orm import joinedload
from .models import User, Post


def lookup_by_id_unsafe(session, who):
    """SA-EXEC-009: f-string inside text() — SQL injection."""
    return session.execute(text(f"SELECT * FROM users WHERE name = '{who}'"))


def yield_per_with_joinedload(session):
    """SA-N1-003: yield_per + joinedload is silently incompatible."""
    stmt = select(User).options(joinedload(User.posts)).yield_per(100)
    return list(session.scalars(stmt))


def batch_create(session, names):
    """SA-SESS-007: session.add inside loop — autoflush per row."""
    for name in names:
        session.add(User(name=name))
    session.commit()


def clean_query(session):
    """Negative: parameterised query — no findings expected."""
    return session.execute(text("SELECT * FROM users WHERE id = :uid").bindparams(uid=1))


def n_plus_one_unprefetched(session):
    """SA-N1-001: iterate User rows and access .posts without joinedload —
    classic N+1. The LoopScope path traces `user` → stmt (SaSelect with
    empty prefetched tree) → fires."""
    stmt = select(User)
    users = session.scalars(stmt).all()
    titles = []
    for user in users:
        titles.append(user.posts.count())
    return titles


def n_plus_one_safe_with_joinedload(session):
    """Negative for SA-N1-001: posts is eagerly loaded — must not fire."""
    stmt = select(User).options(joinedload(User.posts))
    users = session.scalars(stmt).all()
    titles = []
    for user in users:
        titles.append(user.posts.count())
    return titles
