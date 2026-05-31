import { useState, useMemo } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, Download, FileText } from 'lucide-react';
import { addMonths, subMonths } from 'date-fns';

const COLORS = ['#1d4ed8', '#2563eb', '#3b82f6', '#60a5fa', '#93c5fd', '#bfdbfe', '#1e40af', '#1e3a8a'];

const formatBRL = (v) =>
  (v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

export default function Relatorios() {
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const { data: gnres = [] } = useQuery({
    queryKey: ['gnres'],
    queryFn: () => base44.entities.GNRE.list('-data_vencimento', 1000),
  });

  const start = startOfMonth(currentMonth);
  const end = endOfMonth(currentMonth);

  const filtered = useMemo(() =>
    gnres.filter(g => {
      if (!g.data_vencimento) return false;
      const d = new Date(g.data_vencimento + 'T12:00:00');
      return d >= start && d <= end;
    }), [gnres, currentMonth]);

  // Totals
  const totalPago = filtered.filter(g => g.status === 'pago').reduce((s, g) => s + (g.valor || 0), 0);
  const totalNaoPago = filtered.filter(g => g.status === 'nao_pago').reduce((s, g) => s + (g.valor || 0), 0);
  const totalPendente = filtered.filter(g => g.status === 'pendente').reduce((s, g) => s + (g.valor || 0), 0);

  // Chart data: total value per UF
  const chartData = useMemo(() => {
    const map = {};
    filtered.forEach(g => {
      const uf = g.uf_favorecida || 'N/A';
      map[uf] = (map[uf] || 0) + (g.valor || 0);
    });
    return Object.entries(map)
      .map(([uf, total]) => ({ uf, total }))
      .sort((a, b) => b.total - a.total);
  }, [filtered]);

  // Export XLS (CSV tab-separated, opens in Excel)
  const exportXLS = () => {
    const headers = ['UF', 'Município', 'Status', 'Valor (R$)', 'Vencimento', 'Linha Digitável', 'Cód. Barras', 'Nº Controle', 'Nº Doc. Origem'];
    const rows = filtered.map(g => [
      g.uf_favorecida || '',
      g.municipio || '',
      statusLabel(g.status),
      (g.valor || 0).toFixed(2).replace('.', ','),
      g.data_vencimento || '',
      g.linha_digitavel || '',
      g.codigo_barras || '',
      g.numero_controle || '',
      g.numero_documento_origem || '',
    ]);
    const csv = [headers, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join('\t')).join('\n');
    download('relatorio-gnre.xls', '\uFEFF' + csv, 'application/vnd.ms-excel');
  };

  const exportPDF = () => {
    const month = format(currentMonth, 'MMMM yyyy', { locale: ptBR });
    const rows = filtered.map(g =>
      `<tr>
        <td>${g.uf_favorecida || '—'}</td>
        <td>${g.municipio || '—'}</td>
        <td>${(g.valor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</td>
        <td>${statusLabel(g.status)}</td>
        <td>${g.data_vencimento || '—'}</td>
        <td>${g.linha_digitavel || '—'}</td>
        <td>${g.numero_controle || '—'}</td>
        <td>${g.numero_documento_origem || '—'}</td>
      </tr>`
    ).join('');

    const html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>Relatório GNRE - ${month}</title>
<style>
  body { font-family: Arial, sans-serif; padding: 24px; }
  h1 { font-size: 20px; margin-bottom: 8px; }
  table { border-collapse: collapse; width: 100%; font-size: 11px; }
  th, td { border: 1px solid #ccc; padding: 5px 8px; text-align: left; }
  th { background: #1d4ed8; color: white; }
  tr:nth-child(even) { background: #f3f4f6; }
</style></head>
<body>
  <h1>Relatório GNRE — ${month}</h1>
  <p>Total pago: ${formatBRL(totalPago)} | Não pago: ${formatBRL(totalNaoPago)} | Pendente: ${formatBRL(totalPendente)} | Total Geral: ${formatBRL(totalPago + totalNaoPago + totalPendente)}</p>
  <table>
    <thead><tr><th>UF</th><th>Município</th><th>Valor</th><th>Status</th><th>Vencimento</th><th>Linha Digitável</th><th>Nº Controle</th><th>Nº Doc. Origem</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
</body></html>`;

    const win = window.open('', '_blank');
    win.document.write(html);
    win.document.close();
    win.print();
  };

  const download = (filename, content, type) => {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const statusLabel = (s) => {
    if (s === 'pago') return 'Pago';
    if (s === 'nao_pago') return 'Não Pago';
    return 'Pendente';
  };

  return (
    <div className="p-6 md:p-10 min-h-screen">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-syne font-bold text-foreground">Relatórios</h1>
        <p className="text-muted-foreground mt-1">Análise mensal de GNRE por estado e status</p>
      </div>

      {/* Month selector */}
      <div className="flex items-center gap-4 mb-8">
        <Button variant="outline" size="icon" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
          <ChevronLeft className="w-4 h-4" />
        </Button>
        <h2 className="text-xl font-syne font-bold text-foreground capitalize w-48 text-center">
          {format(currentMonth, 'MMMM yyyy', { locale: ptBR })}
        </h2>
        <Button variant="outline" size="icon" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-8">
        <div className="bg-green-50 border border-green-200 rounded-2xl p-5">
          <p className="text-sm text-green-700 font-medium mb-1">Total Pago</p>
          <p className="text-2xl font-syne font-bold text-green-700">{formatBRL(totalPago)}</p>
          <p className="text-xs text-green-600 mt-1">{filtered.filter(g => g.status === 'pago').length} boletos</p>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-2xl p-5">
          <p className="text-sm text-red-700 font-medium mb-1">Total Não Pago</p>
          <p className="text-2xl font-syne font-bold text-red-700">{formatBRL(totalNaoPago)}</p>
          <p className="text-xs text-red-600 mt-1">{filtered.filter(g => g.status === 'nao_pago').length} boletos</p>
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5">
          <p className="text-sm text-amber-700 font-medium mb-1">Total Pendente</p>
          <p className="text-2xl font-syne font-bold text-amber-700">{formatBRL(totalPendente)}</p>
          <p className="text-xs text-amber-600 mt-1">{filtered.filter(g => g.status === 'pendente').length} boletos</p>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-2xl p-5">
          <p className="text-sm text-blue-700 font-medium mb-1">Total Geral</p>
          <p className="text-2xl font-syne font-bold text-blue-700">{formatBRL(totalPago + totalNaoPago + totalPendente)}</p>
          <p className="text-xs text-blue-600 mt-1">{filtered.length} boletos</p>
        </div>
      </div>

      {/* Chart */}
      <div className="bg-card border border-border rounded-2xl p-6 mb-8">
        <h3 className="text-base font-syne font-bold text-foreground mb-4">Valores por Estado (UF)</h3>
        {chartData.length === 0 ? (
          <p className="text-muted-foreground text-sm text-center py-10">Nenhum dado para o período selecionado.</p>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={chartData} margin={{ top: 4, right: 16, left: 8, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="uf" tick={{ fontSize: 12 }} />
              <YAxis tickFormatter={(v) => `R$ ${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v) => formatBRL(v)} labelFormatter={(l) => `UF: ${l}`} />
              <Bar dataKey="total" radius={[6, 6, 0, 0]}>
                {chartData.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Export */}
      <div className="bg-card border border-border rounded-2xl p-6">
        <h3 className="text-base font-syne font-bold text-foreground mb-2">Exportar Relatório</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Exportar relação completa de {filtered.length} GNRE do período com status e datas.
        </p>
        <div className="flex gap-3 flex-wrap">
          <Button variant="outline" onClick={exportXLS} className="gap-2">
            <Download className="w-4 h-4" />
            Exportar XLS (Excel)
          </Button>
          <Button variant="outline" onClick={exportPDF} className="gap-2">
            <FileText className="w-4 h-4" />
            Exportar / Imprimir PDF
          </Button>
        </div>
      </div>
    </div>
  );
}
