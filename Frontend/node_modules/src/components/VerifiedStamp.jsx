// The platform's signature element: a circular registry seal used anywhere
// a listing's ACCU verification needs to read as official, not decorative.
export default function VerifiedStamp({ size = 56, tone = 'brass', label = 'VERIFIED · ACCU REGISTRY · ' }) {
  const id = `stamp-path-${size}-${tone}`;
  const ring = tone === 'ink' ? 'var(--ink)' : 'var(--brass)';
  const text = label.repeat(2);

  return (
    <svg width={size} height={size} viewBox="0 0 100 100" role="img" aria-label="Verified on the ACCU registry">
      <defs>
        <path id={id} d="M 50,50 m -38,0 a 38,38 0 1,1 76,0 a 38,38 0 1,1 -76,0" />
      </defs>
      <circle cx="50" cy="50" r="46" fill="none" stroke={ring} strokeWidth="1.4" opacity="0.55" />
      <circle cx="50" cy="50" r="38" fill="none" stroke={ring} strokeWidth="1.4" />
      <text fontFamily="var(--font-mono)" fontSize="6.4" fontWeight="600" letterSpacing="1" fill={ring}>
        <textPath href={`#${id}`} startOffset="0%">{text}</textPath>
      </text>
      <g transform="translate(50,50)">
        <circle r="20" fill={ring} opacity="0.08" />
        <path d="M -9,0 L -2,8 L 11,-9" fill="none" stroke={ring} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      </g>
    </svg>
  );
}
