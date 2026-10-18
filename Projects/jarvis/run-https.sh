#!/usr/bin/env bash
# Start Spectre with HTTPS for microphone access on mobile devices
# Generates self-signed SSL certs automatically

set -e
cd "$(dirname "$0")"

# Detect local IP for the cert CN and output message
IP=$(hostname -I 2>/dev/null | awk '{print $1}')
if [ -z "$IP" ]; then
    IP="0.0.0.0"
fi

mkdir -p ssl

# Generate SSL certs if they don't exist
if [ ! -f ssl/cert.pem ] || [ ! -f ssl/key.pem ]; then
    echo "Generating self-signed SSL certificate for $IP ..."
    openssl req -x509 -newkey rsa:4096 \
        -keyout ssl/key.pem \
        -out ssl/cert.pem \
        -days 365 -nodes \
        -subj "/CN=$IP" 2>/dev/null
    echo "✓ SSL certificates generated"
fi

export SSL_CERT=ssl/cert.pem
export SSL_KEY=ssl/key.pem

URL="https://$IP:8000"

echo ""
echo "╔══════════════════════════════════════════════╗"
echo "║       🤖 SPECTRE — Virtual Company HQ        ║"
echo "╠══════════════════════════════════════════════╣"
echo "║  Scan the QR code with your phone's camera  ║"
echo "║  to open the voice assistant                ║"
echo "╚══════════════════════════════════════════════╝"
echo ""

# Generate and display QR code using Python
venv/bin/python -c "
import qrcode
qr = qrcode.QRCode(border=1, box_size=1)
qr.add_data('$URL')
qr.print_ascii(invert=True)
" 2>/dev/null || echo "  QR: $URL"

echo ""
echo "  Or open manually: $URL"
echo ""
echo "  ⚠️  Your phone will show a security warning."
echo "     Tap 'Advanced' → 'Proceed anyway'"
echo "     (This is safe — it's your own server)"
echo ""

venv/bin/python main.py
