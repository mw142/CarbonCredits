import { useI18n } from '../i18n/I18nContext';

/** Scrolling strip of live market figures. Pass the snapshot from useMarketStream. */
export default function MarketTicker({ snapshot, live }) {
  const { t, num, money } = useI18n();
  if (!snapshot) return null;
  const items = [
    ...snapshot.prices.map((p) => ({
      label: p.instrument,
      value: money(p.latest?.price),
      change: p.change_pct,
    })),
    { label: t('Weighted avg. offer'), value: money(snapshot.listings.weighted_avg_price) },
    { label: t('ACCUs offered'), value: num(snapshot.listings.total_available) },
    { label: t('Verified listings'), value: num(snapshot.listings.published) },
    { label: t('CER projects'), value: num(snapshot.register.projects) },
    { label: t('ACCUs issued'), value: num(snapshot.register.accus_issued) },
    { label: t('Open buyer demand'), value: num((snapshot.demand.requested_quantity_open || 0) + (snapshot.demand.introductions_quantity_open || 0)) },
  ];
  const row = items.map((item, i) => (
    <span className="ticker-item" key={`${item.label}-${i}`}>
      {item.label}<b>{item.value}</b>
      {item.change != null ? <span className={item.change >= 0 ? 'up' : 'down'}> {item.change >= 0 ? '▲' : '▼'} {Math.abs(item.change).toFixed(1)}%</span> : null}
    </span>
  ));
  return (
    <div className="ticker" aria-label={t('Live market data')}>
      <div className="container ticker-inner">
        <span className="ticker-label"><span className="live-dot" data-state={live ? 'on' : 'off'} /> {t('Live market')}</span>
        <div className="ticker-track">
          <div className="ticker-items">{row}{row}</div>
        </div>
      </div>
    </div>
  );
}
