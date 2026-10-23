"""Reject incomplete donor metadata before creating a release directory."""
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest


class ProfileTemplateTests(unittest.TestCase):
    def test_missing_bundle_registration_fails_before_packaging(self):
        for profile in [
            {'dependencies': {'example': '1.0.0'}},
            {'dependencies': {'example': '1.0.0'}, 'dsh': {'profile': {'bundles': []}}},
            {'dependencies': {'example': '1.0.0'}, 'dsh': {'profile': {'bundles': ['']}}},
        ]:
            with self.subTest(profile=profile), tempfile.TemporaryDirectory(prefix='offline-template-') as temp:
                root = Path(temp)
                manifest = root / 'donor/dsh-data/profiles/web/package.json'
                manifest.parent.mkdir(parents=True)
                manifest.write_text(json.dumps(profile), encoding='utf-8')
                output = root / 'output'
                result = subprocess.run([
                    sys.executable, str(Path(__file__).with_name('build-offline.py')),
                    '--donor', str(root / 'donor'), '--source', str(root), '--output', str(output),
                ], capture_output=True, text=True)
                self.assertNotEqual(result.returncode, 0)
                self.assertIn('must include dsh.profile.bundles', result.stderr)
                self.assertFalse(output.exists())


if __name__ == '__main__':
    unittest.main()
