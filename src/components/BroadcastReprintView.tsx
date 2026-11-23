import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Check,
  Copy,
  Download,
  FileImage,
  FileSpreadsheet,
  Image as ImageIcon,
  MapPin,
  Printer,
  UserCheck,
} from 'lucide-react';
import { AgendaItem, ConflictDetail, UserProfile } from '../types/agenda';
import {
  downloadAgendaCsv,
  formatTanggalIndonesia,
  generateLeadershipWA,
  generateStaffGroupWA,
  sortAgendasChronological,
} from '../utils/agendaHelpers';
import {
  copyPosterImageToClipboard,
  downloadPosterImage,
  renderAgendaPosterCanvas,
} from '../utils/posterGenerator';
import { getCapabilities, safeExternalUrl } from '../utils/rbac';
import { BpbdEmblem } from './BpbdEmblem';

interface BroadcastReprintViewProps {
  currentUser: UserProfile;
  agendas: AgendaItem[];
  selectedDate: string;
  onChangeDate: (date: string) => void;
  conflictsMap: Map<string, ConflictDetail>;
}

export const BroadcastReprintView: React.FC<BroadcastReprintViewProps> = ({
  currentUser,
  agendas,
  selectedDate,
  onChangeDate,
  conflictsMap,
}) => {
  const caps = getCapabilities(currentUser.roleCode);
  const [waMode, setWaMode] = useState<'pimpinan' | 'pegawai'>('pegawai');
  const [visualMode, setVisualMode] = useState<'poster' | 'print'>('poster');

  const [includeDisposisi, setIncludeDisposisi] = useState(true);
  const [includeConflictNote, setIncludeConflictNote] = useState(true);
  const [onlyUpdates, setOnlyUpdates] = useState(false);

  const [showPosterUpdateTag, setShowPosterUpdateTag] = useState(true);
  const [showPosterConflictTag, setShowPosterConflictTag] = useState(false);
  const [includePosterZoomLink, setIncludePosterZoomLink] = useState(false);
  const [showPosterThumbnails, setShowPosterThumbnails] = useState(true);

  const [copiedMode, setCopiedMode] = useState<'pimpinan' | 'pegawai' | null>(
    null
  );
  const [copiedImage, setCopiedImage] = useState<'ok' | 'unsupported' | null>(
    null
  );

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const dayAgendas = useMemo(
    () =>
      sortAgendasChronological(
        agendas.filter((a) => {
          if (a.tanggal !== selectedDate) return false;
          if (onlyUpdates && a.status !== 'Update / Baru') return false;
          return true;
        })
      ),
    [agendas, selectedDate, onlyUpdates]
  );

  const leadershipText = useMemo(
    () =>
      generateLeadershipWA(agendas, selectedDate, conflictsMap, {
        includeDisposisi,
        includeConflictNote,
        onlyUpdates,
      }),
    [
      agendas,
      selectedDate,
      conflictsMap,
      includeDisposisi,
      includeConflictNote,
      onlyUpdates,
    ]
  );

  const staffGroupText = useMemo(
    () =>
      generateStaffGroupWA(agendas, selectedDate, conflictsMap, {
        includeDisposisi,
        includeConflictNote,
        onlyUpdates,
      }),
    [
      agendas,
      selectedDate,
      conflictsMap,
      includeDisposisi,
      includeConflictNote,
      onlyUpdates,
    ]
  );

  const activeMessage = waMode === 'pimpinan' ? leadershipText : staffGroupText;

  // Render live Canvas Poster whenever agendas, date, or poster options change
  useEffect(() => {
    let active = true;
    const draw = async () => {
      if (document.fonts && document.fonts.ready) {
        try {
          await document.fonts.ready;
        } catch {
          // ignore
        }
      }
      if (!active || !canvasRef.current) return;
      await renderAgendaPosterCanvas(
        canvasRef.current,
        agendas,
        selectedDate,
        conflictsMap,
        {
          showConflictTag: showPosterConflictTag,
          showUpdateTag: showPosterUpdateTag,
          includeZoomLink: includePosterZoomLink,
          showThumbnails: showPosterThumbnails,
          onlyUpdates,
        }
      );
    };
    void draw();
    return () => {
      active = false;
    };
  }, [
    agendas,
    selectedDate,
    conflictsMap,
    showPosterConflictTag,
    showPosterUpdateTag,
    includePosterZoomLink,
    showPosterThumbnails,
    onlyUpdates,
    visualMode,
  ]);

  const handleCopyWA = async (target: 'pimpinan' | 'pegawai') => {
    const text = target === 'pimpinan' ? leadershipText : staffGroupText;
    try {
      await navigator.clipboard.writeText(text);
      setCopiedMode(target);
      setTimeout(() => setCopiedMode(null), 2000);
    } catch {
      // Fallback ignored
    }
  };

  const handleDownloadPoster = (format: 'png' | 'jpg') => {
    if (!canvasRef.current) return;
    downloadPosterImage(canvasRef.current, selectedDate, format);
  };

  const handleCopyPosterImage = async () => {
    if (!canvasRef.current) return;
    const ok = await copyPosterImageToClipboard(canvasRef.current);
    setCopiedImage(ok ? 'ok' : 'unsupported');
    setTimeout(() => setCopiedImage(null), 2500);
  };

  const handlePrintPdf = () => {
    setVisualMode('print');
    setTimeout(() => {
      window.print();
    }, 80);
  };

  const conflictCount = Array.from(conflictsMap.values()).filter(
    (c) => c.severity === 'tinggi'
  ).length;
  const updateCount = dayAgendas.filter(
    (a) => a.status === 'Update / Baru'
  ).length;

  return (
    <div className="space-y-6">
      {/* Header Controls (Hidden on Print) */}
      <div className="no-print flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="text-xs font-medium text-sky-700">
            Distribusi Informasi Resmi & Rekap Visual Grup WA
          </div>
          <h2 className="mt-0.5 text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            {caps.canBroadcastWA
              ? 'Poster Gambar WA, Pesan Teks & Cetak Harian'
              : 'Poster Gambar WA & Kartu Agenda Harian'}
          </h2>
          <p className="mt-1 text-sm text-slate-600">
            Unduh poster infografis agenda harian (PNG/JPG) siap kirim ke Grup
            WhatsApp, salin pesan teks WA, atau cetak kartu A4/PDF.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => onChangeDate(e.target.value)}
            aria-label="Pilih tanggal rekap"
            className="px-3 py-2 text-sm font-medium bg-white border border-slate-200 rounded-lg text-slate-800 tabular-nums focus:outline-none focus:border-sky-600"
          />

          <button
            type="button"
            onClick={() => downloadAgendaCsv(agendas, selectedDate)}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs sm:text-sm font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-lg transition-colors whitespace-nowrap"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-700" />
            <span>Ekspor CSV</span>
          </button>

          <button
            type="button"
            onClick={handlePrintPdf}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs sm:text-sm font-medium text-white bg-[#0F294A] hover:bg-[#163A66] rounded-lg transition-colors whitespace-nowrap"
          >
            <Printer className="w-4 h-4" />
            <span>Cetak / PDF</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {caps.canBroadcastWA && (
          <div className="no-print xl:col-span-5 bg-white border border-slate-200 rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-slate-900">
                Generator Pesan Teks WhatsApp
              </h3>
            </div>

            <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-lg">
              <button
                type="button"
                onClick={() => setWaMode('pimpinan')}
                className={`px-3 py-2 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
                  waMode === 'pimpinan'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Ringkasan Pimpinan
              </button>
              <button
                type="button"
                onClick={() => setWaMode('pegawai')}
                className={`px-3 py-2 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
                  waMode === 'pegawai'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Grup WA Pegawai
              </button>
            </div>

            <div className="space-y-2 text-xs text-slate-700 pt-1">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeDisposisi}
                  onChange={(e) => setIncludeDisposisi(e.target.checked)}
                  className="rounded border-slate-300 text-sky-700 focus:ring-sky-600"
                />
                <span>Sertakan catatan disposisi & arahan pimpinan</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeConflictNote}
                  onChange={(e) => setIncludeConflictNote(e.target.checked)}
                  className="rounded border-slate-300 text-sky-700 focus:ring-sky-600"
                />
                <span>Sertakan penanda peringatan bentrok jam WIB</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={onlyUpdates}
                  onChange={(e) => setOnlyUpdates(e.target.checked)}
                  className="rounded border-slate-300 text-sky-700 focus:ring-sky-600"
                />
                <span>Hanya tampilkan agenda berstatus [Update / Baru]</span>
              </label>
            </div>

            <div>
              <div className="flex items-center justify-between text-xs text-slate-500 mb-1.5">
                <span>
                  Pratinjau teks (
                  {waMode === 'pimpinan'
                    ? 'Format Pimpinan'
                    : 'Format Kronologis Grup WA'}
                  )
                </span>
                <span className="font-mono tabular-nums">
                  {activeMessage.length} karakter
                </span>
              </div>
              <textarea
                readOnly
                rows={15}
                value={activeMessage}
                className="w-full px-3.5 py-3 text-xs font-mono bg-slate-50 border border-slate-200 rounded-lg text-slate-800 leading-relaxed focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
              <button
                type="button"
                onClick={() => handleCopyWA('pimpinan')}
                className="inline-flex items-center justify-center gap-2 px-3.5 py-2.5 text-xs font-semibold text-white bg-[#0F294A] hover:bg-[#163A66] rounded-lg transition-colors whitespace-nowrap"
              >
                {copiedMode === 'pimpinan' ? (
                  <>
                    <Check className="w-4 h-4 text-emerald-300" />
                    <span>Ringkasan Tersalin</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    <span>Salin Ringkasan Pimpinan</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => handleCopyWA('pegawai')}
                className="inline-flex items-center justify-center gap-2 px-3.5 py-2.5 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg transition-colors whitespace-nowrap"
              >
                {copiedMode === 'pegawai' ? (
                  <>
                    <Check className="w-4 h-4 text-emerald-200" />
                    <span>Pesan Grup Tersalin</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    <span>Salin Pesan Grup WA Pegawai</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Right: Poster Gambar WhatsApp + Kartu Cetak Harian */}
        <div
          className={`${
            caps.canBroadcastWA ? 'xl:col-span-7' : 'xl:col-span-12'
          } space-y-4`}
        >
          {/* Mode Switcher Bar (Hidden on Print) */}
          <div className="no-print bg-white border border-slate-200 rounded-xl p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="inline-flex items-center gap-1 p-1 bg-slate-100 rounded-lg">
                <button
                  type="button"
                  onClick={() => setVisualMode('poster')}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
                    visualMode === 'poster'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <ImageIcon className="w-3.5 h-3.5 text-orange-600" />
                  <span>Poster Gambar Grup WA</span>
                </button>
                <button
                  type="button"
                  onClick={() => setVisualMode('print')}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-colors whitespace-nowrap ${
                    visualMode === 'print'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Printer className="w-3.5 h-3.5 text-sky-700" />
                  <span>Kartu Cetak A4 / PDF</span>
                </button>
              </div>

              {visualMode === 'poster' && (
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={handleCopyPosterImage}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap"
                  >
                    {copiedImage === 'ok' ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Gambar Tersalin (Ctrl+V di WA)</span>
                      </>
                    ) : copiedImage === 'unsupported' ? (
                      <span>Gunakan Unduh PNG/JPG</span>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Salin Gambar</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => handleDownloadPoster('jpg')}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-sky-800 bg-sky-50 border border-sky-200 hover:bg-sky-100 rounded-lg transition-colors whitespace-nowrap"
                  >
                    <FileImage className="w-3.5 h-3.5" />
                    <span>Unduh JPG</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleDownloadPoster('png')}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-[#EA580C] hover:bg-[#C2410C] rounded-lg transition-colors whitespace-nowrap"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Unduh Gambar WA (PNG)</span>
                  </button>
                </div>
              )}
            </div>

            {visualMode === 'poster' && (
              <div className="flex flex-wrap items-center gap-x-5 gap-y-2 pt-2 border-t border-slate-100 text-xs text-slate-600">
                <label className="inline-flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showPosterUpdateTag}
                    onChange={(e) => setShowPosterUpdateTag(e.target.checked)}
                    className="rounded border-slate-300 text-sky-700 focus:ring-sky-600"
                  />
                  <span>Tandai agenda [UPDATE / BARU]</span>
                </label>

                <label className="inline-flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showPosterConflictTag}
                    onChange={(e) => setShowPosterConflictTag(e.target.checked)}
                    className="rounded border-slate-300 text-sky-700 focus:ring-sky-600"
                  />
                  <span>Tampilkan penanda Bentrok Jam di poster</span>
                </label>

                <label className="inline-flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includePosterZoomLink}
                    onChange={(e) => setIncludePosterZoomLink(e.target.checked)}
                    className="rounded border-slate-300 text-sky-700 focus:ring-sky-600"
                  />
                  <span>Sertakan URL tautan Zoom di poster</span>
                </label>

                <label className="inline-flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showPosterThumbnails}
                    onChange={(e) => setShowPosterThumbnails(e.target.checked)}
                    className="rounded border-slate-300 text-sky-700 focus:ring-sky-600"
                  />
                  <span>Tampilkan foto ilustrasi kegiatan</span>
                </label>
              </div>
            )}
          </div>

          {/* Live Canvas Poster Preview */}
          <div
            className={`${
              visualMode === 'poster' ? 'block' : 'hidden'
            } no-print bg-white border border-slate-200 rounded-xl p-4`}
          >
            <div className="mx-auto max-w-[680px] border border-slate-200 rounded-lg overflow-hidden bg-slate-100">
              <canvas
                ref={canvasRef}
                className="w-full h-auto block"
                aria-label={`Pratinjau poster gambar agenda ${formatTanggalIndonesia(selectedDate)}`}
              />
            </div>
          </div>

          {/* Printable Formal A4 Sheet */}
          <div
            className={`${
              visualMode === 'print' ? 'block' : 'hidden print:block'
            } print-only-container`}
          >
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <div className="bg-[#0F294A] text-white px-6 py-5 flex items-center justify-between gap-4">
                <div className="flex items-center gap-4 min-w-0">
                  <BpbdEmblem className="w-12 h-12 shrink-0" />
                  <div className="min-w-0">
                    <div className="text-xs font-medium text-sky-200 tracking-wide">
                      PEMERINTAH KABUPATEN SIDOARJO
                    </div>
                    <div className="text-base sm:text-lg font-bold tracking-tight text-white">
                      BADAN PENANGGULANGAN BENCANA DAERAH
                    </div>
                    <div className="text-xs text-slate-300 mt-0.5">
                      Papan Agenda Kegiatan Harian · Jl. Raya Kemiri No. 1
                      Sidoarjo
                    </div>
                  </div>
                </div>

                <div className="text-right shrink-0 hidden sm:block">
                  <div className="text-xs text-sky-200">Tanggal Jadwal</div>
                  <div className="text-sm font-bold text-white">
                    {formatTanggalIndonesia(selectedDate)}
                  </div>
                </div>
              </div>

              <div className="px-6 py-3 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-700">
                <div className="font-semibold text-slate-900">
                  {formatTanggalIndonesia(selectedDate)}
                </div>
                <div className="flex items-center gap-3 font-mono tabular-nums">
                  <span>Total: {dayAgendas.length} kegiatan</span>
                  {updateCount > 0 && (
                    <>
                      <span className="text-slate-300">·</span>
                      <span className="text-amber-700 font-semibold">
                        {updateCount} Update/Baru
                      </span>
                    </>
                  )}
                  {conflictCount > 0 && (
                    <>
                      <span className="text-slate-300">·</span>
                      <span className="text-red-700 font-semibold">
                        {conflictCount} Jam Paralel
                      </span>
                    </>
                  )}
                </div>
              </div>

              {dayAgendas.length === 0 ? (
                <div className="p-10 text-center text-sm text-slate-500">
                  Tidak ada agenda tercatat untuk tanggal{' '}
                  {formatTanggalIndonesia(selectedDate)}.
                </div>
              ) : (
                <div className="divide-y divide-slate-200">
                  {dayAgendas.map((item, index) => {
                    const conflict = conflictsMap.get(item.id);
                    const safeUrl = safeExternalUrl(item.tautanDaring);
                    return (
                      <div
                        key={item.id}
                        className="px-6 py-4 flex flex-col sm:flex-row gap-4"
                      >
                        <div className="sm:w-36 shrink-0">
                          <div className="text-xs text-slate-400 font-mono tabular-nums">
                            Agenda #{String(index + 1).padStart(2, '0')}
                          </div>
                          <div className="mt-0.5 text-sm font-bold font-mono tabular-nums text-[#0F294A]">
                            {item.jamMulai.replace(':', '.')} WIB
                          </div>
                          <div className="text-xs font-mono tabular-nums text-slate-500">
                            s.d.{' '}
                            {item.jamSelesai.toLowerCase() === 'selesai'
                              ? 'Selesai'
                              : `${item.jamSelesai.replace(':', '.')} WIB`}
                          </div>
                        </div>

                        <div className="flex-1 min-w-0 space-y-1.5">
                          <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs">
                            <span className="font-medium text-sky-800">
                              {item.jenisKegiatan}
                            </span>
                            {item.status === 'Update / Baru' && (
                              <>
                                <span className="text-slate-300">·</span>
                                <span className="font-bold text-amber-700">
                                  [UPDATE / BARU]
                                </span>
                              </>
                            )}
                            {(item.status === 'Ditunda' ||
                              item.status === 'Dibatalkan') && (
                              <>
                                <span className="text-slate-300">·</span>
                                <span className="font-bold text-red-700">
                                  [{item.status.toUpperCase()}]
                                </span>
                              </>
                            )}
                            {conflict?.severity === 'tinggi' && (
                              <>
                                <span className="text-slate-300">·</span>
                                <span className="inline-flex items-center gap-1 font-semibold text-red-700">
                                  <AlertTriangle className="w-3 h-3" />
                                  Jam Paralel
                                </span>
                              </>
                            )}
                          </div>

                          <div className="text-sm font-semibold text-slate-900 leading-snug">
                            {item.namaKegiatan}
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-xs text-slate-700 pt-0.5">
                            <div className="flex items-start gap-1.5">
                              <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                              <span>
                                {item.lokasi}
                                {safeUrl ? ` (${safeUrl})` : ''}
                              </span>
                            </div>
                            <div className="flex items-start gap-1.5 font-semibold text-slate-900">
                              <UserCheck className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                              <span>{item.pic}</span>
                            </div>
                          </div>

                          {includeDisposisi && item.catatanDisposisi && (
                            <div className="text-xs text-slate-600 pt-0.5">
                              Catatan: {item.catatanDisposisi}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                <span>
                  Disusun oleh Pengadministrasi Umum · Subbag. Umpeg BPBD Kab.
                  Sidoarjo
                </span>
                <span className="no-print inline-flex items-center gap-1.5 text-sky-700 font-medium">
                  <Download className="w-3.5 h-3.5" />
                  Gunakan tombol Cetak / PDF di atas untuk menyimpan dokumen
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
