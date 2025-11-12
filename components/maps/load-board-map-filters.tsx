'use client';

import { useState } from 'react';
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { format } from "date-fns";
import { CalendarIcon, Filter } from "lucide-react";
import { DateRange } from "react-day-picker";

interface LoadBoardMapFiltersProps {
  onFiltersChange: (filters: {
    dateRange: { from: Date | undefined; to: Date | undefined };
    loadTypes: {
      ohToIn: boolean;
      backhaul: boolean;
      localFlatbed: boolean;
      rnrOrder: boolean;
      localSemi: boolean;
      middlefield: boolean;
      paNy: boolean;
    };
    showType: 'both' | 'pickups' | 'deliveries';
  }) => void;
}

export function LoadBoardMapFilters({ onFiltersChange }: LoadBoardMapFiltersProps) {
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [loadTypes, setLoadTypes] = useState({
    ohToIn: false,
    backhaul: false,
    localFlatbed: false,
    rnrOrder: false,
    localSemi: false,
    middlefield: false,
    paNy: false
  });
  const [showType, setShowType] = useState<'both' | 'pickups' | 'deliveries'>('both');

  const handleDateRangeChange = (range: DateRange | undefined) => {
    setDateRange(range);
    onFiltersChange({ 
      dateRange: { 
        from: range?.from, 
        to: range?.to 
      }, 
      loadTypes, 
      showType 
    });
  };

  const handleLoadTypeChange = (type: keyof typeof loadTypes) => {
    const newLoadTypes = { ...loadTypes, [type]: !loadTypes[type] };
    setLoadTypes(newLoadTypes);
    onFiltersChange({ 
      dateRange: { 
        from: dateRange?.from, 
        to: dateRange?.to 
      }, 
      loadTypes: newLoadTypes, 
      showType 
    });
  };

  const handleShowTypeChange = (type: 'both' | 'pickups' | 'deliveries') => {
    setShowType(type);
    onFiltersChange({ 
      dateRange: { 
        from: dateRange?.from, 
        to: dateRange?.to 
      }, 
      loadTypes, 
      showType: type 
    });
  };

  return (
    <Card className="absolute top-4 left-1/2 -translate-x-1/2 z-10 p-4 bg-white/95 shadow-lg">
      <div className="flex items-center gap-4">
        {/* Date Range Selector */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="w-[240px] justify-start text-left font-normal">
              <CalendarIcon className="mr-2 h-4 w-4" />
              {dateRange?.from ? (
                dateRange?.to ? (
                  <>
                    {format(dateRange.from, "LLL dd, y")} -{" "}
                    {format(dateRange.to, "LLL dd, y")}
                  </>
                ) : (
                  format(dateRange.from, "LLL dd, y")
                )
              ) : (
                <span>Pick a date range</span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              initialFocus
              mode="range"
              defaultMonth={dateRange?.from}
              selected={dateRange}
              onSelect={handleDateRangeChange}
              numberOfMonths={2}
            />
          </PopoverContent>
        </Popover>

        {/* Load Type Filters */}
        <div className="flex items-center gap-2">
          <Label className="text-sm font-medium">Load Type:</Label>
          <div className="flex items-center gap-2">
            <Checkbox
              id="ohToIn"
              checked={loadTypes.ohToIn}
              onCheckedChange={() => handleLoadTypeChange('ohToIn')}
            />
            <Label htmlFor="ohToIn" className="text-sm">OH → IN</Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="backhaul"
              checked={loadTypes.backhaul}
              onCheckedChange={() => handleLoadTypeChange('backhaul')}
            />
            <Label htmlFor="backhaul" className="text-sm">Backhaul</Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="localFlatbed"
              checked={loadTypes.localFlatbed}
              onCheckedChange={() => handleLoadTypeChange('localFlatbed')}
            />
            <Label htmlFor="localFlatbed" className="text-sm">Local Flatbed</Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="rnrOrder"
              checked={loadTypes.rnrOrder}
              onCheckedChange={() => handleLoadTypeChange('rnrOrder')}
            />
            <Label htmlFor="rnrOrder" className="text-sm">RNR</Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="localSemi"
              checked={loadTypes.localSemi}
              onCheckedChange={() => handleLoadTypeChange('localSemi')}
            />
            <Label htmlFor="localSemi" className="text-sm">Local Semi</Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="middlefield"
              checked={loadTypes.middlefield}
              onCheckedChange={() => handleLoadTypeChange('middlefield')}
            />
            <Label htmlFor="middlefield" className="text-sm">Middlefield</Label>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox
              id="paNy"
              checked={loadTypes.paNy}
              onCheckedChange={() => handleLoadTypeChange('paNy')}
            />
            <Label htmlFor="paNy" className="text-sm">PA/NY</Label>
          </div>
        </div>

        {/* Show Type Selector */}
        <div className="flex items-center gap-2">
          <Label className="text-sm font-medium">Show:</Label>
          <RadioGroup
            value={showType}
            onValueChange={(value: 'both' | 'pickups' | 'deliveries') => handleShowTypeChange(value)}
            className="flex items-center gap-4"
          >
            <div className="flex items-center gap-2">
              <RadioGroupItem value="both" id="both" />
              <Label htmlFor="both" className="text-sm">Both</Label>
            </div>
            <div className="flex items-center gap-2">
              <RadioGroupItem value="pickups" id="pickups" />
              <Label htmlFor="pickups" className="text-sm">Pickups</Label>
            </div>
            <div className="flex items-center gap-2">
              <RadioGroupItem value="deliveries" id="deliveries" />
              <Label htmlFor="deliveries" className="text-sm">Deliveries</Label>
            </div>
          </RadioGroup>
        </div>
      </div>
    </Card>
  );
} 