import { useState, useRef } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Upload, FileText, CheckCircle, AlertCircle, Loader2, Calendar, X, History, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const PROMPT = `Você é um extrator especializado de dados de boletos GNRE (Guia Nacional de Recolhimento de Tributos Estaduais) brasileiros.

Analise o PDF anexo e extraia EXATAMENTE os seguintes campos:

1. uf_favorecida: A sigla da UF Favorecida que aparece no canto superior direito do documento (ex: GO, SP, MG, RJ). NÃO confundir com a UF do emitente.
2. municipio: O Município do DESTINATÁRIO (Dados do Destinatário), não do emitente. Ex: "Goiânia", "São Paulo"
3. data_vencimento: A data no campo "Data de vencimento" no formato YYYY-MM-DD. Ex: 17/04/2026 → "2026-04-17"
4. valor: O valor do campo "Total a recolher" como número decimal. Ex: 21,04 → 21.04
5. linha_digitavel: O número da linha digitável que aparece ACIMA do código de barras, com espaços entre os grupos. Ex: "85820000000 7 21040297261 9 07012900002 8 61072676000 0"
6. codigo_barras: A sequência numérica longa que aparece na linha "Informações" ou abaixo da linha digitável, sem espaços. Ex: "35260415711947000188550030002491241844692499"

IMPORTANTE:
- O PDF pode ter 3 vias idênticas do mesmo boleto (1ª via Banco, 2ª via Contribuinte, 3ª via). Extraia apenas UMA vez.
- A linha digitável começa com 858 geralmente e tem grupos separados por espaço.
- Retorne null para campos que não encontrar.`;

export default function Importacao() {
  const queryClient = useQueryClient();
  const inputRef = useRef(null);
  const [dataLote, setDataLote] = useState('');
  const [files, setFiles] = useState([]);
  const [importing, setImporting] = useState(false);
  const [results, setResults] = useState([]);
  const [dragOver, setDragOver] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  const { data: gnres = [] } = useQuery({
    queryKey: ['gnres'],
    queryFn: () => base44.entities.GNRE.list('-created_date', 1000),
  });

  // Agrupar por data de lote para histórico
  const historicoLotes = Object.entries(
    gnres.reduce((acc, g) => {
      if (!g.data_lote) return acc;
      if (!acc[g.data_lote]) acc[g.data_lote] = [];
      acc[g.data_lote].push(g);
      return acc;
    }, {})
  ).sort((a, b) => b[0].localeCompare(a[0]));

  const handleFiles = (newFiles) => {
    const pdfs = Array.from(newFiles).filter(f => f.type === 'application/pdf');
    setFiles(prev => {
      const existing = new Set(prev.map(f => f.name));
      return [...prev, ...pdfs.filter(f => !existing.has(f.name))];
    });
  };

  const removeFile = (name) => setFiles(prev => prev.filter(f => f.name !== name));

  const computeHash = async (file) => {
    const buf = await file.arrayBuffer();
    const hash = await crypto.subtle.digest('SHA-256', buf);
    return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('');
  };

  const processFile = async (file, existingHashes) => {
    const hash = await computeHash(file);
    if (existingHashes.has(hash)) {
      return { name: file.name, status: 'duplicado', message: 'Já importado anteriormente' };
    }
    // Upload e extração em paralelo (upload primeiro, depois LLM)
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    const extracted = await base44.integrations.Core.InvokeLLM({
      prompt: PROMPT,
      file_urls: [file_url],
      response_json_schema: {
        type: 'object',
        properties: {
          uf_favorecida: { type: 'string' },
          municipio: { type: 'string' },
          data_vencimento: { type: 'string' },
          valor: { type: 'number' },
          codigo_barras: { type: 'string' },
          linha_digitavel: { type: 'string' },
        }
      }
    });
    await base44.entities.GNRE.create({
      ...extracted,
      data_lote: dataLote,
      nome_arquivo: file.name,
      hash_arquivo: hash,
      file_url,
      status: 'pendente',
    });
    return { name: file.name, status: 'sucesso', data: extracted };
  };

  const handleImport = async () => {
    if (!dataLote) { alert('Selecione a data do lote antes de importar.'); return; }
    if (files.length === 0) { alert('Adicione ao menos um arquivo PDF.'); return; }

    setImporting(true);
    setResults([]);

    const existing = await base44.entities.GNRE.list('-created_date', 1000);
    const existingHashes = new Set(existing.map(g => g.hash_arquivo).filter(Boolean));

    // Processar TODOS os arquivos em paralelo para máxima velocidade
    const promises = files.map(file =>
      processFile(file, existingHashes).catch(err => ({
        name: file.name, status: 'erro', message: err.message || 'Erro ao processar'
      }))
    );

    const newResults = await Promise.all(promises);
    setResults(newResults);

    await queryClient.invalidateQueries({ queryKey: ['gnres'] });
    setImporting(false);
    setFiles([]);
  };

  return (
    <div className="p-6 md:p-10 min-h-screen">
      <div className="mb-8">
        <h1 className="text-3xl font-syne font-bold text-foreground">Importação</h1>
        <p className="text-muted-foreground mt-1">Importe seus boletos GNRE em PDF</p>
      </div>

      <div className="max-w-2xl space-y-6">
        {/* Data do lote */}
        <div className="bg-card border border-border rounded-2xl p-6 space-y-3">
          <Label htmlFor="dataLote" className="text-sm font-semibold flex items-center gap-2">
            <Calendar className="w-4 h-4 text-primary" />
            Data do Lote
          </Label>
          <Input
            id="dataLote"
            type="date"
            value={dataLote}
            onChange={e => setDataLote(e.target.value)}
            className="max-w-xs"
          />
          <p className="text-xs text-muted-foreground">Selecione a data de referência deste lote de arquivos.</p>
        </div>

        {/* Drop zone */}
        <div
          className={`border-2 border-dashed rounded-2xl p-10 text-center transition-all duration-200 cursor-pointer ${
            dragOver ? 'border-primary bg-accent/50' : 'border-border hover:border-primary/50 hover:bg-muted/30'
          }`}
          onClick={() => inputRef.current?.click()}
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={e => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files); }}
        >
          <Upload className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="font-semibold text-foreground">Arraste PDFs aqui ou clique para selecionar</p>
          <p className="text-sm text-muted-foreground mt-1">Somente arquivos PDF são aceitos</p>
          <input ref={inputRef} type="file" accept=".pdf" multiple className="hidden" onChange={e => handleFiles(e.target.files)} />
        </div>

        {/* File list */}
        {files.length > 0 && (
          <div className="bg-card border border-border rounded-2xl p-4 space-y-2">
            <p className="text-sm font-semibold text-foreground mb-2">{files.length} arquivo(s) selecionado(s)</p>
            {files.map(f => (
              <div key={f.name} className="flex items-center justify-between py-2 px-3 rounded-lg bg-muted/40">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-primary shrink-0" />
                  <span className="text-sm text-foreground truncate max-w-xs">{f.name}</span>
                </div>
                <button onClick={() => removeFile(f.name)} className="text-muted-foreground hover:text-destructive transition-colors">
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Import button */}
        <Button
          onClick={handleImport}
          disabled={importing || files.length === 0 || !dataLote}
          className="w-full h-12 text-base font-semibold"
        >
          {importing ? (
            <><Loader2 className="w-5 h-5 mr-2 animate-spin" /> Processando {files.length} arquivo(s) em paralelo...</>
          ) : (
            <><Upload className="w-5 h-5 mr-2" /> Importar {files.length > 0 ? `${files.length} arquivo(s)` : 'PDFs'}</>
          )}
        </Button>

        {/* Results */}
        {results.length > 0 && (
          <div className="bg-card border border-border rounded-2xl p-4 space-y-2">
            <p className="text-sm font-semibold text-foreground mb-2">Resultado da importação</p>
            {results.map((r, i) => (
              <div key={i} className={`flex items-start gap-3 py-2 px-3 rounded-lg ${
                r.status === 'sucesso' ? 'bg-green-50' : r.status === 'duplicado' ? 'bg-yellow-50' : 'bg-red-50'
              }`}>
                {r.status === 'sucesso' && <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 shrink-0" />}
                {r.status === 'duplicado' && <AlertCircle className="w-4 h-4 text-yellow-600 mt-0.5 shrink-0" />}
                {r.status === 'erro' && <AlertCircle className="w-4 h-4 text-red-600 mt-0.5 shrink-0" />}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{r.name}</p>
                  {r.status === 'sucesso' && r.data && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {r.data.uf_favorecida} — {r.data.municipio} — Vence: {r.data.data_vencimento} — R$ {r.data.valor?.toFixed(2)}
                    </p>
                  )}
                  {r.message && <p className="text-xs text-muted-foreground mt-0.5">{r.message}</p>}
                </div>
                <Badge variant="outline" className={`text-xs shrink-0 ${
                  r.status === 'sucesso' ? 'text-green-700 border-green-300' :
                  r.status === 'duplicado' ? 'text-yellow-700 border-yellow-300' :
                  'text-red-700 border-red-300'
                }`}>
                  {r.status === 'sucesso' ? 'Importado' : r.status === 'duplicado' ? 'Duplicado' : 'Erro'}
                </Badge>
              </div>
            ))}
          </div>
        )}

        {/* Histórico de lotes */}
        <div className="bg-card border border-border rounded-2xl overflow-hidden">
          <button
            className="w-full flex items-center justify-between p-5 text-left hover:bg-muted/30 transition-colors"
            onClick={() => setShowHistory(v => !v)}
          >
            <div className="flex items-center gap-2">
              <History className="w-4 h-4 text-primary" />
              <span className="text-sm font-semibold text-foreground">Histórico de Importações</span>
              <Badge variant="secondary" className="text-xs">{historicoLotes.length} lote(s)</Badge>
            </div>
            {showHistory ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
          </button>

          {showHistory && (
            <div className="border-t border-border divide-y divide-border">
              {historicoLotes.length === 0 ? (
                <p className="text-sm text-muted-foreground p-5 text-center">Nenhum lote importado ainda.</p>
              ) : (
                historicoLotes.map(([data, items]) => {
                  const pendentes = items.filter(g => g.status === 'pendente').length;
                  const pagos = items.filter(g => g.status === 'pago').length;
                  const total = items.reduce((s, g) => s + (g.valor || 0), 0);
                  return (
                    <div key={data} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3">
                      <div>
                        <p className="text-sm font-medium text-foreground">
                          Lote {format(new Date(data + 'T12:00:00'), "dd/MM/yyyy", { locale: ptBR })}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {items.length} boleto(s) · {pendentes} pendente(s) · {pagos} pago(s)
                        </p>
                      </div>
                      <span className="text-sm font-semibold text-primary">
                        {total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
