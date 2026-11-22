"""실제 Docker·DB에 접근하지 않고 start.sh·bootstrap.sh의 분리·실패 경로를 검사한다."""
import os
from pathlib import Path
import pty
import select
import shutil
import subprocess
import tempfile
import time
import unittest

SOURCE = Path(__file__).resolve().parents[1]

class StartScriptTest(unittest.TestCase):
    def run_start(self, mode, replies=(), failure=False, args=(), interactive=True, source_available=True, script='start.sh'):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            shutil.copy(SOURCE / script, root / script)
            (root / 'backend').mkdir()
            if source_available:
                (root / 'backend/Dockerfile').touch()
                (root / 'frontend').mkdir()
                (root / 'frontend/Dockerfile').touch()
            (root / '.env').write_text('')
            (root / 'backend/.env').write_text('')
            docker = root / 'docker'
            docker.write_text('''#!/bin/bash
printf '%s\\n' "$*" >> "$CMMS_TEST_TRACE"
case "$*" in
  *"node -p"*) printf '%s\\n' "$CMMS_TEST_MODE" ;;
  *"schema-init.js"*) if [[ "$CMMS_TEST_FAIL" == 1 ]]; then printf 'existing tables\\n' >&2; exit 1; fi ;;
esac
''')
            docker.chmod(0o755)
            trace = root / 'trace'
            env = {**os.environ, 'PATH': str(root) + ':' + os.environ['PATH'], 'CMMS_TEST_TRACE': str(trace), 'CMMS_TEST_MODE': mode, 'CMMS_TEST_FAIL': '1' if failure else '0'}
            if not interactive:
                result = subprocess.run(['bash', str(root / script), *args], env=env, capture_output=True, text=True, timeout=10)
                return result.returncode, result.stdout + result.stderr, trace.read_text() if trace.exists() else ''
            master, slave = pty.openpty()
            process = subprocess.Popen(['bash', str(root / script), *args], stdin=slave, stdout=slave, stderr=slave, env=env)
            os.close(slave)
            output = b''
            pending = list(replies)
            deadline = time.monotonic() + 10
            try:
                while time.monotonic() < deadline:
                    if select.select([master], [], [], 0.1)[0]:
                        try:
                            chunk = os.read(master, 65536)
                        except OSError:
                            break
                        if not chunk:
                            break
                        output += chunk
                    if pending and pending[0][0].encode() in output:
                        _, reply = pending.pop(0)
                        os.write(master, (reply + '\n').encode())
                    if process.poll() is not None:
                        break
                process.wait(timeout=1)
                self.assertEqual(pending, [], output.decode())
                return process.returncode, output.decode(), trace.read_text() if trace.exists() else ''
            finally:
                if process.poll() is None:
                    process.kill()
                    process.wait()
                os.close(master)

    def test_install_failure_never_starts_service(self):
        code, _, trace = self.run_start('production', [('INSTALL을 입력', 'INSTALL')], failure=True, args=('schema',), script='bootstrap.sh')
        self.assertNotEqual(code, 0)
        self.assertIn('schema-init.js', trace)
        self.assertNotIn(' up ', trace)
        self.assertNotIn('bootstrap-admin.js', trace)

    def test_install_requires_explicit_confirmation(self):
        for reply in ['no', '']:
            code, _, trace = self.run_start('production', [('INSTALL을 입력', reply)], args=('schema',), script='bootstrap.sh')
            self.assertEqual(code, 0)
            self.assertNotIn('schema-init.js', trace)
            self.assertNotIn(' up ', trace)

    def test_schema_install_disables_automatic_sync_and_does_not_start(self):
        code, _, trace = self.run_start('production', [('INSTALL을 입력', 'INSTALL')], args=('schema',), script='bootstrap.sh')
        self.assertEqual(code, 0)
        self.assertIn('-e DB_SYNCHRONIZE=false', trace)
        self.assertIn('schema-init.js', trace)
        self.assertNotIn(' up ', trace)

    def test_admin_requires_terminal_disables_sync_and_never_starts(self):
        for source_available in [True, False]:
            code, _, trace = self.run_start('development', args=('admin',), interactive=True, script='bootstrap.sh', source_available=source_available)
            self.assertEqual(code, 0)
            self.assertIn('bootstrap-admin.js', trace)
            self.assertIn(' -it ', trace)
            self.assertIn('-e DB_SYNCHRONIZE=false', trace)
            self.assertNotIn(' up ', trace)
            self.assertNotIn('schema-init.js', trace)
            self.assertEqual(' build backend' in trace, source_available)

    def test_start_never_initializes_in_any_mode_or_terminal(self):
        for mode in ['test', 'production', 'development']:
            for interactive in [True, False]:
                code, _, trace = self.run_start(mode, interactive=interactive)
                self.assertEqual(code, 0)
                self.assertIn(' up -d ', trace)
                self.assertNotIn('schema-init.js', trace)
                self.assertNotIn('bootstrap-admin.js', trace)

    def test_bootstrap_invalid_arguments_and_missing_confirmation_do_not_execute(self):
        for args in [(), ('unknown',), ('admin', 'extra'), ('schema',), ('admin',)]:
            code, _, trace = self.run_start('production', args=args, interactive=False, script='bootstrap.sh')
            self.assertNotEqual(code, 0)
            self.assertEqual(trace, '')

    def test_release_package_contains_only_images_and_external_configuration(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            docker = root / 'docker'
            docker.write_text('#!/bin/bash\nif [[ "$1" == save ]]; then touch "$3"; fi\n')
            docker.chmod(0o755)
            output = root / 'release'
            env = {**os.environ, 'PATH': str(root) + ':' + os.environ['PATH']}
            result = subprocess.run(['bash', str(SOURCE / 'scripts/package-release.sh'), str(output), 'test'], env=env, capture_output=True, text=True, timeout=10)
            self.assertEqual(result.returncode, 0, result.stderr)
            files = {str(path.relative_to(output)) for path in output.rglob('*') if path.is_file()}
            self.assertEqual(files, {'compose.yaml', 'start.sh', 'stop.sh', 'bootstrap.sh', '.env.example', 'backend/.env.example', 'deploy/nginx/default.conf', 'deploy/nginx/https.conf', 'images.tar', 'INSTALL.txt'})
            self.assertIn('DB_SYNCHRONIZE=false', (output / 'backend/.env.example').read_text())
            self.assertNotIn('DB_SYNCHRONIZE=true\n', (output / 'backend/.env.example').read_text())
            self.assertIn('NODE_ENV=production', (output / 'backend/.env.example').read_text())
            self.assertEqual((output / 'compose.yaml').read_text(), (SOURCE / 'compose.yaml').read_text())
            self.assertIn('CMMS_BACKEND_IMAGE=cmms-backend:test', (output / '.env.example').read_text())
            self.assertIn('CMMS_FRONTEND_IMAGE=cmms-frontend:test', (output / '.env.example').read_text())

    def test_explicit_arguments_are_forwarded_without_build_or_prompts(self):
        code, _, trace = self.run_start('production', args=('logs',), interactive=False)
        self.assertEqual(code, 0)
        self.assertNotIn(' build', trace)
        self.assertIn(' logs', trace)

    def test_source_build_and_loaded_image_start(self):
        for source_available in [True, False]:
            code, _, trace = self.run_start('production', interactive=False, source_available=source_available)
            self.assertEqual(code, 0)
            self.assertEqual(any(line.endswith(' build') for line in trace.splitlines()), source_available)
            self.assertIn(' up -d --no-build --remove-orphans', trace)

if __name__ == '__main__':
    unittest.main()
