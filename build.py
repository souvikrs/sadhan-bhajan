#!/usr/bin/env python3
"""Build Sadhan Bhajan: encrypt content/ into docs/data and copy the app shell from app/.

Every private file is sealed with AES-256-GCM. The key comes from the passphrase in
.passphrase (never committed) via PBKDF2-SHA256. Only docs/ is published.
"""
import base64, hashlib, json, os, pathlib, shutil
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from cryptography.hazmat.primitives import hashes

ROOT = pathlib.Path(__file__).parent
CONTENT, APP, SITE = ROOT / "content", ROOT / "app", ROOT / "docs"
ITERATIONS = 300_000

passphrase = (ROOT / ".passphrase").read_text().strip()
salt = os.urandom(16)
key = PBKDF2HMAC(algorithm=hashes.SHA256(), length=32, salt=salt, iterations=ITERATIONS).derive(passphrase.encode())
aes = AESGCM(key)


def seal(data: bytes) -> bytes:
    nonce = os.urandom(12)
    return nonce + aes.encrypt(nonce, data, None)


def b64(path: pathlib.Path) -> str:
    return base64.b64encode(path.read_bytes()).decode()


if SITE.exists():
    shutil.rmtree(SITE)
shutil.copytree(APP, SITE)
data = SITE / "data"
data.mkdir()

# Books: one sealed file per page, loaded on demand.
books = {}
for book in sorted((CONTENT / "books").iterdir()):
    if not book.is_dir():
        continue
    pages = sorted(book.glob("*.jpg"))
    out = data / "b" / book.name
    out.mkdir(parents=True)
    for i, page in enumerate(pages, 1):
        (out / f"{i}.bin").write_bytes(seal(page.read_bytes()))
    books[book.name] = len(pages)

audio = data / "a"
audio.mkdir()
(audio / "session01.bin").write_bytes(seal((CONTENT / "audio" / "session01.mp3").read_bytes()))

text = json.loads((CONTENT / "text.json").read_text())
for b in text["books"]:
    b["pages"] = books.get(b["id"], 0)

bundle = {
    "text": text,
    "sessions": json.loads((CONTENT / "sessions.json").read_text()),
    "guide": (CONTENT / "guide.html").read_text(),
    "comp_en": (CONTENT / "compilation_en.txt").read_text(),
    "comp_bn": (CONTENT / "compilation_bn.txt").read_text(),
    "img": {p.stem: "data:image/jpeg;base64," + b64(p) for p in (CONTENT / "img").glob("*.jpg")},
}
(data / "main.bin").write_bytes(seal(json.dumps(bundle, ensure_ascii=False).encode()))
(data / "meta.json").write_text(json.dumps({"salt": base64.b64encode(salt).decode(), "iter": ITERATIONS}))

# Cache-bust the service worker with a hash of everything published.
h = hashlib.sha256()
for f in sorted(SITE.rglob("*")):
    if f.is_file():
        h.update(f.read_bytes())
sw = SITE / "sw.js"
sw.write_text(sw.read_text().replace("__VERSION__", h.hexdigest()[:12]))
(SITE / ".nojekyll").write_text("")

size = sum(f.stat().st_size for f in SITE.rglob("*") if f.is_file())
print(f"built docs/: {size/1e6:.1f} MB, books {books}")
