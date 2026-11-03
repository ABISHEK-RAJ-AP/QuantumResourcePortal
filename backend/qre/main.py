"""ASGI entry point.

Run in development from the ``backend/`` directory::

    uvicorn qre.main:app --reload --port 8000
"""

from qre.gateway.app import create_app

app = create_app()
