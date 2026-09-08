import React, { useState, useEffect } from 'react';
import { CafeInfo, TableItem } from '../../types';
import { generateTableQRDataUrl, getTableMenuUrl, downloadTableQRCode } from '../../services/qrcode';
import { TablePrintModal } from './TablePrintModal';
import {
  QrCode,
  Download,
  Printer,
  ExternalLink,
  Layers,
  Copy,
  Check,
  Sparkles,
} from 'lucide-react';

interface AdminQRCodesProps {
  cafe: CafeInfo;
  tables: TableItem[];
  onOpenCustomerMenu: (tableId: string) => void;
}

export const AdminQRCodes: React.FC<AdminQRCodesProps> = ({
  cafe,
  tables,
  onOpenCustomerMenu,
}) => {
  const [qrMap, setQrMap] = useState<Record<string, string>>({});
  const [selectedTableForModal, setSelectedTableForModal] = useState<TableItem | null>(null);
  const [copiedTableId, setCopiedTableId] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState<boolean>(true);

  // Pre-generate QR Data URLs for all tables
  useEffect(() => {
    let isMounted = true;
    async function loadAllQRs() {
      setIsGenerating(true);
      const newMap: Record<string, string> = {};
      for (const table of tables) {
        const dataUrl = await generateTableQRDataUrl(cafe.id, table.code || table.id);
        newMap[table.id] = dataUrl;
      }
      if (isMounted) {
        setQrMap(newMap);
        setIsGenerating(false);
      }
    }
    loadAllQRs();
    return () => {
      isMounted = false;
    };
  }, [tables, cafe.id]);

  const handleCopyLink = (table: TableItem) => {
    const url = getTableMenuUrl(cafe.id, table.code || table.id);
    navigator.clipboard.writeText(url);
    setCopiedTableId(table.id);
    setTimeout(() => setCopiedTableId(null), 2000);
  };

  const handleDownload = (table: TableItem) => {
    const dataUrl = qrMap[table.id];
    if (dataUrl) {
      downloadTableQRCode(cafe.name, table.number, dataUrl);
    }
  };

  const handlePrintAll = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-stone-900 tracking-tight">
            Table QR Code Generator
          </h2>
          <p className="text-xs text-stone-500">
            Dynamically generated QR codes for each cafe table. Each code carries the unique table parameter.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handlePrintAll}
            className="px-4 py-2.5 bg-stone-900 hover:bg-black text-white rounded-xl text-xs font-bold shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>Print All Table Stands</span>
          </button>
        </div>
      </div>

      {/* Grid of Tables */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
        {tables.map((table) => {
          const qrDataUrl = qrMap[table.id];
          const isCopied = copiedTableId === table.id;

          return (
            <div
              key={table.id}
              className="bg-white rounded-3xl border border-stone-200 p-5 shadow-2xs flex flex-col justify-between text-center transition-all hover:shadow-md"
            >
              <div>
                {/* Header */}
                <div className="inline-block bg-stone-900 text-stone-100 px-4 py-1.5 rounded-full text-xs font-black tracking-wide mb-3">
                  {table.number.toUpperCase()}
                </div>

                {/* QR Code Container */}
                <div className="w-44 h-44 mx-auto bg-stone-50 p-2.5 rounded-2xl border border-stone-200/80 flex items-center justify-center mb-3">
                  {qrDataUrl ? (
                    <img
                      src={qrDataUrl}
                      alt={`${table.number} QR Code`}
                      className="w-full h-full object-contain"
                    />
                  ) : (
                    <div className="text-xs text-stone-400 animate-pulse">Generating...</div>
                  )}
                </div>

                <div className="text-[11px] font-mono text-stone-500 truncate px-2 mb-3 bg-stone-50 py-1 rounded-lg border border-stone-100">
                  /menu/{cafe.id}/{table.code || table.id}
                </div>
              </div>

              {/* Action Buttons Row */}
              <div className="pt-3 border-t border-stone-100 space-y-2">
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    onClick={() => setSelectedTableForModal(table)}
                    className="py-2 px-2 bg-stone-100 hover:bg-stone-200 text-stone-800 rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <QrCode className="w-3.5 h-3.5" />
                    <span>Preview</span>
                  </button>

                  <button
                    onClick={() => handleDownload(table)}
                    className="py-2 px-2 bg-stone-100 hover:bg-stone-200 text-stone-800 rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download</span>
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    onClick={() => handleCopyLink(table)}
                    className="py-2 px-2 bg-stone-50 hover:bg-stone-100 text-stone-600 rounded-xl text-xs font-semibold transition-colors flex items-center justify-center gap-1 border border-stone-200 cursor-pointer"
                  >
                    {isCopied ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                        <span className="text-emerald-700">Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copy Link</span>
                      </>
                    )}
                  </button>

                  <button
                    onClick={() => onOpenCustomerMenu(table.code || table.id)}
                    className="py-2 px-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-1 shadow-2xs cursor-pointer"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Test Scan</span>
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal for single table QR Preview & Print */}
      <TablePrintModal
        table={selectedTableForModal}
        cafe={cafe}
        qrDataUrl={selectedTableForModal ? qrMap[selectedTableForModal.id] : ''}
        isOpen={!!selectedTableForModal}
        onClose={() => setSelectedTableForModal(null)}
        onTestTableMenu={onOpenCustomerMenu}
      />
    </div>
  );
};
