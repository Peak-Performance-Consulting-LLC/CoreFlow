import { ChevronDown, MapPin, Search, Star } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import {
  getVoiceSearchSuggestions,
  type AreaCodeSuggestion,
  type CitySuggestion,
  type StateSuggestion,
} from '../../lib/voice-search-suggestions';
import type { VoiceNumberSearchFilters, VoiceNumberSearchResult } from '../../lib/voice-service';

interface VoiceNumberSearchCardProps {
  filters: Omit<VoiceNumberSearchFilters, 'workspace_id'>;
  loading: boolean;
  results: VoiceNumberSearchResult[];
  hasSearched: boolean;
  onFilterChange: (patch: Partial<Omit<VoiceNumberSearchFilters, 'workspace_id'>>) => void;
  onSearch: () => Promise<void>;
  onPurchaseClick: (result: VoiceNumberSearchResult) => void;
}

type SuggestionField = 'city' | 'state' | 'areaCode' | null;

interface SuggestionMenuProps<TSuggestion> {
  items: TSuggestion[];
  emptyText: string;
  getKey: (item: TSuggestion) => string;
  getPrimary: (item: TSuggestion) => string;
  getSecondary: (item: TSuggestion) => string;
  onSelect: (item: TSuggestion) => void;
}

function formatLocation(result: VoiceNumberSearchResult) {
  return [result.locality, result.administrativeArea, result.countryCode].filter(Boolean).join(', ') || 'US';
}

function SuggestionMenu<TSuggestion>({
  items,
  emptyText,
  getKey,
  getPrimary,
  getSecondary,
  onSelect,
}: SuggestionMenuProps<TSuggestion>) {
  if (items.length === 0) {
    return (
      <div className="absolute left-0 right-0 top-[calc(100%+0.6rem)] z-30 rounded-[24px] border border-white/10 bg-slate-950/95 p-3 shadow-2xl backdrop-blur-xl">
        <div className="rounded-2xl border border-dashed border-white/10 px-4 py-3 text-sm text-slate-500">
          {emptyText}
        </div>
      </div>
    );
  }

  return (
    <div className="absolute left-0 right-0 top-[calc(100%+0.6rem)] z-30 overflow-hidden rounded-[24px] border border-cyan-300/20 bg-slate-950/95 shadow-2xl backdrop-blur-xl">
      <div className="max-h-72 overflow-y-auto p-2">
        {items.map((item) => (
          <button
            key={getKey(item)}
            type="button"
            onMouseDown={(event) => {
              event.preventDefault();
              onSelect(item);
            }}
            className="flex w-full items-start justify-between gap-4 rounded-2xl px-4 py-3 text-left transition hover:bg-cyan-300/10"
          >
            <div>
              <div className="font-semibold text-white">{getPrimary(item)}</div>
              <div className="mt-1 text-sm text-slate-400">{getSecondary(item)}</div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

export function VoiceNumberSearchCard({
  filters,
  loading,
  results,
  hasSearched,
  onFilterChange,
  onSearch,
  onPurchaseClick,
}: VoiceNumberSearchCardProps) {
  const [stateSuggestions, setStateSuggestions] = useState<StateSuggestion[]>([]);
  const [citySuggestions, setCitySuggestions] = useState<CitySuggestion[]>([]);
  const [areaCodeSuggestions, setAreaCodeSuggestions] = useState<AreaCodeSuggestion[]>([]);
  const [activeField, setActiveField] = useState<SuggestionField>(null);
  const formRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let active = true;

    void getVoiceSearchSuggestions()
      .then((data) => {
        if (!active) {
          return;
        }

        setStateSuggestions(data.states);
        setCitySuggestions(data.cities);
        setAreaCodeSuggestions(data.areaCodes);
      })
      .catch(() => {
        if (!active) {
          return;
        }

        setStateSuggestions([]);
        setCitySuggestions([]);
        setAreaCodeSuggestions([]);
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (!formRef.current?.contains(event.target as Node)) {
        setActiveField(null);
      }
    }

    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, []);

  const normalizedStateQuery = (filters.administrative_area ?? '').trim().toLowerCase();
  const normalizedCityQuery = (filters.locality ?? '').trim().toLowerCase();
  const normalizedAreaCodeQuery = (filters.npa ?? '').trim();

  const filteredStateSuggestions = useMemo(() => {
    if (!normalizedStateQuery) {
      return stateSuggestions.slice(0, 12);
    }

    return stateSuggestions
      .filter((state) =>
        state.code.toLowerCase().includes(normalizedStateQuery) ||
        state.name.toLowerCase().includes(normalizedStateQuery)
      )
      .slice(0, 12);
  }, [normalizedStateQuery, stateSuggestions]);

  const filteredCitySuggestions = useMemo(() => {
    return citySuggestions
      .filter((city) => {
        const matchesState = normalizedStateQuery
          ? city.stateCode.toLowerCase() === normalizedStateQuery || city.stateName.toLowerCase().includes(normalizedStateQuery)
          : true;
        const matchesCity = normalizedCityQuery ? city.city.toLowerCase().includes(normalizedCityQuery) : true;
        return matchesState && matchesCity;
      })
      .slice(0, 12);
  }, [citySuggestions, normalizedCityQuery, normalizedStateQuery]);

  const filteredAreaCodeSuggestions = useMemo(() => {
    return areaCodeSuggestions
      .filter((entry) => {
        const matchesAreaCode = normalizedAreaCodeQuery ? entry.areaCode.startsWith(normalizedAreaCodeQuery) : true;
        const matchesState = normalizedStateQuery
          ? entry.stateCode.toLowerCase() === normalizedStateQuery || entry.stateName.toLowerCase().includes(normalizedStateQuery)
          : true;
        const matchesCity = normalizedCityQuery ? entry.city.toLowerCase().includes(normalizedCityQuery) : true;
        return matchesAreaCode && matchesState && matchesCity;
      })
      .slice(0, 12);
  }, [areaCodeSuggestions, normalizedAreaCodeQuery, normalizedCityQuery, normalizedStateQuery]);

  return (
    <Card className="p-6">
      <div className="flex flex-col gap-6">
        <div>
          <div className="text-xs uppercase tracking-[0.28em] text-cyan-200">Managed provisioning</div>
          <h3 className="mt-2 font-display text-2xl text-white">Search available US numbers</h3>
          <p className="mt-2 max-w-3xl text-sm leading-7 text-slate-400">
            Search CoreFlow-managed US inventory and provision a workspace line without exposing raw Telnyx setup to the
            user. Phase 1 intentionally stays US-only.
          </p>
        </div>

        <div ref={formRef} className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <label className="relative flex flex-col gap-2 text-sm text-slate-200">
            <span className="font-medium">City</span>
            <div
              className={`relative flex h-12 items-center rounded-2xl border bg-slate-950/70 px-4 transition ${
                activeField === 'city'
                  ? 'border-cyan-300/60 bg-slate-950/90 shadow-[0_0_0_1px_rgba(34,211,238,0.12)]'
                  : 'border-white/10'
              }`}
            >
              <input
                value={filters.locality ?? ''}
                onFocus={() => setActiveField('city')}
                onChange={(event) => {
                  setActiveField('city');
                  onFilterChange({ locality: event.target.value });
                }}
                placeholder="Chicago"
                autoComplete="off"
                className="h-full w-full bg-transparent pr-10 text-sm text-white placeholder:text-slate-500"
              />
              <ChevronDown className="pointer-events-none absolute right-4 h-4 w-4 text-slate-500" />
            </div>
            {activeField === 'city' ? (
              <SuggestionMenu
                items={filteredCitySuggestions}
                emptyText="No matching cities found."
                getKey={(city) => `${city.city}-${city.stateCode}`}
                getPrimary={(city) => city.city}
                getSecondary={(city) => `${city.stateName} (${city.stateCode})`}
                onSelect={(city) => {
                  onFilterChange({
                    locality: city.city,
                    administrative_area: city.stateCode,
                  });
                  setActiveField(null);
                }}
              />
            ) : null}
          </label>

          <label className="relative flex flex-col gap-2 text-sm text-slate-200">
            <span className="font-medium">State</span>
            <div
              className={`relative flex h-12 items-center rounded-2xl border bg-slate-950/70 px-4 transition ${
                activeField === 'state'
                  ? 'border-cyan-300/60 bg-slate-950/90 shadow-[0_0_0_1px_rgba(34,211,238,0.12)]'
                  : 'border-white/10'
              }`}
            >
              <input
                value={filters.administrative_area ?? ''}
                onFocus={() => setActiveField('state')}
                onChange={(event) => {
                  setActiveField('state');
                  onFilterChange({ administrative_area: event.target.value.toUpperCase() });
                }}
                placeholder="IL"
                autoComplete="off"
                className="h-full w-full bg-transparent pr-10 text-sm text-white placeholder:text-slate-500"
              />
              <ChevronDown className="pointer-events-none absolute right-4 h-4 w-4 text-slate-500" />
            </div>
            {activeField === 'state' ? (
              <SuggestionMenu
                items={filteredStateSuggestions}
                emptyText="No matching states found."
                getKey={(state) => state.code}
                getPrimary={(state) => state.code}
                getSecondary={(state) => state.name}
                onSelect={(state) => {
                  onFilterChange({ administrative_area: state.code });
                  setActiveField(null);
                }}
              />
            ) : null}
          </label>

          <label className="relative flex flex-col gap-2 text-sm text-slate-200">
            <span className="font-medium">Area code</span>
            <div
              className={`relative flex h-12 items-center rounded-2xl border bg-slate-950/70 px-4 transition ${
                activeField === 'areaCode'
                  ? 'border-cyan-300/60 bg-slate-950/90 shadow-[0_0_0_1px_rgba(34,211,238,0.12)]'
                  : 'border-white/10'
              }`}
            >
              <input
                value={filters.npa ?? ''}
                onFocus={() => setActiveField('areaCode')}
                onChange={(event) => {
                  setActiveField('areaCode');
                  onFilterChange({ npa: event.target.value.replace(/\D/g, '').slice(0, 3) });
                }}
                placeholder="312"
                autoComplete="off"
                className="h-full w-full bg-transparent pr-10 text-sm text-white placeholder:text-slate-500"
              />
              <ChevronDown className="pointer-events-none absolute right-4 h-4 w-4 text-slate-500" />
            </div>
            {activeField === 'areaCode' ? (
              <SuggestionMenu
                items={filteredAreaCodeSuggestions}
                emptyText="No matching area codes found."
                getKey={(entry) => entry.areaCode}
                getPrimary={(entry) => entry.areaCode}
                getSecondary={(entry) => `${entry.city}, ${entry.stateCode}`}
                onSelect={(entry) => {
                  onFilterChange({
                    npa: entry.areaCode,
                    locality: entry.city,
                    administrative_area: entry.stateCode,
                  });
                  setActiveField(null);
                }}
              />
            ) : null}
          </label>

          <label className="flex flex-col gap-2 text-sm text-slate-200">
            <span className="font-medium">Number type</span>
            <select
              value={filters.phone_number_type ?? ''}
              onChange={(event) =>
                onFilterChange({
                  phone_number_type: event.target.value as 'local' | 'toll_free' | '',
                })
              }
              className="h-12 rounded-2xl border border-white/10 bg-slate-950/70 px-4 text-sm text-white"
            >
              <option value="">Any</option>
              <option value="local">Local</option>
              <option value="toll_free">Toll-free</option>
            </select>
          </label>

          <label className="flex flex-col gap-2 text-sm text-slate-200">
            <span className="font-medium">Results</span>
            <input
              type="number"
              min={1}
              max={20}
              value={filters.limit ?? 10}
              onChange={(event) => onFilterChange({ limit: Number(event.target.value) || 10 })}
              className="h-12 rounded-2xl border border-white/10 bg-slate-950/70 px-4 text-sm text-white"
            />
          </label>
        </div>

        <div className="flex justify-end">
          <Button type="button" onClick={() => void onSearch()} loading={loading}>
            <Search className="h-4 w-4" />
            Search US numbers
          </Button>
        </div>

        {hasSearched ? (
          results.length > 0 ? (
            <div className="grid gap-4 lg:grid-cols-2">
              {results.map((result) => (
                <div key={result.phoneNumber} className="rounded-[28px] border border-white/10 bg-white/[0.03] p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="font-display text-2xl text-white">{result.phoneNumber}</div>
                      <div className="mt-2 flex flex-wrap items-center gap-3 text-xs uppercase tracking-[0.22em] text-slate-500">
                        <span>{result.phoneNumberType ?? 'standard'}</span>
                        {result.quickship ? (
                          <span className="inline-flex items-center gap-1 text-cyan-100">
                            <Star className="h-3.5 w-3.5" />
                            Quickship
                          </span>
                        ) : null}
                      </div>
                    </div>
                    <Button type="button" size="sm" onClick={() => onPurchaseClick(result)}>
                      Provision
                    </Button>
                  </div>

                  <div className="mt-5 grid gap-3 text-sm text-slate-300 sm:grid-cols-2">
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-cyan-200" />
                      {formatLocation(result)}
                    </div>
                    <div>Monthly: {result.monthlyCost ?? 'Unknown'}</div>
                    <div>Upfront: {result.upfrontCost ?? 'Unknown'}</div>
                    <div>Features: {result.features.length > 0 ? result.features.join(', ') : 'Not listed'}</div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-[28px] border border-white/10 bg-white/[0.03] px-5 py-4 text-sm text-slate-400">
              No US numbers matched the current filters. Try a different area code, city, or number type.
            </div>
          )
        ) : null}
      </div>
    </Card>
  );
}
