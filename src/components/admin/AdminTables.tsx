import React, { useState } from 'react';
import { CafeInfo, TableItem } from '../../types';
import { Modal } from '../common/Modal';
import { TablePrintModal } from './TablePrintModal';
import { generateTableQRDataUrl } from '../../services/qrcode';
import {
  Plus,
  Edit2,
  Trash2,
  QrCode,
  ExternalLink,
  Users,
  CheckCircle2,
  Clock,
  Sparkles,
} from 'lucide-react';

interface AdminTablesProps {
  cafe: CafeInfo;
  tables: TableItem[];
  onAddTable: (table: Omit<TableItem, 'id' | 'code'>) => void;
  onUpdateTable: (id: string, updates: Partial<TableItem>) => void;
  onDeleteTable: (id: string) => void;
  onOpenCustomerMenu: (tableId: string) => void;
}

export const AdminTables: React.FC<AdminTablesProps> = ({
  cafe,
  tables,
  onAddTable,
  onUpdateTable,
  onDeleteTable,
  onOpenCustomerMenu,
}) => {
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingTable, setEditingTable] = useState<TableItem | null>(null);
  const [tableNumber, setTableNumber] = useState('');
  const [capacity, setCapacity] = useState(4);

  // QR Print Modal state
  const [selectedTableForQR, setSelectedTableForQR] = useState<TableItem | null>(null);
  const [selectedQRDataUrl, setSelectedQRDataUrl] = useState<string>('');

  const handleOpenAdd = () => {
    setEditingTable(null);
    const nextNum = String(tables.length + 1).padStart(2, '0');
    setTableNumber(`Table ${nextNum}`);
    setCapacity(4);
    setIsAddModalOpen(true);
  };

  const handleOpenEdit = (t: TableItem) => {
    setEditingTable(t);
    setTableNumber(t.number);
    setCapacity(t.capacity);
    setIsAddModalOpen(true);
  };

  const handleSaveTable = (e: React.FormEvent) => {
    e.preventDefault();
    if (!tableNumber.trim()) return;
    const safeCapacity = Number.isNaN(capacity) ? 1 : capacity;

    if (editingTable) {
      onUpdateTable(editingTable.id, {
        number: tableNumber.trim(),
        capacity: safeCapacity,
      });
    } else {
      onAddTable({
        number: tableNumber.trim(),
        capacity: safeCapacity,
        status: 'available',
      });
    }

    setIsAddModalOpen(false);
  };

  const handleOpenQR = async (t: TableItem) => {
    const dataUrl = await generateTableQRDataUrl(cafe.id, t.code || t.id);
    setSelectedQRDataUrl(dataUrl);
    setSelectedTableForQR(t);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-black text-stone-900 tracking-tight">Table System</h2>
          <p className="text-xs text-stone-500">
            Configure cafe dining tables and launch unique QR ordering codes
          </p>
        </div>

        <button
          onClick={handleOpenAdd}
          className="px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Add Table</span>
        </button>
      </div>

      {/* Tables Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {tables.map((table) => {
          const isOccupied = table.status === 'occupied';

          return (
            <div
              key={table.id}
              className={`bg-white rounded-2xl border p-5 shadow-2xs flex flex-col justify-between transition-all ${
                isOccupied
                  ? 'border-amber-300 ring-2 ring-amber-100'
                  : 'border-stone-200 hover:border-stone-300'
              }`}
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-3">
                  <span className="text-lg font-black text-stone-900">
                    {table.number}
                  </span>

                  <span
                    className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                      isOccupied
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-emerald-50 text-emerald-700'
                    }`}
                  >
                    {isOccupied ? 'Occupied' : 'Available'}
                  </span>
                </div>

                <div className="flex items-center gap-1.5 text-xs text-stone-500 mb-4">
                  <Users className="w-3.5 h-3.5 text-stone-400" />
                  <span>Capacity: {table.capacity} Guests</span>
                </div>

                {/* Direct Test Menu Link */}
                <button
                  onClick={() => onOpenCustomerMenu(table.code || table.id)}
                  className="w-full py-2 px-3 bg-amber-50 hover:bg-amber-100/80 text-amber-900 rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-1.5 border border-amber-200/60 mb-2 cursor-pointer"
                  title="Simulate scanning this table QR code"
                >
                  <ExternalLink className="w-3.5 h-3.5 text-amber-700" />
                  <span>Test Digital Menu</span>
                </button>
              </div>

              {/* Card Footer Actions */}
              <div className="pt-3 border-t border-stone-100 flex items-center justify-between">
                <button
                  onClick={() => handleOpenQR(table)}
                  className="text-xs font-bold text-stone-700 hover:text-amber-700 flex items-center gap-1 cursor-pointer"
                >
                  <QrCode className="w-4 h-4 text-amber-600" />
                  <span>QR Code</span>
                </button>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleOpenEdit(table)}
                    className="p-1.5 text-stone-400 hover:text-stone-700 hover:bg-stone-100 rounded-lg transition-colors"
                    title="Edit Table"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => {
                      if (window.confirm(`Delete ${table.number}?`)) {
                        onDeleteTable(table.id);
                      }
                    }}
                    className="p-1.5 text-stone-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                    title="Delete Table"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Add / Edit Table Modal */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title={editingTable ? 'Edit Table' : 'Add New Table'}
        maxWidth="sm"
      >
        <form onSubmit={handleSaveTable} className="space-y-4 text-xs">
          <div>
            <label className="block font-bold text-stone-700 uppercase tracking-wider mb-1">
              Table Name / Number *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Table 05, Patio 02"
              value={tableNumber}
              onChange={(e) => setTableNumber(e.target.value)}
              className="w-full px-3 py-2 border border-stone-200 rounded-xl focus:outline-none focus:border-amber-500"
            />
          </div>

          <div>
            <label className="block font-bold text-stone-700 uppercase tracking-wider mb-1">
              Seating Capacity (Guests)
            </label>
            <input
              type="number"
              min={1}
              max={50}
              value={Number.isNaN(capacity) ? '' : capacity}
              onChange={(e) => setCapacity(e.target.valueAsNumber)}
              className="w-full px-3 py-2 border border-stone-200 rounded-xl focus:outline-none focus:border-amber-500"
            />
          </div>

          <div className="pt-3 border-t border-stone-100 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsAddModalOpen(false)}
              className="px-4 py-2 border border-stone-200 text-stone-600 hover:bg-stone-50 rounded-xl font-bold transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-bold shadow-xs transition-colors"
            >
              Save Table
            </button>
          </div>
        </form>
      </Modal>

      {/* QR Print Preview Modal */}
      <TablePrintModal
        table={selectedTableForQR}
        cafe={cafe}
        qrDataUrl={selectedQRDataUrl}
        isOpen={!!selectedTableForQR}
        onClose={() => setSelectedTableForQR(null)}
        onTestTableMenu={onOpenCustomerMenu}
      />
    </div>
  );
};
