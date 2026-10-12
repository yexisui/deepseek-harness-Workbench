import hashlib
import json
import tempfile
import unittest
from pathlib import Path
from capability_releases import release_files


class ReleaseTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.assets = self.root / 'assets'
        self.state_file = self.root / 'state.json'
        self.manifest = {'schema': 1, 'name': '测试能力', 'files': {
            'runtime/main.cjs': hashlib.sha256(b'exports.execute=()=>42').hexdigest()}}
        self.hash = hashlib.sha256(json.dumps(self.manifest, ensure_ascii=False, sort_keys=True,
                                              separators=(',', ':')).encode()).hexdigest()
        self.folder = self.assets / self.hash
        (self.folder / 'runtime').mkdir(parents=True)
        (self.folder / 'runtime/main.cjs').write_bytes(b'exports.execute=()=>42')
        (self.folder / 'capability.json').write_text(json.dumps(self.manifest), encoding='utf-8')
        self.state = {'capabilities': [{'versions': [{'packageHash': self.hash}]}],
                      'packageReleases': {self.hash: {'manifest': self.manifest}}}
        self.state_file.write_text(json.dumps(self.state), encoding='utf-8')

    def test_collects_only_referenced_programs(self):
        (self.assets / 'private-session.txt').write_text('excluded')
        (self.assets / 'unreferenced').mkdir()
        selected = release_files(self.state_file, self.assets)
        self.assertEqual(len(selected), 2)
        self.assertTrue(all('/releases/' + self.hash + '/' in name for _, name in selected))

    def test_fails_when_shared_definition_has_no_programs(self):
        with self.assertRaisesRegex(ValueError, 'Missing capability release'):
            release_files(self.state_file, self.root / 'empty')

    def test_rejects_damaged_program(self):
        (self.folder / 'runtime/main.cjs').write_text('damaged')
        with self.assertRaisesRegex(ValueError, 'checksum mismatch'):
            release_files(self.state_file, self.assets)

    def test_rejects_extra_private_file(self):
        (self.folder / 'credentials.yaml').write_text('do not publish')
        with self.assertRaisesRegex(ValueError, 'undeclared'):
            release_files(self.state_file, self.assets)

    def test_rejects_changed_identity(self):
        self.manifest['name'] = 'changed'
        (self.folder / 'capability.json').write_text(json.dumps(self.manifest), encoding='utf-8')
        with self.assertRaisesRegex(ValueError, 'identity'):
            release_files(self.state_file, self.assets)

    def test_keeps_historical_releases_and_deduplicates_references(self):
        self.state['capabilities'][0]['versions'].append({'version': 2, 'packageHash': self.hash})
        self.state['capabilities'].append({'removedAt': '2026-10-12', 'versions': [{'packageHash': self.hash}]})
        self.state_file.write_text(json.dumps(self.state), encoding='utf-8')
        self.assertEqual(len(release_files(self.state_file, self.assets)), 2)


if __name__ == '__main__':
    unittest.main()
