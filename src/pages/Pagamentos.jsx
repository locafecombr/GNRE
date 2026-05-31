import { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { format, isSameDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Copy, Check, ArrowLeft, CheckCircle, XCircle, Undo2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import BoletoCard from '@/components/pagamentos/BoletoCard';

export default function Pagamentos() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const urlParams = new URLSearchParams(window.location.search);
  const dataParam = urlParams.get('data');

  const { data: gnres = [], isLoading } = useQuery({
    queryKey: ['gnres'],
    queryFn: () => base44.entities.GNRE.list('-data_vencimento', 500),
  });

  const boletos = gnres.filter(g => {
    if (!g.data_vencimento || !dataParam) return false;
    return isSameDay(new Date(g.data_vencimento + 'T12:00:00'), new Date(dataParam + 'T12:00:00'));
  }).filter(g => g.status === 'pendente');

  const dataFormatada = dataParam
    ? format(new Date(dataParam + 'T12:00:00'), "EEEE, dd 'de' MMMM 'de' yyyy", { locale: ptBR })
    : '';

  const totalPendente = boletos.reduce((sum, g) => sum + (g.valor || 0), 0);

  const handleStatusChange = async (id, status) => {
    await base44.entities.GNRE.update(id, { status });
    queryClient.invalidateQueries({ queryKey: ['gnres'] });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-6 md:p-10 min-h-screen">
      {/* Header */}
      <div className="mb-8">
        <Button variant="ghost" size="sm" onClick={() => navigate('/')} className="mb-4 -ml-2 text-muted-foreground hover:text-foreground">
          <ArrowLeft className="w-4 h-4 mr-1" />
          Voltar ao Dashboard
        </Button>
        <h1 className="text-3xl font-syne font-bold text-foreground">Pagamentos</h1>
        <p className="text-muted-foreground mt-1 capitalize">{dataFormatada}</p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
        <div className="bg-card border border-border rounded-2xl p-5">
          <p className="text-sm text-muted-foreground">Boletos pendentes</p>
          <p className="text-3xl font-syne font-bold text-foreground mt-1">{boletos.length}</p>
        </div>
        <div className="bg-card border border-border rounded-2xl p-5">
          <p className="text-sm text-muted-foreground">Total a pagar</p>
          <p className="text-3xl font-syne font-bold text-primary mt-1">
            {totalPendente.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
          </p>
        </div>
      </div>

      {/* Boletos */}
      {boletos.length === 0 ? (
        <div className="bg-card border border-border rounded-2xl p-12 text-center">
          <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-3" />
          <p className="text-lg font-semibold text-foreground">Todos os boletos foram pagos!</p>
          <p className="text-muted-foreground mt-1">Não há boletos pendentes para esta data.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {boletos.map(boleto => (
            <BoletoCard
              key={boleto.id}
              boleto={boleto}
              onStatusChange={handleStatusChange}
            />
          ))}
        </div>
      )}
    </div>
  );
}
