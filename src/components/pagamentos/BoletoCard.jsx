import { useState } from 'react';
import { Copy, Check, CheckCircle, XCircle, Undo2, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

const getValorColor = (valor) => {
  if (valor < 20) return { bg: 'bg-green-100', border: 'border-green-300', text: 'text-green-700', dot: 'bg-green-500', label: '< R$ 20' };
  if (valor <= 40) return { bg: 'bg-yellow-100', border: 'border-yellow-300', text: 'text-yellow-700', dot: 'bg-yellow-500', label: 'R$ 20 – R$ 40' };
  return { bg: 'bg-red-100', border: 'border-red-300', text: 'text-red-700', dot: 'bg-red-500', label: '> R$ 40' };
};

export default function BoletoCard({ boleto, onStatusChange }) {
  const [copied, setCopied] = useState(false);
  const [pending, setPending] = useState(null); // 'pago' | 'nao_pago'
  const [countdown, setCountdown] = useState(null);

  const colors = getValorColor(boleto.valor || 0);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(boleto.linha_digitavel || '');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleAction = (status) => {
    setPending(status);
    let seconds = 3;
    setCountdown(seconds);
    const interval = setInterval(() => {
      seconds -= 1;
      setCountdown(seconds);
      if (seconds <= 0) {
        clearInterval(interval);
        onStatusChange(boleto.id, status);
        setPending(null);
        setCountdown(null);
      }
    }, 1000);
  };

  const handleUndo = () => {
    setPending(null);
    setCountdown(null);
  };

  return (
    <div className={`bg-card border-2 ${colors.border} rounded-2xl p-5 transition-all duration-200`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        {/* Left info */}
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <div className={`w-3 h-3 rounded-full ${colors.dot} mt-1.5 shrink-0`} />
          <div className="min-w-0 flex-1 space-y-2">
            {/* UF + Município */}
            <div className="flex flex-wrap gap-2 items-center">
              <Badge variant="secondary" className="font-semibold text-xs">{boleto.uf_favorecida || '—'}</Badge>
              <span className="text-sm font-medium text-foreground">{boleto.municipio || '—'}</span>
            </div>

            {/* Valor */}
            <p className={`text-2xl font-syne font-bold ${colors.text}`}>
              {(boleto.valor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
            </p>

            {/* Linha digitável */}
            <div className="flex items-center gap-2 flex-wrap">
              <code className="text-xs bg-muted px-2 py-1 rounded-md font-mono text-foreground break-all">
                {boleto.linha_digitavel || 'N/A'}
              </code>
              <button
                onClick={handleCopy}
                className="text-muted-foreground hover:text-primary transition-colors"
                title="Copiar linha digitável"
              >
                {copied ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>

            {/* Código de barras */}
            {boleto.codigo_barras && (
              <p className="text-xs text-muted-foreground font-mono break-all">
                <span className="font-semibold">Cód. barras:</span> {boleto.codigo_barras}
              </p>
            )}

            {/* Ver boleto */}
            {boleto.file_url ? (
              <a
                href={boleto.file_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 font-medium transition-colors"
              >
                <FileText className="w-3.5 h-3.5" />
                Ver Boleto PDF
              </a>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                <FileText className="w-3.5 h-3.5" />
                PDF não disponível (reimporte para visualizar)
              </span>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col items-end gap-2 shrink-0">
          {pending ? (
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">
                {pending === 'pago' ? 'Marcado como pago' : 'Marcado como não pago'} ({countdown}s)
              </span>
              <Button
                size="sm"
                variant="outline"
                onClick={handleUndo}
                className="h-8 text-xs"
              >
                <Undo2 className="w-3 h-3 mr-1" />
                Desfazer
              </Button>
            </div>
          ) : (
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                className="h-8 text-xs border-red-300 text-red-600 hover:bg-red-50"
                onClick={() => handleAction('nao_pago')}
              >
                <XCircle className="w-3 h-3 mr-1" />
                Não Pago
              </Button>
              <Button
                size="sm"
                className="h-8 text-xs bg-green-600 hover:bg-green-700 text-white"
                onClick={() => handleAction('pago')}
              >
                <CheckCircle className="w-3 h-3 mr-1" />
                Pago
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
