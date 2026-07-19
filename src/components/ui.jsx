// src/components/ui.jsx
// Shared presentational building blocks for the redesigned pages.
// Purely visual — no data logic lives here.

/** Standard page header: title + subtitle on the left, action buttons on the right. */
export function PageHeader({ title, subtitle, children }) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-2xl sm:text-3xl font-black text-primary tracking-tight">{title}</h1>
        {subtitle && <p className="text-muted text-sm mt-1">{subtitle}</p>}
      </div>
      {children && <div className="flex items-center gap-2 flex-wrap">{children}</div>}
    </div>
  )
}

/** Small metric card. `Icon` optional; `tone` colors a slim left accent bar. */
export function StatCard({ label, value, sub, Icon, tone, onClick, valueStyle }) {
  return (
    <div
      className={`card p-4 ${onClick ? 'card-tap' : ''}`}
      onClick={onClick}
      style={{ borderLeft: tone ? `3px solid ${tone}` : undefined }}
    >
      <div className="flex items-center gap-1.5 mb-1">
        {Icon && <Icon size={13} className="text-muted" />}
        <p className="text-muted text-xs font-semibold">{label}</p>
      </div>
      <p className="text-xl sm:text-2xl font-black text-primary tnum" style={valueStyle}>{value}</p>
      {sub && <p className="text-xs text-muted mt-0.5">{sub}</p>}
    </div>
  )
}

/** Pill-style segmented tabs. `tabs` = [{value, label, Icon?}] or plain strings. */
export function SegTabs({ tabs, active, onChange, small }) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
      {tabs.map(t => {
        const tab = typeof t === 'string' ? { value: t, label: t } : t
        return (
          <button
            key={tab.value}
            onClick={() => onChange(tab.value)}
            className={`seg-tab ${active === tab.value ? 'seg-tab-active' : ''}`}
            style={small ? { padding: '5px 12px', fontSize: 12 } : undefined}
          >
            {tab.Icon && <tab.Icon size={14} />} {tab.label}
          </button>
        )
      })}
    </div>
  )
}

/** Friendly empty state used inside cards. */
export function EmptyState({ Icon, title, sub, children }) {
  return (
    <div className="text-center py-10 px-4">
      {Icon && (
        <div className="icon-chip mx-auto mb-3" style={{ width: 52, height: 52, borderRadius: 16 }}>
          <Icon size={24} />
        </div>
      )}
      <p className="font-bold text-primary">{title}</p>
      {sub && <p className="text-muted text-sm mt-1 max-w-xs mx-auto">{sub}</p>}
      {children && <div className="mt-4 flex justify-center gap-3 flex-wrap">{children}</div>}
    </div>
  )
}

/** Section heading between cards. */
export function SectionTitle({ children, right }) {
  return (
    <div className="flex items-center justify-between mb-3 mt-6">
      <h2 className="text-xs font-extrabold text-muted uppercase tracking-widest flex items-center gap-1.5">{children}</h2>
      {right}
    </div>
  )
}

/** Skeleton primitives */
export function Sk({ w = '100%', h = 14, className = '', style }) {
  return <div className={`skeleton ${className}`} style={{ width: w, height: h, ...style }} />
}

/** Full-page skeleton shown while a page's data loads. */
export function PageSkeleton({ stats = 4, hero = true }) {
  return (
    <div className="page-enter">
      <div className="mb-6">
        <Sk w={180} h={26} className="mb-2" />
        <Sk w={260} h={13} />
      </div>
      {hero && (
        <div className="card p-5 mb-4">
          <Sk w={120} h={12} className="mb-3" />
          <Sk w={200} h={32} className="mb-2" />
          <Sk w={160} h={12} />
        </div>
      )}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        {Array.from({ length: stats }).map((_, i) => (
          <div key={i} className="card p-4">
            <Sk w="60%" h={11} className="mb-2.5" />
            <Sk w="80%" h={22} />
          </div>
        ))}
      </div>
      <div className="card p-5">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 py-3">
            <Sk w={40} h={40} style={{ borderRadius: 12, flexShrink: 0 }} />
            <div className="flex-1">
              <Sk w="45%" h={13} className="mb-2" />
              <Sk w="28%" h={11} />
            </div>
            <Sk w={70} h={16} />
          </div>
        ))}
      </div>
    </div>
  )
}
