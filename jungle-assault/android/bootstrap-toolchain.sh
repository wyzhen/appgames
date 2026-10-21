#!/usr/bin/env bash
set -euo pipefail
ANDROID_PROJECT="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$ANDROID_PROJECT/.." && pwd)"
TOOLCHAIN="${JUNGLE_TOOLCHAIN:-$PROJECT_ROOT/.toolchain}"
mkdir -p "$TOOLCHAIN"
fetch() {
    local target="$1" url="$2" checksum="$3" algorithm="$4"
    if [ ! -f "$target" ]; then curl -fL --retry 2 "$url" -o "$target"; fi
    printf '%s  %s\n' "$checksum" "$target" | "${algorithm}sum" -c -
}
fetch "$TOOLCHAIN/build-tools.zip" \
    'https://dl.google.com/android/repository/build-tools_r35_linux.zip' \
    '2cfaa0bbb2336e9ec18ed3ecea84fa2e2af607bc' sha1
fetch "$TOOLCHAIN/platform.zip" \
    'https://dl.google.com/android/repository/platform-35_r02.zip' \
    '0bb560a90a7a2cbd0dd8348224d518b638fe7949' sha1
fetch "$TOOLCHAIN/ecj.jar" \
    'https://repo.maven.apache.org/maven2/org/eclipse/jdt/ecj/3.39.0/ecj-3.39.0.jar' \
    '01f5a92ac19bb2b3bf85e295a68f2c73c264369109158b566ce9b490af982948' sha256
unzip -oq "$TOOLCHAIN/build-tools.zip" -d "$TOOLCHAIN"
unzip -oq "$TOOLCHAIN/platform.zip" -d "$TOOLCHAIN"
echo "Toolchain ready: $TOOLCHAIN"
