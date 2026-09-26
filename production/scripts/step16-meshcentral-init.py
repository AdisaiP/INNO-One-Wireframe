from pathlib import Path
import json
import subprocess
import sys

ROOT=Path(__file__).resolve().parents[1]
settings=json.loads((ROOT/'services/platform-api/src/INNO.One.PlatformApi/appsettings.Development.json').read_text())
mesh=settings['MeshCentral']
username=mesh['Username']
password=mesh['Password']
compose=['docker','compose','-f','infrastructure/docker/compose.yml']

def run(args, check=True, timeout=30):
    result=subprocess.run(args,cwd=ROOT,capture_output=True,text=True,timeout=timeout)
    if result.stdout.strip():
        print(result.stdout.strip())
    if result.stderr.strip():
        print(result.stderr.strip(),file=sys.stderr)
    if check and result.returncode != 0:
        raise SystemExit(result.returncode)
    return result

run(compose+['stop','meshcentral'])

create=run(
    compose+[
        'run','--rm','--no-deps','--entrypoint','node','meshcentral',
        '/opt/meshcentral/meshcentral/meshcentral.js',
        '--createaccount',username,'--pass',password,
    ],
    check=False,
)
# "User already exists." is the expected idempotent case.
if create.returncode != 0 and 'already exists' not in (create.stdout + create.stderr).lower():
    raise SystemExit(create.returncode)

run(
    compose+[
        'run','--rm','--no-deps','--entrypoint','node','meshcentral',
        '/opt/meshcentral/meshcentral/meshcentral.js',
        '--adminaccount',username,
    ],
    check=True,
)

run(compose+['up','-d','meshcentral'])
print('meshcentral_integration_account_ready='+username)
