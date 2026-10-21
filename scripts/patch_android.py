"""
Run after `npx cap add android` / `npx cap sync android`.

1. Signs the debug APK with the SAME key on every build (ci/tuika-debug.keystore). GitHub runners create a new
   random debug key each run, and Android refuses to install an update signed with a different key, which is why
   you had to uninstall the old app first.
2. Raises versionCode on every run (VERSION_CODE env, the GitHub run number) so a newer build is always an upgrade.

Safe to run more than once.
"""
import os
import re
import sys

PATH = os.path.join("android", "app", "build.gradle")
MARK = "// tuika-fixed-signing"

if not os.path.exists(PATH):
    sys.exit(f"{PATH} not found. Run `npx cap add android` first.")

s = open(PATH, encoding="utf-8").read()

if MARK not in s:
    block = (
        f"    {MARK}\n"
        "    signingConfigs {\n"
        "        debug {\n"
        '            storeFile rootProject.file("../ci/tuika-debug.keystore")\n'
        '            storePassword "android"\n'
        '            keyAlias "tuikadebug"\n'
        '            keyPassword "android"\n'
        "        }\n"
        "    }\n"
    )
    if re.search(r"^\s*signingConfigs\s*\{", s, re.M):
        sys.exit("build.gradle already has signingConfigs; merge ci/tuika-debug.keystore into it by hand.")
    s, n = re.subn(r"^(\s*)buildTypes\s*\{", lambda m: block + m.group(0), s, count=1, flags=re.M)
    if n != 1:
        sys.exit("Could not find buildTypes in build.gradle")

code = int(os.environ.get("VERSION_CODE", "0") or 0)
if code > 0:
    s = re.sub(r"versionCode\s+\d+", f"versionCode {code}", s, count=1)
    s = re.sub(r'versionName\s+"[^"]*"', f'versionName "1.0.{code}"', s, count=1)

open(PATH, "w", encoding="utf-8").write(s)
print("android/app/build.gradle patched: fixed debug signing, versionCode", code or "(unchanged)")
