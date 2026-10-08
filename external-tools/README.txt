External tools

Tracked files: tools.json, install.ps1, this guide and .gitignore.
Local files: downloaded archives, extracted programs and ffmpeg/current.json.

From the workbench root, run:
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\deploy.ps1 -Mode Tools
The Tools mode installs only external tools. It does not rebuild or reconfigure the workbench.

Normal Deploy also runs this installer. Desktop/Web startup does not download tools.
Existing versions are reused. The pinned archive checksum is checked when installing.
No system PATH changes, model credentials or global installation are needed.
Resolve program paths relative to external-tools/ffmpeg/current.json and its parent folder.

Source: https://ffmpeg.org/download.html
Windows build provider: https://www.gyan.dev/ffmpeg/builds/
Keep the upstream license and README alongside the installed programs.
To add another external tool, extend the trusted repository manifest and update ignore rules.
This installer supports zip archives with one versioned top-level directory.
