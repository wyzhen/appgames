#!/usr/bin/env python3
"""Embed supplied soundtrack files without requiring file:// fetch or network access."""
import argparse
import base64
import hashlib
import json
import os
from pathlib import Path
import sys
import tempfile

KEYS = ("jungle", "base", "baseBoss")
MAX_BYTES = 20 * 1024 * 1024
PREFIX = "window.BUNDLED_SOUNDTRACK = "


def make_bundle(directory):
    root = Path(directory).resolve()
    manifest = root / "manifest.json"
    if not manifest.is_file():
        raise ValueError("Missing soundtrack/manifest.json and source recordings; no release APK was generated.")
    config = json.loads(manifest.read_text(encoding="utf-8"))
    if not isinstance(config, dict) or set(config) != set(KEYS):
        raise ValueError("Soundtrack manifest must contain exactly jungle, base and baseBoss.")
    result = {}
    for key in KEYS:
        entry = config[key]
        if not isinstance(entry, dict):
            raise ValueError(f"{key}: invalid manifest entry")
        filename, name, mime = (entry.get(k) for k in ("file", "name", "mimeType"))
        if not all(isinstance(v, str) and v.strip() for v in (filename, name, mime)):
            raise ValueError(f"{key}: file, name and mimeType are required")
        path = (root / filename).resolve()
        if Path(filename).is_absolute() or not path.is_relative_to(root):
            raise ValueError(f"{key}: audio path must stay inside soundtrack/")
        if not path.is_file():
            raise ValueError(f"{key}: missing audio file {filename}")
        if not 0 < path.stat().st_size <= MAX_BYTES:
            raise ValueError(f"{key}: audio must be nonempty and no larger than 20 MB")
        data = path.read_bytes()
        if not 0 < len(data) <= MAX_BYTES:
            raise ValueError(f"{key}: audio size changed while reading")
        signatures = {
            "audio/mpeg": data.startswith(b"ID3") or data[:1] == b"\xff",
            "audio/wav": data.startswith(b"RIFF") and data[8:12] == b"WAVE",
            "audio/x-wav": data.startswith(b"RIFF") and data[8:12] == b"WAVE",
            "audio/ogg": data.startswith(b"OggS"),
            "audio/flac": data.startswith(b"fLaC"),
            "audio/mp4": data[4:8] == b"ftyp",
            "audio/aac": data[:1] == b"\xff",
        }
        if not signatures.get(mime, False):
            raise ValueError(f"{key}: unsupported or mismatched audio container {mime}")
        result[key] = {"name": name.strip(), "mimeType": mime,
                       "base64": base64.b64encode(data).decode("ascii"),
                       "sha256": hashlib.sha256(data).hexdigest()}
    return result


def write_bundle(directory, output):
    bundle = make_bundle(directory)
    target = Path(output)
    target.parent.mkdir(parents=True, exist_ok=True)
    encoded = PREFIX + json.dumps(bundle, ensure_ascii=True, separators=(",", ":")) + ";\n"
    temporary = None
    try:
        with tempfile.NamedTemporaryFile(mode="w", encoding="utf-8", dir=target.parent,
                                         prefix=".soundtrack-", delete=False) as stream:
            temporary = stream.name
            stream.write(encoded)
        os.replace(temporary, target)
    finally:
        if temporary and os.path.exists(temporary):
            os.unlink(temporary)
    return bundle


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source-dir", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    try:
        bundle = write_bundle(args.source_dir, args.output)
    except (ValueError, OSError) as error:
        parser.exit(2, f"Soundtrack packaging stopped: {error}\n")
    print(f"Embedded {len(bundle)} supplied recordings.")


if __name__ == "__main__":
    main()
