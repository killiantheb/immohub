"""Unit tests — InterventionService._can_access (PR-A11.A.0 AX-01).

Tests purs sans DB : on isole la logique de permission via des MagicMock.
Les tests d'intégration end-to-end (avec une vraie DB Supabase de test)
ne sont pas en place dans ce repo (pas de fixtures user/bien/intervention
en DB).
"""

from __future__ import annotations

import uuid
from unittest.mock import MagicMock

import pytest

from app.services.intervention_service import InterventionService


def _make_user(role: str = "proprio_solo") -> MagicMock:
    u = MagicMock()
    u.id = uuid.uuid4()
    u.role = role
    return u


def _make_bien(*, owner_id, agency_id=None, created_by_id=None) -> MagicMock:
    b = MagicMock()
    b.id = uuid.uuid4()
    b.owner_id = owner_id
    b.agency_id = agency_id
    b.created_by_id = created_by_id or owner_id
    return b


def _make_intervention(*, bien_id, artisan_id=None) -> MagicMock:
    i = MagicMock()
    i.id = uuid.uuid4()
    i.bien_id = bien_id
    i.artisan_id = artisan_id
    return i


class TestCanAccess:
    """Couvre les 4 cas spec PR-A11.A.0 §3.1 + super_admin + tiers absolu."""

    def test_super_admin_can_do_anything(self):
        admin = _make_user("super_admin")
        bien = _make_bien(owner_id=uuid.uuid4())
        inter = _make_intervention(bien_id=bien.id)

        for mode in ("read", "write", "delete"):
            assert InterventionService._can_access(
                inter, bien, admin, mode, is_active_tenant=False
            ) is True, f"super_admin must access mode={mode}"

    def test_third_party_cannot_read(self):
        """Un user non-proprio, non-agence, non-artisan, non-locataire est
        bloqué dès la lecture (anti-énumération via 404 côté router)."""
        owner = _make_user("proprio_solo")
        outsider = _make_user("proprio_solo")
        bien = _make_bien(owner_id=owner.id)
        inter = _make_intervention(bien_id=bien.id)

        for mode in ("read", "write", "delete"):
            assert InterventionService._can_access(
                inter, bien, outsider, mode, is_active_tenant=False
            ) is False, f"third party must NOT access mode={mode}"

    def test_owner_can_read_write_and_delete(self):
        owner = _make_user("proprio_solo")
        bien = _make_bien(owner_id=owner.id)
        inter = _make_intervention(bien_id=bien.id)

        for mode in ("read", "write", "delete"):
            assert InterventionService._can_access(
                inter, bien, owner, mode, is_active_tenant=False
            ) is True, f"owner must access mode={mode}"

    def test_agency_user_can_read_write_and_delete(self):
        agency_user = _make_user("agence")
        bien = _make_bien(
            owner_id=uuid.uuid4(),
            agency_id=agency_user.id,
        )
        inter = _make_intervention(bien_id=bien.id)

        for mode in ("read", "write", "delete"):
            assert InterventionService._can_access(
                inter, bien, agency_user, mode, is_active_tenant=False
            ) is True

    def test_active_tenant_can_read_only(self):
        owner = _make_user("proprio_solo")
        tenant = _make_user("locataire")
        bien = _make_bien(owner_id=owner.id)
        inter = _make_intervention(bien_id=bien.id)

        # Read OK
        assert InterventionService._can_access(
            inter, bien, tenant, "read", is_active_tenant=True
        ) is True

        # Write / delete refusés
        assert InterventionService._can_access(
            inter, bien, tenant, "write", is_active_tenant=True
        ) is False
        assert InterventionService._can_access(
            inter, bien, tenant, "delete", is_active_tenant=True
        ) is False

    def test_inactive_tenant_cannot_read(self):
        """Un ex-locataire (statut=sorti, donc is_active_tenant=False) n'a
        plus aucun droit d'accès."""
        owner = _make_user("proprio_solo")
        ex_tenant = _make_user("locataire")
        bien = _make_bien(owner_id=owner.id)
        inter = _make_intervention(bien_id=bien.id)

        assert InterventionService._can_access(
            inter, bien, ex_tenant, "read", is_active_tenant=False
        ) is False

    def test_assigned_artisan_can_read_and_write_but_not_delete(self):
        owner = _make_user("proprio_solo")
        artisan = _make_user("artisan")
        bien = _make_bien(owner_id=owner.id)
        inter = _make_intervention(bien_id=bien.id, artisan_id=artisan.id)

        assert InterventionService._can_access(
            inter, bien, artisan, "read", is_active_tenant=False
        ) is True
        assert InterventionService._can_access(
            inter, bien, artisan, "write", is_active_tenant=False
        ) is True
        assert InterventionService._can_access(
            inter, bien, artisan, "delete", is_active_tenant=False
        ) is False, "artisan must NOT delete"

    def test_unassigned_artisan_cannot_access(self):
        """Un artisan qui n'est PAS assigné à l'intervention n'a aucun droit
        (même rôle, mais pas le bon user_id)."""
        owner = _make_user("proprio_solo")
        artisan_assigned = _make_user("artisan")
        artisan_random = _make_user("artisan")
        bien = _make_bien(owner_id=owner.id)
        inter = _make_intervention(
            bien_id=bien.id, artisan_id=artisan_assigned.id
        )

        for mode in ("read", "write", "delete"):
            assert InterventionService._can_access(
                inter, bien, artisan_random, mode, is_active_tenant=False
            ) is False


class TestCanCreateOnBien:
    """Vérifie les autorisations à créer une intervention sur un bien."""

    def test_super_admin_can_create_anywhere(self):
        admin = _make_user("super_admin")
        bien = _make_bien(owner_id=uuid.uuid4())
        assert InterventionService._can_create_on_bien(
            bien, admin, is_active_tenant=False
        ) is True

    def test_owner_can_create(self):
        owner = _make_user("proprio_solo")
        bien = _make_bien(owner_id=owner.id)
        assert InterventionService._can_create_on_bien(
            bien, owner, is_active_tenant=False
        ) is True

    def test_active_tenant_can_signal(self):
        """Un locataire actif peut signaler une intervention sur son bien."""
        tenant = _make_user("locataire")
        bien = _make_bien(owner_id=uuid.uuid4())
        assert InterventionService._can_create_on_bien(
            bien, tenant, is_active_tenant=True
        ) is True

    def test_third_party_cannot_create(self):
        outsider = _make_user("proprio_solo")
        bien = _make_bien(owner_id=uuid.uuid4())
        assert InterventionService._can_create_on_bien(
            bien, outsider, is_active_tenant=False
        ) is False
