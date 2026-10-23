#!/usr/bin/env python3
"""Save running Docker credentials before upgrading. Never prints secrets."""
import json
import os
import pathlib
import subprocess
import sys

root = pathlib.Path(__file__).resolve().parents[2]
target = root / '.env'
if target.exists():
    sys.exit('Root .env already exists; keep it and verify its configuration manually.')

def environment(container):
    result = subprocess.run(['docker', 'inspect', container], check=True, capture_output=True, text=True)
    return dict(item.split('=', 1) for item in json.loads(result.stdout)[0]['Config']['Env'] if '=' in item)

backend = environment('backend')
mongo = environment('mongodb')
values = {key: backend.get(key, '') for key in ['JWT_SECRET', 'MASTER_PASSWORD', 'OPENAI_API_KEY', 'DASHSCOPE_API_KEY', 'MONGODB_URI', 'MODEL', 'ALLOWED_ORIGINS']}
values['MONGO_ROOT_PASSWORD'] = mongo.get('MONGO_INITDB_ROOT_PASSWORD', '')
if not all(values.get(key) for key in ['JWT_SECRET', 'MASTER_PASSWORD', 'MONGODB_URI', 'MONGO_ROOT_PASSWORD']):
    sys.exit('Required configuration missing; no file written. Keep the existing containers running.')

def quote(value):
    if any(c in value for c in ['\n', '\r', "'"]):
        raise ValueError('Configuration requires manual dotenv escaping; no file written.')
    return "'" + value + "'"

content = ''.join(key + '=' + quote(value) + '\n' for key, value in values.items())
fd = os.open(target, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
with os.fdopen(fd, 'w', encoding='utf-8') as stream:
    stream.write(content)
print('Saved existing container configuration to ignored root .env. No container or database was changed.')
