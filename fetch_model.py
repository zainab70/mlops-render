"""Download the served model from a private Hugging Face model repo (DEPLOY-002, run by start.sh).

    python fetch_model.py <owner>/<repo> <folder>

Reads the read-only token from the HF_TOKEN environment variable (by name; never printed). Saves the
files train.py writes: model.pt and metadata.json are required, metrics.json and reference.json feed
/dashboard and /monitoring and are skipped with a note when the repo has none.

Only the Python standard library is used, so the image needs no extra package. The token is sent to
huggingface.co only: Hugging Face answers large files with a redirect to its file storage, and the
token is added as an "unredirected" header, so urllib does not forward it there.
"""

import os
import sys
import urllib.error
import urllib.request
from pathlib import Path

REQUIRED = ["model.pt", "metadata.json"]
OPTIONAL = ["metrics.json", "reference.json"]


def download(repo: str, name: str, folder: Path, token: str) -> bool:
    """Save <repo>/<name> into folder; False when the repo has no such file (HTTP 404)."""
    request = urllib.request.Request(f"https://huggingface.co/{repo}/resolve/main/{name}")
    request.add_unredirected_header("Authorization", f"Bearer {token}")
    partial = folder / f".{name}.part"
    try:
        with urllib.request.urlopen(request, timeout=60) as response, partial.open("wb") as out:
            while chunk := response.read(1 << 20):
                out.write(chunk)
    except urllib.error.HTTPError as error:
        partial.unlink(missing_ok=True)
        if error.code == 404:
            return False
        if error.code in (401, 403):
            sys.exit(f"fetch_model: HTTP {error.code} for {name}: check HF_TOKEN and that it can read {repo}")
        raise
    # Rename only a complete file, so a half download is never loaded as the model.
    partial.replace(folder / name)
    return True


def main() -> None:
    if len(sys.argv) != 3:
        sys.exit("usage: python fetch_model.py <owner>/<repo> <folder>")
    repo, folder = sys.argv[1], Path(sys.argv[2])
    token = os.environ.get("HF_TOKEN", "").strip()
    if not token:
        sys.exit("fetch_model: HF_TOKEN is not set")
    folder.mkdir(parents=True, exist_ok=True)

    for name in REQUIRED:
        if not download(repo, name, folder, token):
            sys.exit(f"fetch_model: {repo} has no {name}; upload the files from services/model/weights")
        print(f"fetch_model: {name} saved")
    for name in OPTIONAL:
        if download(repo, name, folder, token):
            print(f"fetch_model: {name} saved")
        else:
            print(f"fetch_model: {repo} has no {name}; the page that uses it shows its empty state")


if __name__ == "__main__":
    main()
