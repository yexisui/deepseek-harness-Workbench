"""Select only verified executable releases referenced by the shared capability state.

Release assets are programs, not the rest of dsh-data. Never copy a data home.
"""
import hashlib
import json
import re
from pathlib import Path


def digest(file):
    with file.open('rb') as stream:
        return hashlib.file_digest(stream, 'sha256').hexdigest()


def release_files(state_file, releases_root):
    state_file, releases_root = Path(state_file), Path(releases_root)
    if not state_file.exists():
        return []
    state = json.loads(state_file.read_text('utf-8-sig'))
    hashes = sorted({v['packageHash'] for c in state.get('capabilities', [])
                     for v in c.get('versions', []) if v.get('packageHash')})
    selected = []
    for hash_value in hashes:
        if not re.fullmatch('[a-f0-9]{64}', hash_value):
            raise ValueError('Invalid capability release hash')
        release = state.get('packageReleases', {}).get(hash_value, {})
        expected = release.get('manifest')
        folder = releases_root / hash_value
        if not folder.is_dir():
            raise ValueError(f'Missing capability release {hash_value}; supply --capability-releases with verified release assets')
        files = {}

        def visit(directory):
            if directory.is_symlink() or directory.is_junction():
                raise ValueError('Linked capability release path')
            for entry in directory.iterdir():
                if entry.is_symlink() or entry.is_junction():
                    raise ValueError('Linked capability release file')
                if entry.is_dir():
                    visit(entry)
                elif entry.is_file():
                    files[entry.relative_to(folder).as_posix()] = entry
                else:
                    raise ValueError('Capability release must contain ordinary files')

        visit(folder)
        if len(files) > 501 or sum(f.stat().st_size for f in files.values()) > 64 * 1024 * 1024:
            raise ValueError('Capability release exceeds package limits')
        manifest_file = files.get('capability.json')
        if manifest_file is None or manifest_file.stat().st_size > 256 * 1024:
            raise ValueError('Missing or oversized capability.json')
        manifest = json.loads(manifest_file.read_text('utf-8-sig'))
        canonical = json.dumps(manifest, ensure_ascii=False, sort_keys=True, separators=(',', ':')).encode('utf-8')
        if manifest != expected or hashlib.sha256(canonical).hexdigest() != hash_value:
            raise ValueError('Capability manifest does not match shared release identity')
        declared = manifest.get('files', {})
        if set(files) != {'capability.json', *declared}:
            raise ValueError('Capability release includes missing or undeclared files')
        for name, checksum in declared.items():
            parts = name.split('/')
            if (parts[0] not in {'runtime', 'resources', 'docs'} or len(parts) < 2
                    or any(p in {'', '.', '..'} or ':' in p or '\\' in p for p in parts)
                    or any(re.fullmatch(r'(?i)(\.env(?:\..*)?|.*credentials.*|ai_key\.txt|settings\.ya?ml|state\.json)', p) for p in parts)):
                raise ValueError('Private or unsupported capability release path')
            if digest(files[name]) != checksum:
                raise ValueError(f'Capability file checksum mismatch: {hash_value}/{name}')
        for name, file in sorted(files.items()):
            selected.append((file, f'dsh-data/capabilities/packages/releases/{hash_value}/{name}'))
    return selected
