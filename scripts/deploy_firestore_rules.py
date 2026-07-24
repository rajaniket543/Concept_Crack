#!/usr/bin/env python3
"""One-time: deploy the repo's firestore.rules to the live Firebase project.

The live project has been running on Firebase's default 30-day test-mode
rule (allow read, write: if request.time < <expiry>) since the database was
created — the repo's real firestore.rules was apparently never deployed.
That means today: zero real access control on any collection, and on the
expiry date: a total outage (every read/write denied for every user).

This creates a new Ruleset from the local firestore.rules file and points
the live `cloud.firestore` release at it.
"""
import json
import sys
from pathlib import Path

from google.oauth2 import service_account
import google.auth.transport.requests
import urllib.request

# Project follows the service-account key — the key carries its own project_id,
# so dropping in a different key targets a different Firebase project with no
# edit here. Impossible to deploy to the wrong project by mistake.
with open("service-account.json") as _f:
    PROJECT_ID = json.load(_f)["project_id"]
RULES_FILE = Path(__file__).parent.parent / "firestore.rules"

creds = service_account.Credentials.from_service_account_file(
    "service-account.json",
    scopes=["https://www.googleapis.com/auth/cloud-platform"],
)
creds.refresh(google.auth.transport.requests.Request())
token = creds.token
headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}


def api(method, url, body=None):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(url, data=data, headers=headers, method=method)
    try:
        resp = urllib.request.urlopen(req, timeout=30)
        return json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        print(f"HTTP {e.code} error:", e.read().decode(), file=sys.stderr)
        raise


rules_content = RULES_FILE.read_text(encoding="utf-8")
print(f"Read {len(rules_content)} chars from {RULES_FILE}")

# 1. Create a new ruleset (this also validates/compiles the rules — a syntax
#    error here fails loudly instead of silently deploying something broken).
print("Creating ruleset...")
ruleset = api(
    "POST",
    f"https://firebaserules.googleapis.com/v1/projects/{PROJECT_ID}/rulesets",
    {"source": {"files": [{"name": "firestore.rules", "content": rules_content}]}},
)
ruleset_name = ruleset["name"]
print("Created:", ruleset_name)

# 2. Point the live cloud.firestore release at the new ruleset.
print("Updating release...")
release = api(
    "PATCH",
    f"https://firebaserules.googleapis.com/v1/projects/{PROJECT_ID}/releases/cloud.firestore?updateMask=rulesetName",
    {"release": {"name": f"projects/{PROJECT_ID}/releases/cloud.firestore", "rulesetName": ruleset_name}},
)
print("Release now points at:", release["rulesetName"])
print("Done. The repo's real firestore.rules is now live.")
