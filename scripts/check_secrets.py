#!/usr/bin/env python3
"""Check candidate Git files without printing credential values or reading .env files."""
import pathlib
import re
import subprocess
import sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
PATTERNS = {
    'private key': re.compile(r'-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----'),
    'server API key': re.compile(r'\b(?:sk-proj-|sk-ant-|sk_live_)[A-Za-z0-9_-]{16,}'),
    'Google API key': re.compile(r'\bAIza[A-Za-z0-9_-]{30,}'),
    'private Mapbox token': re.compile(r'\bsk\.ey[A-Za-z0-9_.-]{25,}'),
    'credential URL': re.compile(r'(?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?)://[^\s:/]+:[^\s@]+@'),
    'literal database password': re.compile(r'''(?:password\s*[:=]\s*|DB_PASSWORD\s*\|\|\s*)["']([^"']+)["']''', re.I),
    'password fallback': re.compile(r'''(?:getenv|environ\.get)\(["']DB_PASSWORD["']\s*,\s*["']([^"']+)["']'''),
    'shell credential': re.compile(r'''(?:PGPASSWORD|DB_PASSWORD|GOOGLE_PLACES_API_KEY|OPENAI_API_KEY|JWT_SECRET)=["']?([A-Za-z0-9_!.-]{8,})'''),
}

def main():
    paths = subprocess.check_output(
        ['git', 'ls-files', '-z', '--cached', '--others', '--exclude-standard'], cwd=ROOT
    ).decode().split('\0')
    findings = []
    for relative in sorted(set(paths)):
        path = ROOT / relative
        if not relative or not path.is_file() or path.suffix not in {'.js', '.jsx', '.ts', '.tsx', '.py', '.sh', '.md', '.json', '.yaml', '.yml', '.sql'}:
            continue
        if relative == 'scripts/check_secrets.py' or '/__tests__/' in relative or '.test.' in relative:
            continue
        for number, line in enumerate(path.read_text(errors='replace').splitlines(), 1):
            for kind, pattern in PATTERNS.items():
                for match in pattern.finditer(line):
                    candidate = match.group(1) if match.lastindex else match.group(0)
                    if candidate.startswith(('$', 'process.env.', 'os.environ')):
                        continue
                    if any(marker in candidate.lower() for marker in ['placeholder', 'your_', 'your-', 'example', 'change-me']):
                        continue
                    findings.append((relative, number, kind))
    for relative, number, kind in findings:
        print(f'{relative}:{number}: {kind} (value withheld)')
    print(f'Secret scan: {len(findings)} finding(s); ignored environment files and historical commits are not scanned.')
    return 1 if findings else 0

if __name__ == '__main__':
    sys.exit(main())
