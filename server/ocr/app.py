"""Passport OCR service for the helper server (runs in Docker on the VPS, 127.0.0.1:8101).

POST /ocr with a JPEG/PNG body → {"rows": [...], "lines": [{"text", "score", "box"}], "rotated": deg, "ms": n}
`rows` are the text lines in reading order (top to bottom, left to right), which the extension turns into
passport fields with the same rules as its in-browser scan. Images are read in memory and never stored.

Uses RapidOCR: the PaddleOCR (PP-OCR) models run with ONNX Runtime, about 2–3 s per page on the VPS CPU,
with the English recognition model (the default Chinese+English one drops the spaces between words).
(PaddleOCR itself was tried first: 24 s per page without oneDNN, and crashes with it on Paddle 3.2/3.3.)
A photo taken sideways or upside down is retried in the other orientations until the MRZ is found.
"""
import json
import os
import re
import sys
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

import cv2
import numpy as np
from rapidocr_onnxruntime import RapidOCR

MAX_BYTES = 10 * 1024 * 1024
MAX_SIDE = int(os.environ.get('OCR_MAX_SIDE', '2000'))
MRZ_ROW = re.compile(r'^[A-Z0-9<]{40,46}$')  # a whole row that is an MRZ line

# English recognition model (Dockerfile): keeps word spaces and reads Latin text better.
engine = RapidOCR(rec_model_path=os.environ.get('OCR_REC_MODEL', '/models/en_rec.onnx'))
lock = threading.Lock()  # one engine: read one image at a time


def read_image(data):
    img = cv2.imdecode(np.frombuffer(data, np.uint8), cv2.IMREAD_COLOR)
    if img is None:
        raise ValueError('not an image')
    h, w = img.shape[:2]
    scale = MAX_SIDE / max(h, w)
    if scale < 1:
        img = cv2.resize(img, (int(w * scale), int(h * scale)), interpolation=cv2.INTER_AREA)
    return img


def to_rows(lines):
    """Groups text boxes into visual rows by their vertical centre."""
    items = []
    for ln in lines:
        ys = [p[1] for p in ln['box']]
        xs = [p[0] for p in ln['box']]
        items.append({'text': ln['text'], 'cy': (min(ys) + max(ys)) / 2, 'h': max(ys) - min(ys), 'x': min(xs)})
    items.sort(key=lambda i: i['cy'])
    rows = []
    for it in items:
        row = rows[-1] if rows else None
        if row and abs(it['cy'] - row['cy']) < max(6, 0.5 * min(it['h'], row['h'])):
            row['items'].append(it)
        else:
            rows.append({'cy': it['cy'], 'h': it['h'], 'items': [it]})
    return [(' '.join(i['text'] for i in sorted(r['items'], key=lambda i: i['x'])), r['cy']) for r in rows]


def ocr_lines(img):
    with lock:
        result, _ = engine(img)
    return [{'text': str(t), 'score': round(float(s), 3), 'box': np.asarray(b).astype(int).tolist()}
            for b, t, s in (result or []) if str(t).strip()]


ROTATIONS = [(0, None), (90, cv2.ROTATE_90_CLOCKWISE), (270, cv2.ROTATE_90_COUNTERCLOCKWISE), (180, cv2.ROTATE_180)]


def tilt(lines):
    """Median slope (degrees) of the long text boxes; a tilted photo merges neighbouring rows."""
    angles = []
    for ln in lines:
        (x0, y0), (x1, y1) = ln['box'][0], ln['box'][1]
        w, h = abs(x1 - x0), abs(ln['box'][3][1] - y0)
        if w > 4 * max(h, 1):
            angles.append(np.degrees(np.arctan2(y1 - y0, x1 - x0)))
    return float(np.median(angles)) if len(angles) >= 3 else 0.0


def straighten(img, deg):
    h, w = img.shape[:2]
    m = cv2.getRotationMatrix2D((w / 2, h / 2), deg, 1.0)
    return cv2.warpAffine(img, m, (w, h), flags=cv2.INTER_CUBIC, borderMode=cv2.BORDER_REPLICATE)


def run(data):
    img = read_image(data)
    t0 = time.time()
    best = None
    for deg, code in ROTATIONS:
        turned = img if code is None else cv2.rotate(img, code)
        lines = ocr_lines(turned)
        skew = tilt(lines)
        if 1.0 < abs(skew) < 30:  # straighten a tilted photo and read it again
            turned = straighten(turned, skew)
            lines = ocr_lines(turned)
        rows = to_rows(lines)
        # Upright page: the MRZ is a row of its own in the lower half (sideways reads mix rows; upside-down puts it on top).
        found = any(MRZ_ROW.match(t.replace(' ', '').upper()) and cy > turned.shape[0] * 0.5 for t, cy in rows)
        rows = [t for t, _ in rows]
        score = sum(l['score'] for l in lines)
        if found:
            best = (score, deg, lines, rows)
            break
        if best is None or score > best[0]:
            best = (score, deg, lines, rows)
    _, deg, lines, rows = best
    return {'rows': rows, 'lines': lines, 'rotated': deg, 'ms': int((time.time() - t0) * 1000)}


class Handler(BaseHTTPRequestHandler):
    def _send(self, code, obj):
        body = json.dumps(obj).encode()
        self.send_response(code)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        self._send(200, {'ok': True, 'engine': 'rapidocr'}) if self.path == '/health' else self._send(404, {'error': 'not_found'})

    def do_POST(self):
        if self.path != '/ocr':
            return self._send(404, {'error': 'not_found'})
        n = int(self.headers.get('Content-Length') or 0)
        if n <= 0 or n > MAX_BYTES:
            return self._send(413, {'error': 'too_large'})
        try:
            self._send(200, run(self.rfile.read(n)))
        except ValueError as e:
            self._send(400, {'error': str(e)})
        except Exception as e:  # keep the service up; the Node server reports a generic error
            print('ocr error', repr(e), file=sys.stderr, flush=True)
            self._send(500, {'error': 'ocr_failed'})

    def log_message(self, *args):  # no access log: nothing about the images is kept
        pass


if __name__ == '__main__':
    if '--warmup' in sys.argv:  # build time: check the models load
        run(cv2.imencode('.jpg', np.full((200, 600, 3), 255, np.uint8))[1].tobytes())
        print('models ready')
        sys.exit(0)
    ThreadingHTTPServer(('0.0.0.0', 8101), Handler).serve_forever()
