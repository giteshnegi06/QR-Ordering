import React, { useRef } from 'react';
import { useReactToPrint } from 'react-to-print';
import { CafeInfo, TableItem } from '../../types';
import { Modal } from '../common/Modal';
import { Printer, Download, ExternalLink, QrCode } from 'lucide-react';
import { downloadTableQRCode } from '../../services/qrcode';

interface TablePrintModalProps {
  table: TableItem | null;
  cafe: CafeInfo;
  qrDataUrl: string;
  isOpen: boolean;
  onClose: () => void;
  onTestTableMenu: (tableId: string) => void;
}

export const TablePrintModal: React.FC<TablePrintModalProps> = ({
  table,
  cafe,
  qrDataUrl,
  isOpen,
  onClose,
  onTestTableMenu,
}) => {
  // Hooks must run every render regardless of `table` — the early return
  // below only guards what gets rendered, not these declarations.
  const contentRef = useRef<HTMLDivElement>(null);
  const handlePrint = useReactToPrint({
    contentRef,
    documentTitle: `Table-Stand-${table?.number ?? ''}`,
  });

  if (!table) return null;

  const handleDownload = () => {
    downloadTableQRCode(cafe.name, table.number, qrDataUrl);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        <div className="flex items-center gap-2">
          <QrCode className="w-5 h-5 text-amber-600" />
          <span>Table Stand & QR Card</span>
        </div>
      }
      maxWidth="md"
    >
      <div className="space-y-5">
        {/* Printable Card Frame */}
        <div
          ref={contentRef}
          id="printable-table-card"
          className="p-6 bg-white border-2 border-stone-200 rounded-3xl text-center space-y-4 shadow-sm"
        >
          {/* Top header */}
          <div>
            <span className="text-[10px] font-black uppercase tracking-widest text-amber-700 bg-amber-100/70 px-3 py-1 rounded-full border border-amber-200 inline-block mb-1">
              DIGITAL MENU • SCAN & ORDER
            </span>
            <h3 className="text-2xl font-black text-stone-900 tracking-tight">
              {cafe.name}
            </h3>
            <p className="text-xs text-stone-500">{cafe.tagline}</p>
          </div>

          {/* Table Badge */}
          <div className="inline-block bg-stone-900 text-stone-100 px-6 py-2 rounded-2xl shadow-xs">
            <span className="text-lg font-black tracking-wide">{table.number.toUpperCase()}</span>
          </div>

          {/* QR Code Image */}
          <div className="w-56 h-56 mx-auto bg-white p-3 rounded-2xl border border-stone-200 shadow-inner flex items-center justify-center">
            {qrDataUrl ? (
              <img
                src={qrDataUrl}
                alt={`${table.number} QR Code`}
                className="w-full h-full object-contain"
              />
            ) : (
              <div className="text-xs text-stone-400">Generating QR...</div>
            )}
          </div>

          {/* Instructions */}
          <div className="space-y-1">
            <p className="text-xs font-bold text-stone-800">
              📱 Point your smartphone camera at the QR code
            </p>
            <p className="text-[11px] text-stone-500">
              Instant menu access • No app download required • Orders sent directly to kitchen
            </p>
          </div>
        </div>

        {/* Action buttons */}
        <div className="grid grid-cols-3 gap-2">
          <button
            onClick={handleDownload}
            className="py-2.5 px-3 bg-stone-100 hover:bg-stone-200 text-stone-800 rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>Download PNG</span>
          </button>

          <button
            onClick={() => handlePrint()}
            className="py-2.5 px-3 bg-stone-900 hover:bg-black text-white rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>Print Stand</span>
          </button>

          <button
            onClick={() => {
              onClose();
              onTestTableMenu(table.code || table.id);
            }}
            className="py-2.5 px-3 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <ExternalLink className="w-4 h-4" />
            <span>Test Menu</span>
          </button>
        </div>
      </div>
    </Modal>
  );
};
