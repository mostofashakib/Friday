import os

SUPABASE_URL = os.getenv("SUPABASE_URL", "")
USE_LOCAL_DB = not SUPABASE_URL or "your-project" in SUPABASE_URL

_client = None


def get_client():
    global _client
    if _client is None:
        from supabase import create_client
        key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
        _client = create_client(SUPABASE_URL, key)
    return _client
