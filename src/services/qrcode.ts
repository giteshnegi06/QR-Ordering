import QRCode from 'qrcode';

export interface TableQRData {
  tableNumber: string;
  tableId: string;
  cafeId: string;
  url: string;
  qrDataUrl: string;
}

export async function generateTableQRDataUrl(cafeId: string, tableId: string): Promise<string> {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const url = `${origin}/menu/${cafeId}/${tableId}`;
  
  try {
    return await QRCode.toDataURL(url, {
      width: 400,
      margin: 2,
      color: {
        dark: '#1c1917', // stone-900
        light: '#ffffff',
      },
      errorCorrectionLevel: 'H',
    });
  } catch (err) {
    console.error('Failed to generate QR code data URL', err);
    return '';
  }
}

export function getTableMenuUrl(cafeId: string, tableId: string): string {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  return `${origin}/menu/${cafeId}/${tableId}`;
}

export async function downloadTableQRCode(cafeName: string, tableNumber: string, qrDataUrl: string) {
  // Create an offscreen canvas to render a branded QR card for download
  const canvas = document.createElement('canvas');
  canvas.width = 600;
  canvas.height = 760;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  // Background
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Border frame
  ctx.strokeStyle = '#e7e5e4'; // stone-200
  ctx.lineWidth = 4;
  ctx.strokeRect(20, 20, canvas.width - 40, canvas.height - 40);

  // Top header banner
  ctx.fillStyle = '#f59e0b'; // amber-500
  ctx.fillRect(20, 20, canvas.width - 40, 16);

  // Cafe Name
  ctx.fillStyle = '#1c1917'; // stone-900
  ctx.font = 'bold 36px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(cafeName, canvas.width / 2, 85);

  // Subtitle
  ctx.fillStyle = '#78716c'; // stone-500
  ctx.font = '18px sans-serif';
  ctx.fillText('Scan to view digital menu & order', canvas.width / 2, 120);

  // Table Badge
  ctx.fillStyle = '#fef3c7'; // amber-100
  ctx.beginPath();
  const badgeY = 145;
  const badgeW = 200;
  const badgeH = 46;
  ctx.roundRect((canvas.width - badgeW) / 2, badgeY, badgeW, badgeH, 23);
  ctx.fill();
  ctx.fillStyle = '#92400e'; // amber-800
  ctx.font = 'bold 22px sans-serif';
  ctx.fillText(tableNumber.toUpperCase(), canvas.width / 2, badgeY + 31);

  // QR Code Image
  const qrImg = new Image();
  qrImg.src = qrDataUrl;
  await new Promise((resolve) => {
    qrImg.onload = resolve;
  });

  const qrSize = 380;
  const qrX = (canvas.width - qrSize) / 2;
  const qrY = 210;
  ctx.drawImage(qrImg, qrX, qrY, qrSize, qrSize);

  // Instruction footer
  ctx.fillStyle = '#1c1917';
  ctx.font = 'bold 20px sans-serif';
  ctx.fillText('📱 Open Camera & Scan QR', canvas.width / 2, 630);

  ctx.fillStyle = '#a8a29e';
  ctx.font = '14px sans-serif';
  ctx.fillText('No app download required • Instant Kitchen Ordering', canvas.width / 2, 665);

  // Trigger download
  const link = document.createElement('a');
  link.download = `${cafeName.toLowerCase().replace(/\s+/g, '-')}-${tableNumber.toLowerCase().replace(/\s+/g, '-')}-qr.png`;
  link.href = canvas.toDataURL('image/png');
  link.click();
}
