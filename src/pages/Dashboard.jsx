import { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, getDay, addMonths, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, CreditCard } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';

export default function Dashboard() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [markingDay, setMarkingDay] = useState(null);

  const handleMarkAllNaoPago = async (day, pendentes) => {
    const dateKey = format(day, 'yyyy-MM-dd');
    setMarkingDay(dateKey);
    await Promise.all(pendentes.map(g => base44.entities.GNRE.update(g.id, { status: 'nao_pago' })));
    queryClient.invalidateQueries({ queryKey: ['gnres'] });
    setMarkingDay(null);
  };

  const { data: gnres = [] } = useQuery({
    queryKey: ['gnres'],
    queryFn: () => base44.entities.GNRE.list('-data_vencimento', 500),
  });

  const start = startOfMonth(currentMonth);
  const end = endOfMonth(currentMonth);
  const days = eachDayOfInterval({ start, end });
  const startWeekday = getDay(start); // 0=Sun

  const getGnresForDay = (day) =>
    gnres.filter(g => g.data_vencimento && isSameDay(new Date(g.data_vencimento + 'T12:00:00'), day));

  const getPendentesForDay = (day) =>
    getGnresForDay(day).filter(g => g.status === 'pendente');

  const getTotalForDay = (gnreList) =>
    gnreList.reduce((sum, g) => sum + (g.valor || 0), 0);

  const formatBRL = (v) =>
    v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  const weekdays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

  return (
    <div className="p-6 md:p-10 min-h-screen">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-syne font-bold text-foreground">Dashboard</h1>
        <p className="text-muted-foreground mt-1">Calendário de vencimentos GNRE</p>
      </div>

      {/* Month navigation */}
      <div className="flex items-center justify-between mb-6">
        <Button variant="outline" size="icon" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
          <ChevronLeft className="w-4 h-4" />
        </Button>
        <h2 className="text-xl font-syne font-bold text-foreground capitalize">
          {format(currentMonth, 'MMMM yyyy', { locale: ptBR })}
        </h2>
        <Button variant="outline" size="icon" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>

      {/* Calendar grid */}
      <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
        {/* Weekday headers */}
        <div className="grid grid-cols-7 border-b border-border">
          {weekdays.map(d => (
            <div key={d} className="py-3 text-center text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              {d}
            </div>
          ))}
        </div>

        {/* Days grid */}
        <div className="grid grid-cols-7">
          {/* Empty cells before start */}
          {Array.from({ length: startWeekday }).map((_, i) => (
            <div key={`empty-${i}`} className="min-h-[120px] bg-muted/20 border-b border-r border-border" />
          ))}

          {days.map((day, idx) => {
            const allDay = getGnresForDay(day);
            const pendentes = getPendentesForDay(day);
            const totalAll = getTotalForDay(allDay);
            const totalPendente = getTotalForDay(pendentes);
            const hasPendentes = pendentes.length > 0;
            const isToday = isSameDay(day, new Date());
            const colIndex = (startWeekday + idx) % 7;
            const isLastCol = colIndex === 6;
            const dateKey = format(day, 'yyyy-MM-dd');
            const isMarking = markingDay === dateKey;

            return (
              <div
                key={day.toISOString()}
                className={`min-h-[120px] p-2 border-b border-border flex flex-col ${!isLastCol ? 'border-r' : ''} ${isToday ? 'bg-accent/40' : 'bg-card'}`}
              >
                {/* Day number + checkbox */}
                <div className="flex items-center justify-between mb-1">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-sm font-semibold ${
                    isToday ? 'bg-primary text-primary-foreground' : 'text-foreground'
                  }`}>
                    {format(day, 'd')}
                  </div>
                  {hasPendentes && (
                    <Checkbox
                      disabled={isMarking}
                      title="Marcar todos como Não Pago"
                      onCheckedChange={(checked) => {
                        if (checked) handleMarkAllNaoPago(day, pendentes);
                      }}
                    />
                  )}
                </div>

                {/* Content */}
                {allDay.length > 0 && (
                  <div className="flex-1 space-y-1">
                    <div className="text-xs text-muted-foreground">
                      <span className="font-medium text-foreground">{allDay.length}</span> boleto{allDay.length > 1 ? 's' : ''}
                    </div>
                    <div className="text-xs font-semibold text-foreground">
                      {formatBRL(totalAll)}
                    </div>
                    {hasPendentes && (
                      <div className="text-xs text-amber-600 font-medium">
                        Pendente: {formatBRL(totalPendente)}
                      </div>
                    )}
                  </div>
                )}

                {/* Pay button */}
                {hasPendentes && (
                  <Button
                    size="sm"
                    className="mt-auto w-full text-xs h-7 bg-primary hover:bg-primary/90 text-primary-foreground"
                    onClick={() => navigate(`/pagamentos?data=${format(day, 'yyyy-MM-dd')}`)}
                  >
                    <CreditCard className="w-3 h-3 mr-1" />
                    Pagar
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
