/**
 * Isian dinamis Rekonsiliasi: baris dan kolom pembanding bisa ditambah serta
 * dikurangi, tiap sel berisi angka untuk Laporan A dan Laporan B.
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Plus, Trash2, Play, Columns3 } from 'lucide-react';
import {
  ReconciliationColumn,
  ReconciliationRow,
  ReconciliationRun,
} from '../../types/reconciliation';
import {
  columnKindLabel,
  createPickupColumns,
  createPickupRows,
  createReconciliationColumn,
  createReconciliationRow,
  formatColumnValue,
  getCellValues,
  natureLabel,
  ROW_NATURES,
  toReconciliationNumber,
} from '../../utils/reconciliationMath';

interface ReconciliationEditorProps {
  run: ReconciliationRun;
  canEdit: boolean;
  onPatch: (patch: Partial<ReconciliationRun>) => void;
  onRowsChange: (rows: ReconciliationRow[]) => void;
  onColumnsChange: (columns: ReconciliationColumn[]) => void;
  onExecute: () => void;
}

const moneyCell = (value: number): string => (value ? String(value) : '');

export const ReconciliationEditor: React.FC<ReconciliationEditorProps> = ({
  run,
  canEdit,
  onPatch,
  onRowsChange,
  onColumnsChange,
  onExecute,
}) => {
  const isVarians = run.kind === 'VARIANS';
  const columns = run.columns;
  // Tekanan tombol yang sedang diketik; tampilannya memakai teks aslinya supaya
  // "1.500.000" tidak dipotong, tapi nilainya langsung dikirim ke mesin hitung.
  const [typing, setTyping] = useState<Record<string, string>>({});

  useEffect(() => {
    setTyping({});
  }, [run.id, run.kind]);

  const totals = useMemo(
    () =>
      columns.map((column) => {
        let a = 0;
        let b = 0;
        for (const row of run.rows) {
          const cell = getCellValues(row, column.id);
          a += cell.valueA;
          b += cell.valueB;
        }
        return { column, a, b };
      }),
    [columns, run.rows]
  );

  const cellKey = (rowId: string, columnId: string, column: 'A' | 'B') =>
    `${rowId}:${columnId}:${column}`;

  const showValue = (row: ReconciliationRow, columnId: string, column: 'A' | 'B') => {
    const key = cellKey(row.id, columnId, column);
    if (typing[key] !== undefined) return typing[key];
    const values = getCellValues(row, columnId);
    return moneyCell(column === 'A' ? values.valueA : values.valueB);
  };

  const setCell = (rowId: string, columnId: string, side: 'a' | 'b', value: number) => {
    onRowsChange(
      run.rows.map((row) =>
        row.id === rowId
          ? { ...row, values: { ...row.values, [columnId]: { ...row.values?.[columnId], [side]: value } } }
          : row
      )
    );
  };

  const typeValue = (rowId: string, columnId: string, side: 'A' | 'B', text: string) => {
    setTyping((prev) => ({ ...prev, [cellKey(rowId, columnId, side)]: text }));
    setCell(rowId, columnId, side === 'A' ? 'a' : 'b', toReconciliationNumber(text));
  };

  const commitValue = (rowId: string, columnId: string, side: 'A' | 'B') => {
    const key = cellKey(rowId, columnId, side);
    if (typing[key] === undefined) return;
    setTyping((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const changeLabel = (rowId: string, label: string) => {
    onRowsChange(run.rows.map((row) => (row.id === rowId ? { ...row, label } : row)));
  };

  const changeNature = (rowId: string, nature: ReconciliationRow['nature']) => {
    onRowsChange(run.rows.map((row) => (row.id === rowId ? { ...row, nature } : row)));
  };

  const addRows = (count: number) => {
    const fresh: ReconciliationRow[] = [];
    for (let i = 0; i < count; i += 1) fresh.push(createReconciliationRow());
    onRowsChange([...run.rows, ...fresh]);
  };

  const removeRow = (rowId: string) => {
    onRowsChange(run.rows.filter((row) => row.id !== rowId));
  };

  const changeColumn = (columnId: string, patch: Partial<ReconciliationColumn>) => {
    onColumnsChange(
      columns.map((column) => (column.id === columnId ? { ...column, ...patch } : column))
    );
  };

  const addColumn = () => {
    onColumnsChange([
      ...columns,
      createReconciliationColumn({ label: '', kind: 'JUMLAH' }),
    ]);
  };

  const removeColumn = (columnId: string) => {
    if (columns.length <= 1) return;
    onColumnsChange(columns.filter((column) => column.id !== columnId));
    onRowsChange(
      run.rows.map((row) => {
        const values = { ...row.values };
        delete values[columnId];
        return { ...row, values };
      })
    );
  };

  const applyPickupExample = () => {
    const exampleColumns = createPickupColumns();
    onColumnsChange(exampleColumns);
    onRowsChange(
      createPickupRows().map((row) => ({
        ...row,
        values: Object.fromEntries(exampleColumns.map((column) => [column.id, { a: 0, b: 0 }])),
      }))
    );
  };

  const inputClass =
    'w-full px-2.5 py-2 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-500 disabled:bg-slate-50 disabled:text-slate-500';

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
      <div className="px-4 sm:px-5 py-4 border-b border-slate-100">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label className="block">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Nama analisa
            </span>
            <input
              className={inputClass}
              value={run.title}
              disabled={!canEdit}
              onChange={(e) => onPatch({ title: e.target.value })}
              placeholder="Contoh: Perbandingan pengambilan agen Oktober"
            />
          </label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="block">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Judul Laporan A
              </span>
              <input
                className={inputClass}
                value={run.labelA}
                disabled={!canEdit}
                onChange={(e) => onPatch({ labelA: e.target.value })}
                placeholder={isVarians ? 'Rencana / target' : 'Periode acuan'}
              />
            </label>
            <label className="block">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Judul Laporan B
              </span>
              <input
                className={inputClass}
                value={run.labelB}
                disabled={!canEdit}
                onChange={(e) => onPatch({ labelB: e.target.value })}
                placeholder={isVarians ? 'Capaian nyata' : 'Periode pembanding'}
              />
            </label>
          </div>
        </div>
        <p className="text-[11px] text-slate-500 mt-2.5 leading-relaxed">
          {isVarians
            ? 'Isi Laporan A dengan rencana atau target, lalu Laporan B dengan capaian sebenarnya.'
            : 'Isi Laporan A dengan periode acuan, lalu Laporan B dengan periode yang dibandingkan.'}
        </p>
      </div>

      <div className="px-4 sm:px-5 py-3.5 border-b border-slate-100 bg-slate-50/70">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Columns3 className="w-4 h-4 text-slate-400" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Kolom pembanding ({columns.length})
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={applyPickupExample}
              disabled={!canEdit}
              className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-[11px] font-bold text-slate-600 hover:border-emerald-400 disabled:opacity-40 cursor-pointer"
              title="Langsung isi kolom kuantitas, frekuensi ambil, dan total nominal"
            >
              Rekonsiliasi Agen
            </button>
            <button
              type="button"
              onClick={addColumn}
              disabled={!canEdit}
              className="px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-[11px] font-bold text-slate-700 flex items-center gap-1.5 hover:border-emerald-400 disabled:opacity-40 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5 text-emerald-600" />
              Tambah Kolom
            </button>
          </div>
        </div>
        <p className="text-[11px] text-slate-500 mt-2 leading-relaxed">
          Tiap kolom dinilai terpisah. Tambah kolom bila laporan punya lebih dari satu ukuran,
          misalnya kuantitas, frekuensi, nominal.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2 mt-2.5">
          {columns.map((column, index) => (
            <div key={column.id} className="rounded-xl border border-slate-200 bg-white p-2.5">
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-bold text-slate-400 shrink-0">
                  {index + 1}
                </span>
                <input
                  className={inputClass}
                  value={column.label}
                  disabled={!canEdit}
                  onChange={(e) => changeColumn(column.id, { label: e.target.value })}
                  placeholder="Nama kolom, contoh: Kuantitas"
                />
                <button
                  type="button"
                  onClick={() => removeColumn(column.id)}
                  disabled={!canEdit || columns.length <= 1}
                  className="p-2 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 disabled:opacity-40 shrink-0 cursor-pointer"
                  title={columns.length <= 1 ? 'Minimal satu kolom' : 'Hapus kolom ini'}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              <div className={`grid gap-1.5 mt-1.5 ${isVarians ? 'grid-cols-2' : 'grid-cols-1'}`}>
                <select
                  className={inputClass}
                  value={column.kind}
                  disabled={!canEdit}
                  onChange={(e) =>
                    changeColumn(column.id, {
                      kind: e.target.value === 'JUMLAH' ? 'JUMLAH' : 'UANG',
                    })
                  }
                  title="Cara angka kolom ini dibaca"
                >
                  <option value="UANG">Uang (Rp)</option>
                  <option value="JUMLAH">Jumlah (pcs, kali)</option>
                </select>
                {!isVarians ? null : (
                  <select
                    className={inputClass}
                    value={column.direction}
                    disabled={!canEdit}
                    onChange={(e) => {
                      const next = e.target.value;
                      changeColumn(column.id, {
                        direction: next === 'NAIK' || next === 'TURUN' ? next : 'ROW',
                      });
                    }}
                    title="Arah menguntungkan bila capaian naik"
                  >
                    <option value="ROW">Ikuti sifat baris</option>
                    <option value="NAIK">Naik menguntungkan</option>
                    <option value="TURUN">Turun menguntungkan</option>
                  </select>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-500">
              <th className="px-3 py-2 font-bold w-10" rowSpan={2}>
                No
              </th>
              <th className="px-3 py-2 font-bold min-w-[180px]" rowSpan={2}>
                Uraian
              </th>
              {columns.map((column) => (
                <th
                  key={column.id}
                  colSpan={2}
                  className="px-3 py-2 font-bold text-center border-l border-slate-200"
                >
                  {column.label.trim() || `Kolom ${columnKindLabel(column.kind)}`}
                  <span className="font-medium normal-case text-slate-400">
                    {' · '}
                    {columnKindLabel(column.kind)}
                  </span>
                </th>
              ))}
              {isVarians && (
                <th
                  className="px-3 py-2 font-bold w-40 border-l border-slate-200"
                  rowSpan={2}
                  title="Menentukan bagaimana selisih baris ini dibaca"
                >
                  Sifat baris
                </th>
              )}
              <th className="px-3 py-2 w-12" rowSpan={2}></th>
            </tr>
            <tr className="bg-slate-50/80 text-[10px] uppercase tracking-wider text-slate-400">
              {columns.map((column) => (
                <React.Fragment key={column.id}>
                  <th className="px-3 py-1.5 font-bold text-right w-32 border-l border-slate-200" title={run.labelA}>
                    A
                  </th>
                  <th className="px-3 py-1.5 font-bold text-right w-32" title={run.labelB}>
                    B
                  </th>
                </React.Fragment>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {run.rows.length === 0 && (
              <tr>
                <td
                  colSpan={2 + columns.length * 2 + (isVarians ? 1 : 0) + 1}
                  className="px-3 py-6 text-center text-xs text-slate-500"
                >
                  Belum ada baris. Tekan Tambah Baris untuk mulai mengisi.
                </td>
              </tr>
            )}
            {run.rows.map((row, index) => (
              <tr key={row.id} className="hover:bg-slate-50/70">
                <td className="px-3 py-2 text-[11px] font-bold text-slate-400">{index + 1}</td>
                <td className="px-3 py-2">
                  <input
                    className={inputClass}
                    value={row.label}
                    disabled={!canEdit}
                    onChange={(e) => changeLabel(row.id, e.target.value)}
                    placeholder="Nama baris, contoh: Agen Sari"
                  />
                </td>
                {columns.map((column) => (
                  <React.Fragment key={column.id}>
                    <td className="px-2 py-2 border-l border-slate-100">
                      <input
                        className={`${inputClass} text-right font-mono`}
                        value={showValue(row, column.id, 'A')}
                        inputMode="decimal"
                        disabled={!canEdit}
                        onChange={(e) => typeValue(row.id, column.id, 'A', e.target.value)}
                        onBlur={() => commitValue(row.id, column.id, 'A')}
                        placeholder="0"
                      />
                    </td>
                    <td className="px-2 py-2">
                      <input
                        className={`${inputClass} text-right font-mono`}
                        value={showValue(row, column.id, 'B')}
                        inputMode="decimal"
                        disabled={!canEdit}
                        onChange={(e) => typeValue(row.id, column.id, 'B', e.target.value)}
                        onBlur={() => commitValue(row.id, column.id, 'B')}
                        placeholder="0"
                      />
                    </td>
                  </React.Fragment>
                ))}
                {isVarians && (
                  <td className="px-3 py-2 border-l border-slate-100">
                    <select
                      className={inputClass}
                      value={row.nature}
                      disabled={!canEdit}
                      onChange={(e) => changeNature(row.id, e.target.value as ReconciliationRow['nature'])}
                      title="Pendapatan dan biaya dinilai untung/rugi; Perbandingan hanya membandingkan A dengan B"
                    >
                      {ROW_NATURES.map((nature) => (
                        <option key={nature} value={nature}>
                          {natureLabel(nature)}
                        </option>
                      ))}
                    </select>
                  </td>
                )}
                <td className="px-3 py-2 text-right">
                  <button
                    type="button"
                    onClick={() => removeRow(row.id)}
                    disabled={!canEdit}
                    className="p-2 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 disabled:opacity-40 cursor-pointer"
                    title="Hapus baris ini"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-slate-900 text-white">
              <td className="px-3 py-2.5 text-[11px] font-bold" colSpan={2}>
                Jumlah isian ({run.rows.length} baris)
              </td>
              {totals.map(({ column, a, b }) => (
                <React.Fragment key={column.id}>
                  <td className="px-3 py-2.5 text-right text-[11px] font-mono font-bold border-l border-slate-700">
                    {formatColumnValue(column.kind, a)}
                  </td>
                  <td className="px-3 py-2.5 text-right text-[11px] font-mono font-bold">
                    {formatColumnValue(column.kind, b)}
                  </td>
                </React.Fragment>
              ))}
              {!isVarians ? null : <td className="px-3 py-2.5"></td>}
              <td className="px-3 py-2.5"></td>
            </tr>
          </tfoot>
        </table>
      </div>

      {!isVarians ? null : (
        <div className="px-4 sm:px-5 py-2.5 border-t border-slate-100">
          <p className="text-[11px] text-slate-500 leading-relaxed">
            Sifat baris Perbandingan hanya membandingkan Laporan A dengan B.
            <br />
            Pilih Pendapatan atau Biaya/Beban bila selisihnya perlu dinilai untung atau rugi.
          </p>
        </div>
      )}

      <div className="px-4 sm:px-5 py-3.5 bg-slate-50 border-t border-slate-100 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => addRows(1)}
          disabled={!canEdit}
          className="px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs font-bold text-slate-700 flex items-center gap-1.5 hover:border-emerald-400 disabled:opacity-40 cursor-pointer"
        >
          <Plus className="w-4 h-4 text-emerald-600" />
          Tambah Baris
        </button>
        <button
          type="button"
          onClick={() => addRows(5)}
          disabled={!canEdit}
          className="px-3 py-2 rounded-xl bg-white border border-slate-200 text-xs font-bold text-slate-700 flex items-center gap-1.5 hover:border-emerald-400 disabled:opacity-40 cursor-pointer"
        >
          <Plus className="w-4 h-4 text-emerald-600" />
          Tambah 5 Baris
        </button>
        <button
          type="button"
          onClick={onExecute}
          className="ml-auto px-4 py-2.5 rounded-xl bg-emerald-600 text-white text-xs font-black flex items-center gap-2 hover:bg-emerald-700 shadow-xs cursor-pointer"
          title="Hitung selisih kedua laporan untuk setiap kolom"
        >
          <Play className="w-4 h-4" />
          Jalankan Analisa
        </button>
      </div>

      <div className="px-4 sm:px-5 py-3.5 border-t border-slate-100">
        <label className="block">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Catatan (tidak wajib)
          </span>
          <textarea
            className={`${inputClass} mt-1 min-h-[52px] font-medium`}
            value={run.notes}
            disabled={!canEdit}
            onChange={(e) => onPatch({ notes: e.target.value })}
            placeholder="Alasan selisih, sumber angka, atau tindak lanjut"
          />
        </label>
      </div>
    </div>
  );
};
