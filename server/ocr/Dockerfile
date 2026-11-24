# Passport OCR service (RapidOCR: PP-OCR models on ONNX Runtime, CPU). Built and run on the VPS by server/deploy-ocr.sh.
FROM python:3.11-slim
RUN apt-get update && apt-get install -y --no-install-recommends libgl1 libglib2.0-0 \
    && rm -rf /var/lib/apt/lists/*
RUN pip install --no-cache-dir rapidocr_onnxruntime==1.4.4 onnxruntime==1.32.0
# English recognition model: keeps the spaces between words ("RINA RANI"), which the default Chinese+English
# model drops ("RINARANI"). Pinned to a commit and checked.
ADD --checksum=sha256:ef7abd8bd3629ae57ea2c28b425c1bd258a871b93fd2fe7c433946ade9b5d9ea \
    https://huggingface.co/SWHL/RapidOCR/resolve/1cfba2e90fc938db55889873735088de210cc173/PP-OCRv3/en_PP-OCRv3_rec_infer.onnx /models/en_rec.onnx
WORKDIR /app
COPY app.py .
RUN python app.py --warmup
EXPOSE 8101
CMD ["python", "app.py"]
