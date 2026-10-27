import base64
import hashlib
import importlib.util
import io
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
import wave

sys.dont_write_bytecode = True
ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("bundle_music", ROOT / "android/bundle_music.py")
bundle = importlib.util.module_from_spec(spec)
spec.loader.exec_module(bundle)


class BundleMusicTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.directory = Path(self.temp.name) / "soundtrack"
        self.directory.mkdir()
        stream = io.BytesIO()
        with wave.open(stream, "wb") as wav:
            wav.setparams((1, 2, 8000, 0, "NONE", "not compressed"))
            wav.writeframes(b"\x00\x00\x01\x00" * 400)
        self.recording = stream.getvalue()
        self.manifest = {}
        for key in bundle.KEYS:
            (self.directory / (key + ".wav")).write_bytes(self.recording)
            self.manifest[key] = {"file": key + ".wav", "name": "Fixture " + key, "mimeType": "audio/wav"}
        self.save()

    def save(self):
        (self.directory / "manifest.json").write_text(json.dumps(self.manifest))

    def test_complete_bundle_preserves_all_bytes_and_hashes(self):
        output = Path(self.temp.name) / "generated.js"
        bundle.write_bundle(self.directory, output)
        source = output.read_text()
        data = json.loads(source[len(bundle.PREFIX):].strip().removesuffix(";"))
        self.assertEqual(set(data), set(bundle.KEYS))
        for value in data.values():
            self.assertEqual(base64.b64decode(value["base64"]), self.recording)
            self.assertEqual(value["sha256"], hashlib.sha256(self.recording).hexdigest())

    def test_missing_manifest_slot_and_empty_file_fail(self):
        manifest = self.directory / "manifest.json"
        manifest.unlink()
        with self.assertRaisesRegex(ValueError, "Missing soundtrack"):
            bundle.make_bundle(self.directory)
        self.manifest.pop("baseBoss")
        self.save()
        with self.assertRaisesRegex(ValueError, "exactly"):
            bundle.make_bundle(self.directory)
        self.manifest["baseBoss"] = {"file": "absent.wav", "name": "boss", "mimeType": "audio/wav"}
        self.save()
        with self.assertRaisesRegex(ValueError, "missing audio"):
            bundle.make_bundle(self.directory)
        (self.directory / "absent.wav").touch()
        with self.assertRaisesRegex(ValueError, "nonempty"):
            bundle.make_bundle(self.directory)

    def test_paths_and_symlinks_cannot_escape_source_directory(self):
        outside = Path(self.temp.name) / "outside.wav"
        outside.write_bytes(self.recording)
        for name in ("../outside.wav", str(outside.resolve()), "linked.wav"):
            with self.subTest(path=name):
                if name == "linked.wav":
                    (self.directory / name).symlink_to(outside)
                self.manifest["jungle"]["file"] = name
                self.save()
                with self.assertRaisesRegex(ValueError, "inside soundtrack"):
                    bundle.make_bundle(self.directory)

    def test_container_and_size_are_checked_before_encoding(self):
        (self.directory / "jungle.wav").write_bytes(b"a text file")
        with self.assertRaisesRegex(ValueError, "mismatched audio"):
            bundle.make_bundle(self.directory)
        with (self.directory / "jungle.wav").open("wb") as stream:
            stream.truncate(bundle.MAX_BYTES + 1)
        with self.assertRaisesRegex(ValueError, "20 MB"):
            bundle.make_bundle(self.directory)

    def test_failed_validation_keeps_previous_output(self):
        output = Path(self.temp.name) / "generated.js"
        output.write_text("previous output")
        (self.directory / "jungle.wav").unlink()
        with self.assertRaises(ValueError):
            bundle.write_bundle(self.directory, output)
        self.assertEqual(output.read_text(), "previous output")

    def test_release_build_stops_before_changing_existing_apks(self):
        apks = [ROOT / "dist" / name for name in ("JungleAssault.apk", "JungleAssault-Level1.apk")]
        hashes = [hashlib.sha256(p.read_bytes()).hexdigest() if p.exists() else None for p in apks]
        (self.directory / "jungle.wav").unlink()
        environment = dict(os.environ, JUNGLE_SOUNDTRACK_DIR=str(self.directory))
        result = subprocess.run(["bash", str(ROOT / "android/build.sh")], env=environment,
                                capture_output=True, text=True, timeout=15)
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("missing audio", result.stderr)
        self.assertEqual(hashes, [hashlib.sha256(p.read_bytes()).hexdigest() if p.exists() else None for p in apks])


if __name__ == "__main__":
    unittest.main()
