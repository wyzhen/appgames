#!/usr/bin/env bash
set -euo pipefail
ANDROID_PROJECT="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$ANDROID_PROJECT/.." && pwd)"
TOOLCHAIN="${JUNGLE_TOOLCHAIN:-$PROJECT_ROOT/.toolchain}"
BUILD_TOOLS="$TOOLCHAIN/android-15"
ANDROID_JAR="$TOOLCHAIN/android-35/android.jar"
BUILD_DIR="$ANDROID_PROJECT/build"
OUTPUT_DIR="$PROJECT_ROOT/dist"
APK="$OUTPUT_DIR/JungleAssault.apk"
LEGACY_APK="$OUTPUT_DIR/JungleAssault-Level1.apk"
for required in "$BUILD_TOOLS/aapt2" "$BUILD_TOOLS/zipalign" "$ANDROID_JAR" "$TOOLCHAIN/ecj.jar"; do
    if [ ! -f "$required" ]; then
        echo "Missing build dependency: $required" >&2
        exit 1
    fi
done
if [ ! -f "$PROJECT_ROOT/web/index.html" ]; then
    echo "Missing game entrypoint: $PROJECT_ROOT/web/index.html" >&2
    exit 1
fi
rm -rf "$BUILD_DIR"
mkdir -p "$BUILD_DIR/classes" "$BUILD_DIR/dex" "$BUILD_DIR/assets/game" "$OUTPUT_DIR"
cp -R "$PROJECT_ROOT/web/." "$BUILD_DIR/assets/game/"
"$BUILD_TOOLS/aapt2" compile --dir "$ANDROID_PROJECT/res" -o "$BUILD_DIR/resources.zip"
"$BUILD_TOOLS/aapt2" link -I "$ANDROID_JAR" \
    --manifest "$ANDROID_PROJECT/AndroidManifest.xml" \
    --min-sdk-version 26 --target-sdk-version 35 --auto-add-overlay \
    -A "$BUILD_DIR/assets" -R "$BUILD_DIR/resources.zip" \
    -o "$BUILD_DIR/unsigned.apk"
java -jar "$TOOLCHAIN/ecj.jar" -8 -nowarn -bootclasspath "$ANDROID_JAR" \
    -d "$BUILD_DIR/classes" "$ANDROID_PROJECT/src/com/arcade/jungleassault/MainActivity.java"
mapfile -t CLASS_FILES < <(find "$BUILD_DIR/classes" -name '*.class' -print | sort)
java -cp "$BUILD_TOOLS/lib/d8.jar" com.android.tools.r8.D8 \
    --lib "$ANDROID_JAR" --min-api 26 --output "$BUILD_DIR/dex" "${CLASS_FILES[@]}"
python3 - "$BUILD_DIR/unsigned.apk" "$BUILD_DIR/dex/classes.dex" <<'PY'
import sys, zipfile
with zipfile.ZipFile(sys.argv[1], 'a', compression=zipfile.ZIP_DEFLATED) as apk:
    apk.write(sys.argv[2], 'classes.dex')
PY
"$BUILD_TOOLS/zipalign" -p -f 4 "$BUILD_DIR/unsigned.apk" "$BUILD_DIR/aligned.apk"
if [ ! -f "$ANDROID_PROJECT/local-test.keystore" ]; then
    keytool -genkeypair -keystore "$ANDROID_PROJECT/local-test.keystore" \
        -storepass android -keypass android -alias androiddebugkey \
        -keyalg RSA -keysize 2048 -validity 10000 \
        -dname "CN=Jungle Assault Local Test, O=Offline Arcade, C=CN"
fi
java -jar "$BUILD_TOOLS/lib/apksigner.jar" sign \
    --ks "$ANDROID_PROJECT/local-test.keystore" --ks-pass pass:android \
    --key-pass pass:android --ks-key-alias androiddebugkey --out "$APK" \
    "$BUILD_DIR/aligned.apk"
java -jar "$BUILD_TOOLS/lib/apksigner.jar" verify --verbose "$APK"
"$BUILD_TOOLS/zipalign" -c -p 4 "$APK"
python3 - "$APK" "$PROJECT_ROOT/web" <<'PY'
from pathlib import Path
import sys, zipfile
web = Path(sys.argv[2])
with zipfile.ZipFile(sys.argv[1]) as apk:
    files = [p for p in web.rglob('*') if p.is_file()]
    for path in files:
        bundled = 'assets/game/' + path.relative_to(web).as_posix()
        assert apk.read(bundled) == path.read_bytes(), f'Stale or missing asset: {bundled}'
    assert 'classes.dex' in apk.namelist()
    print(f'Verified {len(files)} bundled game assets byte-for-byte.')
PY
"$BUILD_TOOLS/aapt" dump badging "$APK" | sed -n '1,12p'
(cd "$OUTPUT_DIR" && sha256sum JungleAssault.apk > JungleAssault.apk.sha256)
cp "$APK" "$LEGACY_APK"
cmp -s "$APK" "$LEGACY_APK"
(cd "$OUTPUT_DIR" && sha256sum JungleAssault-Level1.apk > JungleAssault-Level1.apk.sha256)
echo "Built: $APK"
echo "Compatibility copy: $LEGACY_APK"
