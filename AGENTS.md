# Repository Guidance

- Update the release version for every product behavior, UI, bugfix, or build/deployment change.
- Use `.\set-version.ps1 <major.minor.patch>` so `VERSION`, root package metadata, and frontend package metadata stay in sync.
- Stage the version files in the same commit as the change that requires the bump.
