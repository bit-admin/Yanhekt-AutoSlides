import { useEffect, useMemo, useRef, useState } from 'react';

export interface IndexSemester {
  id: number;
  label: string;
  schoolYear?: number;
  semester?: number;
  labelEn?: string;
}

function displayLabel(s: IndexSemester): string {
  if (s.labelEn) return s.labelEn;
  if (s.schoolYear && s.semester === 1) return `Fall ${s.schoolYear}`;
  if (s.schoolYear && s.semester === 2) return `Spring ${s.schoolYear + 1}`;
  return s.label;
}

interface Group {
  key: string;
  label: string;
  options: IndexSemester[];
}

function groupSemesters(semesters: IndexSemester[]): Group[] {
  const byYear = new Map<number, IndexSemester[]>();
  const unknown: IndexSemester[] = [];
  for (const s of semesters) {
    const year = s.schoolYear ?? 0;
    if (!year) {
      unknown.push(s);
      continue;
    }
    const list = byYear.get(year);
    if (list) list.push(s);
    else byYear.set(year, [s]);
  }
  const groups: Group[] = [...byYear.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([year, options]) => ({
      key: String(year),
      label: `${year}–${year + 1} Academic Year`,
      options: options.slice().sort((a, b) => (b.semester ?? 0) - (a.semester ?? 0)),
    }));
  if (unknown.length > 0) {
    groups.push({ key: 'other', label: '', options: unknown });
  }
  return groups;
}

export function SemesterSelect({
  semesters,
  value,
  onChange,
}: {
  semesters: IndexSemester[];
  /** Selected ids. Empty array = all semesters. */
  value: string[];
  onChange: (ids: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const groups = useMemo(() => groupSemesters(semesters), [semesters]);
  const isAll = value.length === 0;
  const triggerLabel = (() => {
    if (isAll) return 'All semesters';
    if (value.length === 1) {
      const selected = semesters.find((s) => String(s.id) === value[0]);
      return selected ? displayLabel(selected) : 'Semester';
    }
    return `${value.length} semesters`;
  })();

  const chooseAll = () => {
    if (value.length > 0) onChange([]);
  };

  const toggle = (id: string) => {
    onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id]);
  };

  return (
    <div className="semester-select" ref={rootRef}>
      <button
        type="button"
        className={`semester-trigger${open ? ' open' : ''}`}
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label="Semester"
      >
        <svg className="semester-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
          <line x1="16" y1="2" x2="16" y2="6" />
          <line x1="8" y1="2" x2="8" y2="6" />
          <line x1="3" y1="10" x2="21" y2="10" />
        </svg>
        <span className="semester-trigger-label">{triggerLabel}</span>
        <svg className={`semester-chevron${open ? ' open' : ''}`} width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="6,9 12,15 18,9" />
        </svg>
      </button>
      {open && (
        <div className="semester-menu" role="listbox" aria-multiselectable="true">
          <div className="semester-group">
            <button
              type="button"
              className={`semester-option${isAll ? ' active' : ''}`}
              aria-selected={isAll}
              onClick={chooseAll}
            >
              <span className="semester-option-label">All semesters</span>
              {isAll && <CheckIcon />}
            </button>
          </div>
          {groups.map((group) => (
            <div key={group.key} className="semester-group">
              {group.label && <div className="semester-group-label">{group.label}</div>}
              {group.options.map((option) => {
                const id = String(option.id);
                const active = value.includes(id);
                return (
                  <button
                    type="button"
                    key={option.id}
                    className={`semester-option${active ? ' active' : ''}`}
                    aria-selected={active}
                    onClick={() => toggle(id)}
                  >
                    <span className="semester-option-label">{displayLabel(option)}</span>
                    {active && <CheckIcon />}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20,6 9,17 4,12" />
    </svg>
  );
}
