#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 /path/to/ANPR-System"
  echo "Expected source files:"
  echo "  models/yolo/model/best.pt"
  echo "  models/ocr_crnn/quant/crnn_ocr_model_int8_fx.pth"
  exit 1
fi

SRC_ROOT="$1"
YOLO_SRC="$SRC_ROOT/models/yolo/model/best.pt"
CRNN_SRC="$SRC_ROOT/models/ocr_crnn/quant/crnn_ocr_model_int8_fx.pth"

YOLO_DST="app/services/anpr/runoi/models/yolo/best.pt"
CRNN_DST="app/services/anpr/runoi/models/crnn/crnn_ocr_model_int8_fx.pth"

mkdir -p "$(dirname "$YOLO_DST")" "$(dirname "$CRNN_DST")"

if [[ ! -f "$YOLO_SRC" ]]; then
  echo "ERROR: YOLO model not found: $YOLO_SRC"
  exit 2
fi
if [[ ! -f "$CRNN_SRC" ]]; then
  echo "ERROR: CRNN model not found: $CRNN_SRC"
  exit 3
fi

cp "$YOLO_SRC" "$YOLO_DST"
cp "$CRNN_SRC" "$CRNN_DST"

echo "Copied:"
echo "  $YOLO_SRC -> $YOLO_DST"
echo "  $CRNN_SRC -> $CRNN_DST"
echo "Done. Now set ANPR_PROVIDER=runoi and start backend."
