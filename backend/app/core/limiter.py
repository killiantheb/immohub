"""
Rate limiter — slowapi wrapper.
Import `limiter` and use @limiter.limit("N/minute") on routes.
"""
from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address, default_limits=["300/minute"])
