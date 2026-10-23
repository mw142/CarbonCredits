import { useState } from 'react';
import { Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import StatCard from '../components/StatCard';
import ExportButton from '../components/ExportButton';
import { BarChart, LineChart, HBarList, compact } from '../components/Charts';
import useMarketStream from '../hooks/useMarketStream';
import { useI18n } from '../i18n/I18nContext';

export default function Market() {
  const { t, num, money, dateTime, date, locale } = useI18n();
  const { snapshot: s, live, error, updatedAt } = useMarketStream();
  const [instrument, setInstrument] = useState(null);

  const prices = s?.prices || [];
  const selected = prices.find((p) => p.instrument === instrument) || prices[0];
  const fy = (s?.register.issuance_by_fy || []).slice(-12).map((r) => ({ ...r, financial_year: r.financial_year.replace(/^20/, '') }));

  return (
    <>
      <Navbar />
      <div className="container" style={{ paddingTop: 40, paddingBottom: 80 }}>
        <div className="page-header">
          <div>
            <div className="eyebrow">{t('Market intelligence')}</div>
            <h1>{t('Live carbon market data')}</h1>
            <p className="text-soft">{t('Real-time insights into pricing, supply and demand — combining the public CER project register with verified supply and buyer demand on this platform.')}</p>
            <div className="status-line">
              <span className="live-dot" data-state={live ? 'on' : 'off'} />
              {live ? t('Live — updates stream automatically') : t('Reconnecting… showing latest snapshot')}
              {updatedAt ? <span className="text-faint">· {t('Updated {time}', { time: updatedAt.toLocaleTimeString(locale) })}</span> : null}
            </div>
          </div>
          <div className="btn-row">
            <ExportButton path="/export/market-prices" label={t('Export prices')} />
            <ExportButton path="/export/projects" label={t('Export projects')} formats={['csv']} />
          </div>
        </div>

        {error && !s ? <div className="form-error">{error}</div> : null}
        {!s ? <div className="loading-row"><span className="spinner" /> {t('Loading market data…')}</div> : (
          <>
            <div className="market-kpis">
              {prices.length ? prices.slice(0, 2).map((p) => (
                <div className="card price-card" key={p.instrument}>
                  <span className="inst">{p.instrument}</span>
                  <span className="px">{money(p.latest?.price)}</span>
                  <span className={`chg ${p.change >= 0 ? 'stat-up' : 'stat-down'}`}>
                    {p.change == null ? t('First price point') : `${p.change >= 0 ? '▲' : '▼'} ${money(Math.abs(p.change))} (${Math.abs(p.change_pct).toFixed(1)}%)`}
                  </span>
                  <span className="meta">{date(p.latest?.date)} · {p.latest?.source || '—'}</span>
                </div>
              )) : (
                <div className="card price-card" style={{ gridColumn: 'span 2' }}>
                  <span className="inst">{t('Reference prices')}</span>
                  <span className="text-soft">{t('No reference prices have been published yet. Administrators can add prices manually or push them through the API.')}</span>
                </div>
              )}
              <StatCard label={t('Weighted avg. indicative offer')} value={money(s.listings.weighted_avg_price)} sub={s.listings.min_price != null ? `${money(s.listings.min_price)} – ${money(s.listings.max_price)}` : t('No priced offers yet')} />
              <StatCard label={t('ACCUs offered on platform')} value={num(s.listings.total_available)} sub={t('{n} verified listings', { n: num(s.listings.published) })} />
            </div>

            <div className="grid-2">
              <div className="card panel">
                <div className="section-title" style={{ marginTop: 0 }}>
                  <span>{t('Reference price history')}</span>
                  {prices.length > 1 ? (
                    <select className="input" style={{ width: 'auto', padding: '6px 12px', borderRadius: 999 }} value={selected?.instrument} onChange={(e) => setInstrument(e.target.value)}>
                      {prices.map((p) => <option key={p.instrument}>{p.instrument}</option>)}
                    </select>
                  ) : null}
                </div>
                {selected?.history?.length ? (
                  <LineChart data={selected.history.map((h) => ({ ...h, date: date(h.date, { day: 'numeric', month: 'short' }) }))} format={(v) => `$${Number(v).toFixed(2)}`} ariaLabel={t('Reference price history')} />
                ) : <div className="empty-state">{t('No price history yet.')}</div>}
                <p className="disclaimer">{t('Indicative prices are supplied by sellers or market data providers and are not offers. Purchases, payments and ACCU transfers occur outside this platform.')}</p>
              </div>
              <div className="card panel">
                <div className="section-title" style={{ marginTop: 0 }}><span>{t('ACCU issuance by financial year (CER register)')}</span></div>
                {fy.length ? <BarChart data={fy} xKey="financial_year" series={[{ key: 'kaccu', label: 'KACCU' }, { key: 'nkaccu', label: 'NKACCU', color: 'var(--series-2)' }]} locale={locale} format={(v) => compact(v, locale)} ariaLabel={t('ACCU issuance by financial year (CER register)')} />
                  : <div className="empty-state">{t('Import the CER register to see issuance.')}</div>}
              </div>
            </div>

            <div className="stat-grid" style={{ marginTop: 22 }}>
              <StatCard label={t('CER projects')} value={num(s.register.projects)} sub={t('{n} active', { n: num(s.register.active_projects) })} />
              <StatCard label={t('ACCUs issued (all time)')} value={compact(s.register.accus_issued, locale)} sub={num(s.register.accus_issued)} />
              <StatCard label={t('Buyer enquiries (30 days)')} value={num(s.demand.enquiries_30d)} sub={t('{n} all time', { n: num(s.demand.enquiries_total) })} />
              <StatCard label={t('Open buyer demand')} value={num((s.demand.requested_quantity_open || 0) + (s.demand.introductions_quantity_open || 0))} sub={t('ACCUs requested in open enquiries and introductions')} />
            </div>

            <div className="grid-2">
              <div className="card panel">
                <div className="section-title" style={{ marginTop: 0 }}>{t('ACCUs issued by method type')}</div>
                <HBarList rows={s.register.by_type.map((r) => ({ label: r.label, value: r.accus }))} format={(v) => compact(v, locale)} />
              </div>
              <div className="card panel">
                <div className="section-title" style={{ marginTop: 0 }}>{t('Projects by state or territory')}</div>
                <HBarList rows={s.register.by_state.map((r) => ({ label: r.label, value: r.projects }))} format={(v) => num(v)} color="var(--series-1)" />
              </div>
            </div>

            <div className="section-title">
              <span>{t('Latest verified offers')}</span>
              <Link to="/marketplace" className="btn btn-outline btn-sm btn-arrow">{t('Open marketplace')}</Link>
            </div>
            <div className="card table-wrap">
              <table className="ledger-table">
                <thead><tr><th>{t('Project')}</th><th>{t('Type')}</th><th>{t('Vintage')}</th><th>{t('Category')}</th><th className="num">{t('Quantity')}</th><th className="num">{t('Indicative price')}</th><th>{t('Confirmed')}</th></tr></thead>
                <tbody>
                  {s.listings.recent_offers.map((o) => (
                    <tr key={o.id}>
                      <td>{o.listing_title || o.project_name}</td>
                      <td className="text-soft">{o.project_type || '—'}</td>
                      <td>{o.vintage || '—'}</td>
                      <td>{o.category || '—'}</td>
                      <td className="num">{num(o.quantity_available)}</td>
                      <td className="num">{money(o.indicative_price)}</td>
                      <td className="text-soft">{date(o.seller_confirmed_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!s.listings.recent_offers.length ? <div className="empty-state">{t('No live offers yet.')}</div> : null}
            </div>

            <div className="grid-2" style={{ marginTop: 22 }}>
              <div className="card panel">
                <div className="section-title" style={{ marginTop: 0 }}>{t('Supply by category')}</div>
                {s.listings.by_category.length ? s.listings.by_category.map((c) => (
                  <div className="doc-row" key={c.category}><strong style={{ minWidth: 110 }}>{c.category}</strong><span className="mono">{num(c.quantity)} ACCUs</span><span className="text-soft">{t('avg')} {money(c.avg_price)}</span></div>
                )) : <p className="text-soft">{t('No live offers yet.')}</p>}
              </div>
              <div className="card panel">
                <div className="section-title" style={{ marginTop: 0 }}>{t('Data sources')}</div>
                <p className="small text-soft">{t('CER register last imported')}: <strong>{s.register.last_import ? dateTime(s.register.last_import.completed_at) : t('not yet imported')}</strong></p>
                <p className="small text-soft">{t('Platform supply, prices and demand update in real time as sellers confirm availability and buyers enquire.')}</p>
                <p className="small text-soft" style={{ marginBottom: 0 }}>{t('Developers can read this data through the renewCo. API (/api/v1/market/summary).')}</p>
              </div>
            </div>
          </>
        )}
      </div>
      <Footer />
    </>
  );
}
