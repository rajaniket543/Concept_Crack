#!/usr/bin/env python3
"""One-time: deploy the repo's storage.rules to the live Firebase project.

Adds the chatAttachments/{threadId}/{fileName} rule block (thread-participant-only
read/write) on top of the existing question-images rules. Same pattern as
deploy_firestore_rules.py — creates a new Ruleset from the local file and
points the live firebase.storage release at it.
"""
import json
import os
import sys
from pathlib import Path

from google.oauth2 import service_account
import google.auth.transport.requests
import urllib.request

# Project follows the service-account key (see deploy_firestore_rules.py). The
# bucket defaults to the new-project convention <project>.firebasestorage.app;
# override with FIREBASE_STORAGE_BUCKET for an older <project>.appspot.com bucket.
with open(str(Path(__file__).parent / "service-account.json")) as _f:
    PROJECT_ID = json.load(_f)["project_id"]
BUCKET = os.environ.get("FIREBASE_STORAGE_BUCKET", f"{PROJECT_ID}.firebasestorage.app")
RULES_FILE = Path(__file__).parent.parent / "storage.rules"

creds = service_account.Credentials.from_service_account_file(
    str(Path(__file__).parent / "service-account.json"),
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

print("Creating ruleset...")
ruleset = api(
    "POST",
    f"https://firebaserules.googleapis.com/v1/projects/{PROJECT_ID}/rulesets",
    {"source": {"files": [{"name": "storage.rules", "content": rules_content}]}},
)
ruleset_name = ruleset["name"]
print("Created:", ruleset_name)

release_id = f"firebase.storage/{BUCKET}"
print(f"Updating release {release_id}...")
release = api(
    "PATCH",
    f"https://firebaserules.googleapis.com/v1/projects/{PROJECT_ID}/releases/{release_id}?updateMask=rulesetName",
    {"release": {"name": f"projects/{PROJECT_ID}/releases/{release_id}", "rulesetName": ruleset_name}},
)
print("Release now points at:", release["rulesetName"])
print("Done. The repo's real storage.rules (with chatAttachments) is now live.")
