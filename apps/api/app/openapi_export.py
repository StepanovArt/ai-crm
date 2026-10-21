"""Print the OpenAPI schema as JSON (used by `make types`, no server needed)."""

import json
import sys

from app.main import app

if __name__ == "__main__":
    json.dump(app.openapi(), sys.stdout, indent=2)
    sys.stdout.write("\n")
