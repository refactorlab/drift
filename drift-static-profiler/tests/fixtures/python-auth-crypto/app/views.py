import bcrypt
import requests
from cryptography.hazmat.primitives.asymmetric import rsa


def rotate_passwords(passwords):
    """AC-BCRYPT-001: bcrypt.hashpw in loop."""
    out = []
    for pw in passwords:
        out.append(bcrypt.hashpw(pw.encode(), bcrypt.gensalt()))
    return out


def fresh_keypair():
    """AC-RSA-002: RSA private-key generation (multi-second blocking op)."""
    return rsa.generate_private_key(public_exponent=65537, key_size=2048)


def verify_jwt(token):
    """AC-JWKS-003: JWKS fetched per request — no caching."""
    jwks = requests.get("https://auth.example.com/.well-known/jwks.json").json()
    return jwks  # imagine signature verification here
