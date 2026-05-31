# Security Policy

## Supported versions

| Version | Supported |
|---------|-----------|
| 1.x     | Yes       |

## Reporting a vulnerability

Please report security issues privately via GitHub Security Advisories on this repository, or contact the maintainer through the website listed in the README.

Do not open public issues for undisclosed vulnerabilities.

## Scope

- Browser-side processing must not exfiltrate file contents without user action.
- Worker must delete ephemeral uploads within the documented retention window.
- Logs must not contain EXIF field values or file passwords.
