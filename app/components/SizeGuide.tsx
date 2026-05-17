import {useState} from 'react';

const BRANDS = [
  'Sandro',
  'Maje',
  'Isabel Marant',
  'Rouje',
  'Arket',
  'COS',
  '& Other Stories',
  'Toteme',
  'Zara',
  'H&M',
  'Mango',
  'Uniqlo',
  'ASOS',
  'AMI Paris',
  'A.P.C.',
];

const SIZES = ['XS', 'S', 'M', 'L', 'XL', '34', '36', '38', '40', '42', '44'];

interface SizeGuideResult {
  jacquemusSize: string;
  note: string;
}

export function SizeGuide() {
  const [expanded, setExpanded] = useState(false);
  const [brand, setBrand] = useState('');
  const [size, setSize] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SizeGuideResult | null>(null);

  const submit = async () => {
    if (!brand || !size || loading) return;
    setLoading(true);
    setResult(null);

    try {
      const res = await fetch('/api/size-guide', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({brand, size}),
      });
      const data = (await res.json()) as SizeGuideResult;
      setResult(data);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  };

  const toggle = () => {
    setExpanded((v) => !v);
    setResult(null);
    setBrand('');
    setSize('');
  };

  const selectStyle: React.CSSProperties = {
    background: '#fff',
    border: '1px solid #e8e8e8',
    padding: '8px 10px',
    fontSize: '10px',
    color: '#1a1a1a',
    outline: 'none',
    cursor: 'pointer',
    borderRadius: '2px',
    fontFamily: 'inherit',
    appearance: 'none',
    WebkitAppearance: 'none',
  };

  return (
    <div style={{marginTop: '10px', marginBottom: '2px'}}>
      <button
        onClick={toggle}
        style={{
          background: 'transparent',
          border: 'none',
          padding: 0,
          fontSize: '8px',
          color: '#aaa',
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          cursor: 'pointer',
          textDecoration: 'underline',
          textUnderlineOffset: '3px',
          transition: 'color 0.2s',
          fontFamily: 'inherit',
        }}
        onMouseEnter={(e) => (e.currentTarget.style.color = '#1a1a1a')}
        onMouseLeave={(e) => (e.currentTarget.style.color = '#aaa')}
        aria-label={expanded ? 'Fermer le guide des tailles' : 'Ouvrir le guide des tailles'}
      >
        {expanded ? 'Fermer le guide' : 'Guide des tailles →'}
      </button>

      {expanded && (
        <div
          style={{
            marginTop: '12px',
            padding: '16px',
            background: '#f8f6f2',
            borderRadius: '2px',
          }}
        >
          <p
            style={{
              fontSize: '7px',
              letterSpacing: '0.22em',
              textTransform: 'uppercase',
              color: '#aaa',
              margin: '0 0 12px',
            }}
          >
            Votre taille habituelle
          </p>

          <div style={{display: 'flex', gap: '8px', marginBottom: '10px', alignItems: 'stretch'}}>
            <select
              value={brand}
              onChange={(e) => {
                setBrand(e.target.value);
                setResult(null);
              }}
              style={{...selectStyle, flex: 1}}
              aria-label="Marque de référence"
            >
              <option value="">Marque</option>
              {BRANDS.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
            </select>

            <select
              value={size}
              onChange={(e) => {
                setSize(e.target.value);
                setResult(null);
              }}
              style={{...selectStyle, width: '72px'}}
              aria-label="Votre taille habituelle"
            >
              <option value="">Taille</option>
              {SIZES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>

            <button
              onClick={() => void submit()}
              disabled={!brand || !size || loading}
              style={{
                background: brand && size && !loading ? '#1a1a1a' : '#e8e8e8',
                color: brand && size && !loading ? '#fff' : '#bbb',
                border: 'none',
                padding: '0 16px',
                fontSize: '8px',
                letterSpacing: '0.12em',
                cursor: brand && size && !loading ? 'pointer' : 'default',
                transition: 'background 0.2s, color 0.2s',
                borderRadius: '2px',
                fontFamily: 'inherit',
                whiteSpace: 'nowrap',
              }}
              aria-label="Calculer la taille Jacquemus"
            >
              {loading ? '···' : '→'}
            </button>
          </div>

          {result && (
            <div
              style={{
                borderTop: '1px solid #e8e8e8',
                paddingTop: '12px',
              }}
            >
              <p
                style={{
                  fontSize: '14px',
                  fontWeight: 300,
                  color: '#1a1a1a',
                  margin: '0 0 5px',
                  letterSpacing: '0.02em',
                  lineHeight: 1.2,
                }}
              >
                Prenez un(e){' '}
                <strong style={{fontWeight: 500}}>{result.jacquemusSize}</strong>{' '}
                Jacquemus
              </p>
              {result.note && (
                <p
                  style={{
                    fontSize: '9px',
                    color: '#888',
                    lineHeight: 1.6,
                    margin: 0,
                    fontStyle: 'italic',
                    letterSpacing: '0.02em',
                  }}
                >
                  {result.note}
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
