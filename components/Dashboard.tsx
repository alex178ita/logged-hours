'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { CATEGORY_LABELS, type PersonRow, type WeekReport } from '@/lib/report';

type WeekOption = { value: string; label: string };

type SortKey = 'name' | 'projects' | 'internal' | 'service' | 'absence' | 'sprints' | 'total';

const COLUMNS: { key: SortKey; label: string }[] = [
  { key: 'name', label: 'Person' },
  { key: 'projects', label: CATEGORY_LABELS.projects },
  { key: 'internal', label: CATEGORY_LABELS.internal },
  { key: 'service', label: CATEGORY_LABELS.service },
  { key: 'absence', label: CATEGORY_LABELS.absence },
  { key: 'sprints', label: CATEGORY_LABELS.sprints },
  { key: 'total', label: 'Total' },
];

function hours(n: number): string {
  return n.toLocaleString('en-GB', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

export default function Dashboard({
  report,
  weeks,
  currentWeek,
}: {
  report: WeekReport;
  weeks: WeekOption[];
  currentWeek: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [sort, setSort] = useState<{ key: SortKey; dir: 'asc' | 'desc' }>({ key: 'total', dir: 'asc' });
  const [onlyBelow, setOnlyBelow] = useState(false);
  const [selected, setSelected] = useState<PersonRow | null>(null);

  const index = weeks.findIndex((w) => w.value === currentWeek);

  const go = (week: string) => {
    startTransition(() => router.push(`/?week=${week}`, { scroll: false }));
  };

  const rows = useMemo(() => {
    const filtered = onlyBelow ? report.rows.filter((r) => !r.meetsTarget) : report.rows;
    const factor = sort.dir === 'asc' ? 1 : -1;
    return [...filtered].sort((a, b) => {
      if (sort.key === 'name') return factor * a.name.localeCompare(b.name, 'en-GB');
      return factor * (a[sort.key] - b[sort.key]) || a.name.localeCompare(b.name, 'en-GB');
    });
  }, [report.rows, sort, onlyBelow]);

  const toggleSort = (key: SortKey) => {
    setSort((s) =>
      s.key === key
        ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' }
        : { key, dir: key === 'name' ? 'asc' : 'desc' },
    );
  };

  const downloadCsv = () => {
    const header = ['Person', 'Email', ...COLUMNS.slice(1).map((c) => c.label), 'Meets target'];
    const lines = [header, ...report.rows.map((r) => [
      r.name, r.email, r.projects, r.internal, r.service, r.absence, r.sprints, r.total,
      r.meetsTarget ? 'yes' : 'no',
    ])];
    const csv = lines
      .map((line) => line.map((cell) => {
        const s = String(cell);
        return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
      }).join(','))
      .join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `weekly-hours-${report.weekStart}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <div className="toolbar">
        <button
          className="btn icon"
          onClick={() => go(weeks[index + 1].value)}
          disabled={index < 0 || index + 1 >= weeks.length || pending}
          aria-label="Previous week"
        >
          ←
        </button>
        <select
          className="btn"
          value={currentWeek}
          onChange={(e) => go(e.target.value)}
          disabled={pending}
          aria-label="Select week"
        >
          {weeks.map((w) => (
            <option key={w.value} value={w.value}>{w.label}</option>
          ))}
        </select>
        <button
          className="btn icon"
          onClick={() => go(weeks[index - 1].value)}
          disabled={index <= 0 || pending}
          aria-label="Next week"
        >
          →
        </button>

        <span className="week-label">
          {pending ? 'Loading…' : `${report.totals.people} people · target ${report.target}h`}
        </span>

        <span className="spacer" />

        <button
          className={`btn${onlyBelow ? ' active' : ''}`}
          onClick={() => setOnlyBelow((v) => !v)}
        >
          {onlyBelow ? 'Showing below target' : 'Show below target only'}
        </button>
        <button className="btn" onClick={downloadCsv}>Download CSV</button>
      </div>

      <div className="tiles">
        <div className="tile">
          <p className="k">Hours logged</p>
          <p className="v">{hours(report.totals.total)}</p>
        </div>
        <div className={`tile${report.totals.below > 0 ? ' warn' : ''}`}>
          <p className="k">Below {report.target}h</p>
          <p className="v">{report.totals.below} / {report.totals.people}</p>
        </div>
        <div className="tile">
          <p className="k">Projects</p>
          <p className="v">{hours(report.totals.projects)}</p>
        </div>
        <div className="tile">
          <p className="k">Internal</p>
          <p className="v">{hours(report.totals.internal)}</p>
        </div>
        <div className="tile">
          <p className="k">Service</p>
          <p className="v">{hours(report.totals.service)}</p>
        </div>
        <div className="tile">
          <p className="k">Absence</p>
          <p className="v">{hours(report.totals.absence)}</p>
        </div>
        <div className="tile">
          <p className="k">Sprints</p>
          <p className="v">{hours(report.totals.sprints)}</p>
        </div>
      </div>

      {report.inProgress && (
        <p className="notice">
          <strong>This week is still in progress.</strong> Zoho consolidates the timesheet on
          Monday morning, so figures before then are partial.
        </p>
      )}

      {report.holidays.length > 0 && (
        <p className="notice">
          <strong>Public holiday this week:</strong>{' '}
          {report.holidays.map((h) => h.name).join(', ')}. The red/green threshold stays at{' '}
          {report.target}h regardless.
        </p>
      )}

      <div className="panel">
        <div className="scroll">
          <table>
            <thead>
              <tr>
                {COLUMNS.map((c) => (
                  <th key={c.key} onClick={() => toggleSort(c.key)} scope="col">
                    {c.label}
                    {sort.key === c.key && (
                      <span className="arrow">{sort.dir === 'asc' ? '▲' : '▼'}</span>
                    )}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.email} onClick={() => setSelected(r)}>
                  <td className="name">
                    {r.name}
                    <small>{r.email}</small>
                  </td>
                  <td className={r.projects ? '' : 'zero'}>{hours(r.projects)}</td>
                  <td className={r.internal ? '' : 'zero'}>{hours(r.internal)}</td>
                  <td className={r.service ? '' : 'zero'}>{hours(r.service)}</td>
                  <td className={r.absence ? '' : 'zero'}>{hours(r.absence)}</td>
                  <td className={r.sprints ? '' : 'zero'}>{hours(r.sprints)}</td>
                  <td>
                    <span className={`pill ${r.meetsTarget ? 'ok' : 'no'}`}>{hours(r.total)}</span>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td className="empty" colSpan={COLUMNS.length}>No one to show for this week.</td>
                </tr>
              )}
            </tbody>
            {rows.length > 0 && (
              <tfoot>
                <tr>
                  <td>Total</td>
                  <td>{hours(report.totals.projects)}</td>
                  <td>{hours(report.totals.internal)}</td>
                  <td>{hours(report.totals.service)}</td>
                  <td>{hours(report.totals.absence)}</td>
                  <td>{hours(report.totals.sprints)}</td>
                  <td>{hours(report.totals.total)}</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {selected && (
        <>
          <button
            className="drawer-backdrop"
            onClick={() => setSelected(null)}
            aria-label="Close details"
          />
          <aside className="drawer">
            <button className="close" onClick={() => setSelected(null)} aria-label="Close">×</button>
            <h2>{selected.name}</h2>
            <p className="sub">
              {report.rangeLabel} · {hours(selected.total)}h of {report.target}h
            </p>
            {selected.detail.length === 0 && (
              <p className="sub">Nothing logged in Projects, People or Sprints this week.</p>
            )}
            {selected.detail.map((d) => (
              <div className="detail-row" key={`${d.category}-${d.label}`}>
                <span>
                  {d.label}
                  <span className="cat">{CATEGORY_LABELS[d.category]}</span>
                </span>
                <span className="h">{hours(d.hours)}h</span>
              </div>
            ))}
          </aside>
        </>
      )}
    </>
  );
}
