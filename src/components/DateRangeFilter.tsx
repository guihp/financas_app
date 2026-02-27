import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Filter, Calendar } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { DateFilterOption, DateRange } from "@/utils/dateFilter";

export type { DateFilterOption, DateRange };

interface DateRangeFilterProps {
  value: DateFilterOption;
  dateRange: DateRange;
  onValueChange: (value: DateFilterOption) => void;
  onDateRangeChange: (range: DateRange) => void;
  className?: string;
}

const getDefaultRange = (): DateRange => {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return { start, end };
};

export const DateRangeFilter = ({
  value,
  dateRange,
  onValueChange,
  onDateRangeChange,
  className,
}: DateRangeFilterProps) => {
  const [open, setOpen] = useState(false);
  const [localStart, setLocalStart] = useState(
    dateRange.start ? format(dateRange.start, "yyyy-MM-dd") : ""
  );
  const [localEnd, setLocalEnd] = useState(
    dateRange.end ? format(dateRange.end, "yyyy-MM-dd") : ""
  );

  const handleApplyCustom = () => {
    if (localStart && localEnd) {
      const start = new Date(localStart + "T12:00:00");
      const end = new Date(localEnd + "T23:59:59");
      if (start <= end) {
        onDateRangeChange({ start, end });
        onValueChange("custom");
        setOpen(false);
      }
    }
  };

  const openCustomPicker = () => {
    if (value !== "custom") {
      const def = getDefaultRange();
      setLocalStart(def.start ? format(def.start, "yyyy-MM-dd") : "");
      setLocalEnd(def.end ? format(def.end, "yyyy-MM-dd") : "");
    } else {
      setLocalStart(dateRange.start ? format(dateRange.start, "yyyy-MM-dd") : "");
      setLocalEnd(dateRange.end ? format(dateRange.end, "yyyy-MM-dd") : "");
    }
    setOpen(true);
  };

  const customLabel =
    value === "custom" && dateRange.start && dateRange.end
      ? `${format(dateRange.start, "dd/MM/yy", { locale: ptBR })} - ${format(
          dateRange.end,
          "dd/MM/yy",
          { locale: ptBR }
        )}`
      : "Período";

  return (
    <div className={className}>
      <div className="flex gap-1 bg-muted/50 rounded-lg p-1 items-center flex-wrap">
        <Filter className="h-4 w-4 text-muted-foreground ml-2 shrink-0" />
        <Button
          variant={value === "thisMonth" ? "default" : "ghost"}
          size="sm"
          className="h-7 text-xs"
          onClick={() => onValueChange("thisMonth")}
        >
          Este Mês
        </Button>
        <Button
          variant={value === "lastMonth" ? "default" : "ghost"}
          size="sm"
          className="h-7 text-xs"
          onClick={() => onValueChange("lastMonth")}
        >
          Mês Passado
        </Button>
        <Button
          variant={value === "all" ? "default" : "ghost"}
          size="sm"
          className="h-7 text-xs"
          onClick={() => onValueChange("all")}
        >
          Todos
        </Button>
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              variant={value === "custom" ? "default" : "ghost"}
              size="sm"
              className="h-7 text-xs gap-1"
              onClick={openCustomPicker}
            >
              <Calendar className="h-3.5 w-3.5" />
              {customLabel}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-4" align="end">
            <div className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="date-start">Data inicial</Label>
                <Input
                  id="date-start"
                  type="date"
                  value={localStart}
                  onChange={(e) => setLocalStart(e.target.value)}
                  className="w-full"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="date-end">Data final</Label>
                <Input
                  id="date-end"
                  type="date"
                  value={localEnd}
                  onChange={(e) => setLocalEnd(e.target.value)}
                  className="w-full"
                />
              </div>
              <Button
                size="sm"
                className="w-full"
                onClick={handleApplyCustom}
                disabled={!localStart || !localEnd}
              >
                Aplicar
              </Button>
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
};
