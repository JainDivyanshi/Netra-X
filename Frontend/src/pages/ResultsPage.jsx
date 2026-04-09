import { useEffect, useState, useRef } from 'react';

/* ─── mock data for when backend isn't available ─── */
const MOCK_RESULTS = [
    { rank: 1, id: 'NX-00421', name: 'Subject Alpha', confidence: 94.7, age: 32, gender: 'Male', lastSeen: '2024-03-14', location: 'Sector 7-B', thumbnail: null },
    { rank: 2, id: 'NX-00887', name: 'Subject Beta',  confidence: 87.2, age: 28, gender: 'Female', lastSeen: '2024-02-28', location: 'Sector 2-A', thumbnail: null },
    { rank: 3, id: 'NX-01134', name: 'Subject Gamma', confidence: 73.5, age: 45, gender: 'Male', lastSeen: '2024-01-09', location: 'Sector 11-D', thumbnail: null },
    { rank: 4, id: 'NX-00302', name: 'Subject Delta', confidence: 61.1, age: 36, gender: 'Male', lastSeen: '2023-12-21', location: 'Sector 4-C', thumbnail: null },
    { rank: 5, id: 'NX-00759', name: 'Subject Epsilon',confidence: 48.3, age: 22, gender: 'Female', lastSeen: '2023-11-05', location: 'Sector 9-F', thumbnail: null },
];

/* ─── confidence colour helper ─── */
const confColor = (c) => {
    if (c >= 85) return '#00D4A0';
    if (c >= 65) return '#F0C040';
    return '#E05050';
};

/* ─── animated number ─── */
const AnimatedNumber = ({ value, decimals = 1, suffix = '' }) => {
    const [display, setDisplay] = useState(0);
    useEffect(() => {
        let start = 0;
        const end = parseFloat(value);
        const duration = 900;
        const step = 16;
        const increment = (end / duration) * step;
        const timer = setInterval(() => {
            start += increment;
            if (start >= end) { setDisplay(end); clearInterval(timer); }
            else setDisplay(start);
        }, step);
        return () => clearInterval(timer);
    }, [value]);
    return <>{display.toFixed(decimals)}{suffix}</>;
};

/* ─── scan line overlay ─── */
const ScanLines = () => (
    <div className="pointer-events-none fixed inset-0 z-0" style={{
        backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,212,160,0.015) 2px, rgba(0,212,160,0.015) 4px)',
    }}/>
);

/* ─── corner bracket decoration ─── */
const Bracket = ({ size = 12, color = '#00D4A040', pos }) => {
    const corners = {
        tl: { top: 0, left: 0, borderTop: `1.5px solid ${color}`, borderLeft: `1.5px solid ${color}` },
        tr: { top: 0, right: 0, borderTop: `1.5px solid ${color}`, borderRight: `1.5px solid ${color}` },
        bl: { bottom: 0, left: 0, borderBottom: `1.5px solid ${color}`, borderLeft: `1.5px solid ${color}` },
        br: { bottom: 0, right: 0, borderBottom: `1.5px solid ${color}`, borderRight: `1.5px solid ${color}` },
    };
    return <div style={{ position: 'absolute', width: size, height: size, ...corners[pos] }}/>;
};

/* ─── Result Card ─── */
const ResultCard = ({ result, sketchURL, delay = 0 }) => {
    const [visible, setVisible] = useState(false);
    const [hovered, setHovered] = useState(false);
    useEffect(() => {
        const t = setTimeout(() => setVisible(true), delay);
        return () => clearTimeout(t);
    }, [delay]);

    const bar = result.confidence;
    const isTop = result.rank === 1;

    return (
        <div
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            style={{
                opacity: visible ? 1 : 0,
                transform: visible ? 'translateY(0)' : 'translateY(20px)',
                transition: 'opacity 0.5s ease, transform 0.5s ease, box-shadow 0.3s ease, border-color 0.3s ease',
                background: isTop ? 'rgba(0,212,160,0.04)' : '#0D0D18',
                border: `1px solid ${hovered ? (isTop ? '#00D4A0' : '#2A2A4E') : (isTop ? 'rgba(0,212,160,0.3)' : '#1A1A2E')}`,
                borderRadius: 12,
                padding: '16px',
                position: 'relative',
                overflow: 'hidden',
                boxShadow: hovered
                    ? isTop ? '0 0 24px rgba(0,212,160,0.12)' : '0 0 16px rgba(0,0,0,0.4)'
                    : 'none',
            }}
        >
            <Bracket pos="tl" color={isTop ? '#00D4A060' : '#1A2A1A30'} size={10}/>
            <Bracket pos="br" color={isTop ? '#00D4A060' : '#1A2A1A30'} size={10}/>

            {/* rank badge + header */}
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 14 }}>
                {/* thumbnail / placeholder */}
                <div style={{
                    width: 52, height: 64, borderRadius: 6, overflow: 'hidden', flexShrink: 0,
                    background: '#080810', border: '1px solid #1A1A2E', position: 'relative',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                    {result.thumbnail
                        ? <img src={result.thumbnail} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', filter: 'grayscale(20%)' }}/>
                        : <svg width="22" height="28" viewBox="0 0 22 28" fill="none">
                            <rect x="5" y="1" width="12" height="14" rx="6" stroke="#2A2A4A" strokeWidth="1.2"/>
                            <path d="M1 27c0-5.523 4.477-10 10-10s10 4.477 10 10" stroke="#2A2A4A" strokeWidth="1.2"/>
                          </svg>
                    }
                    <div style={{
                        position: 'absolute', bottom: 0, left: 0, right: 0,
                        background: 'linear-gradient(transparent, rgba(0,0,0,0.7))',
                        textAlign: 'center', fontSize: 8, color: '#00D4A0',
                        fontFamily: 'monospace', paddingBottom: 2,
                    }}>#{result.rank}</div>
                </div>

                <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                        <span style={{
                            fontFamily: 'monospace', fontSize: 9,
                            color: '#4A4A6A', letterSpacing: '0.1em',
                        }}>{result.id}</span>
                        {isTop && (
                            <span style={{
                                fontSize: 8, padding: '1px 6px', borderRadius: 999,
                                background: 'rgba(0,212,160,0.12)',
                                border: '1px solid rgba(0,212,160,0.25)',
                                color: '#00D4A0', letterSpacing: '0.08em', fontWeight: 600,
                            }}>TOP MATCH</span>
                        )}
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#D0D0F0', marginBottom: 4, letterSpacing: '0.02em' }}>
                        {result.name}
                    </div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        {[['Age', result.age], ['Gender', result.gender], ['Sector', result.location]].map(([k, v]) => (
                            <span key={k} style={{ fontSize: 9, color: '#3A3A5A' }}>
                                <span style={{ color: '#2A2A4A' }}>{k}: </span>
                                <span style={{ color: '#6060A0' }}>{v}</span>
                            </span>
                        ))}
                    </div>
                </div>

                {/* confidence badge */}
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{
                        fontSize: 18, fontWeight: 700, fontFamily: 'monospace',
                        color: confColor(result.confidence), lineHeight: 1,
                        textShadow: `0 0 12px ${confColor(result.confidence)}60`,
                    }}>
                        <AnimatedNumber value={result.confidence} />%
                    </div>
                    <div style={{ fontSize: 8, color: '#2A2A4A', marginTop: 2, letterSpacing: '0.08em' }}>CONF.</div>
                </div>
            </div>

            {/* confidence bar */}
            <div style={{ position: 'relative' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: 8, color: '#2A2A4A', letterSpacing: '0.12em', textTransform: 'uppercase' }}>
                        Match confidence
                    </span>
                    <span style={{ fontSize: 8, fontFamily: 'monospace', color: '#3A3A5A' }}>
                        Last seen {result.lastSeen}
                    </span>
                </div>
                <div style={{ height: 3, background: '#0F0F1A', borderRadius: 2, overflow: 'hidden' }}>
                    <div style={{
                        height: '100%',
                        width: visible ? `${bar}%` : '0%',
                        background: `linear-gradient(90deg, ${confColor(result.confidence)}60, ${confColor(result.confidence)})`,
                        borderRadius: 2,
                        transition: `width 0.9s cubic-bezier(0.4, 0, 0.2, 1) ${delay + 200}ms`,
                        boxShadow: `0 0 6px ${confColor(result.confidence)}80`,
                    }}/>
                </div>
            </div>
        </div>
    );
};

/* ─── Main Results Page ─── */
const ResultsPage = ({ sketchURL, onBack }) => {
    const [phase, setPhase] = useState('scanning'); // scanning | done
    const [results, setResults] = useState([]);
    const [scanPct, setScanPct] = useState(0);
    const [statusMsg, setStatusMsg] = useState('Initialising neural scan...');

    const MESSAGES = [
        'Initialising neural scan...',
        'Extracting facial landmarks...',
        'Querying biometric database...',
        'Ranking similarity vectors...',
        'Compiling match report...',
    ];

    useEffect(() => {
        let pct = 0;
        let msgIdx = 0;
        const interval = setInterval(() => {
            pct += Math.random() * 6 + 2;
            if (pct > 100) pct = 100;
            setScanPct(Math.round(pct));
            const newIdx = Math.min(Math.floor((pct / 100) * MESSAGES.length), MESSAGES.length - 1);
            if (newIdx !== msgIdx) { msgIdx = newIdx; setStatusMsg(MESSAGES[msgIdx]); }
            if (pct >= 100) {
                clearInterval(interval);
                setTimeout(() => {
                    setResults(MOCK_RESULTS);
                    setPhase('done');
                }, 400);
            }
        }, 80);
        return () => clearInterval(interval);
    }, []);

    return (
        <div style={{
            minHeight: '100vh',
            background: '#080810',
            fontFamily: "'Inter', sans-serif",
            color: '#D0D0F0',
            display: 'flex',
            flexDirection: 'column',
        }}>
            <ScanLines/>

            {/* ── HEADER ── */}
            <header style={{
                height: 52,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0 20px',
                background: '#0D0D18',
                borderBottom: '1px solid #1A1A2E',
                position: 'relative',
                zIndex: 10,
                flexShrink: 0,
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <button onClick={onBack} style={{
                        display: 'flex', alignItems: 'center', gap: 6,
                        background: 'transparent', border: '1px solid #1A1A2E',
                        borderRadius: 999, padding: '4px 12px',
                        color: '#6060A0', fontSize: 11, cursor: 'pointer',
                        transition: 'all 0.2s',
                    }}
                        onMouseEnter={e => { e.currentTarget.style.borderColor = '#2A2A4E'; e.currentTarget.style.color = '#9090C0'; }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor = '#1A1A2E'; e.currentTarget.style.color = '#6060A0'; }}
                    >
                        <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                            <path d="M7 5H3M3 5l2.5-2.5M3 5l2.5 2.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                        </svg>
                        Back to Builder
                    </button>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: '#e6e6fa', letterSpacing: '0.22em', textShadow: '0 0 8px rgba(0,212,160,0.25)' }}>
                            NETRA-X
                        </span>
                        <span style={{ fontSize: 9, padding: '2px 7px', borderRadius: 4, background: '#1A1A2E', color: '#4A4A6A', letterSpacing: '0.15em' }}>
                            MATCH RESULTS
                        </span>
                    </div>
                </div>

                {phase === 'done' && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#00D4A0', boxShadow: '0 0 6px #00D4A0' }}/>
                        <span style={{ fontSize: 10, color: '#00D4A0', fontFamily: 'monospace', letterSpacing: '0.08em' }}>
                            {results.length} MATCHES FOUND
                        </span>
                    </div>
                )}
            </header>

            {/* ── BODY ── */}
            <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

                {/* LEFT: sketch preview */}
                <div style={{
                    width: 280, flexShrink: 0,
                    borderRight: '1px solid #1A1A2E',
                    background: '#0D0D18',
                    display: 'flex', flexDirection: 'column',
                    padding: '20px 16px',
                    gap: 16,
                }}>
                    <p style={{ fontSize: 9, fontWeight: 600, letterSpacing: '0.15em', textTransform: 'uppercase', color: '#00D4A0', margin: 0 }}>
                        Query Sketch
                    </p>

                    {/* sketch box */}
                    <div style={{
                        position: 'relative', border: '1px solid #1A1A2E', borderRadius: 10,
                        overflow: 'hidden', background: '#F5F4F0', aspectRatio: '7/5',
                    }}>
                        {sketchURL
                            ? <img src={sketchURL} alt="sketch" style={{ width: '100%', height: '100%', objectFit: 'contain' }}/>
                            : <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <span style={{ fontSize: 11, color: '#aaa' }}>No sketch</span>
                              </div>
                        }
                        {/* scan animation overlay */}
                        {phase === 'scanning' && (
                            <div style={{
                                position: 'absolute', inset: 0,
                                background: 'linear-gradient(transparent 40%, rgba(0,212,160,0.06) 50%, transparent 60%)',
                                backgroundSize: '100% 200%',
                                animation: 'scanAnim 1.5s linear infinite',
                            }}/>
                        )}
                        <Bracket pos="tl" color="#00D4A070" size={14}/>
                        <Bracket pos="tr" color="#00D4A070" size={14}/>
                        <Bracket pos="bl" color="#00D4A070" size={14}/>
                        <Bracket pos="br" color="#00D4A070" size={14}/>
                    </div>

                    {/* scan progress */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: 9, color: '#2A2A4A', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                                {phase === 'scanning' ? 'Scanning' : 'Complete'}
                            </span>
                            <span style={{ fontSize: 10, fontFamily: 'monospace', color: '#00D4A0' }}>
                                {scanPct}%
                            </span>
                        </div>
                        <div style={{ height: 2, background: '#0F0F1A', borderRadius: 1 }}>
                            <div style={{
                                height: '100%', width: `${scanPct}%`,
                                background: 'linear-gradient(90deg, #00D4A040, #00D4A0)',
                                borderRadius: 1,
                                transition: 'width 0.1s linear',
                                boxShadow: '0 0 6px #00D4A080',
                            }}/>
                        </div>
                        <p style={{ fontSize: 9, color: '#3A3A5A', fontFamily: 'monospace', margin: 0 }}>{statusMsg}</p>
                    </div>

                    {/* divider */}
                    <div style={{ borderTop: '1px solid #1A1A2E' }}/>

                    {/* meta */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {[
                            ['Database', 'NX-BIO-MASTER'],
                            ['Algorithm', 'DeepFace v3.4'],
                            ['Threshold', '≥ 40% conf.'],
                            ['Results', `${results.length} / 5`],
                        ].map(([k, v]) => (
                            <div key={k} style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span style={{ fontSize: 9, color: '#2A2A4A' }}>{k}</span>
                                <span style={{ fontSize: 9, fontFamily: 'monospace', color: '#5050A0' }}>{v}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* RIGHT: results list */}
                <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', scrollbarWidth: 'thin', scrollbarColor: '#1A1A2E transparent' }}>
                    <div style={{ maxWidth: 760, margin: '0 auto' }}>

                        {/* heading row */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                            <div>
                                <h1 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#E0E0F8', letterSpacing: '0.04em' }}>
                                    Face Match Report
                                </h1>
                                <p style={{ margin: '4px 0 0', fontSize: 11, color: '#3A3A5A', fontFamily: 'monospace' }}>
                                    {new Date().toISOString().replace('T', ' ').slice(0, 19)} UTC
                                </p>
                            </div>
                            {phase === 'done' && (
                                <button style={{
                                    fontSize: 11, padding: '6px 16px',
                                    background: 'transparent', border: '1px solid #1A1A2E',
                                    borderRadius: 999, color: '#6060A0', cursor: 'pointer',
                                    transition: 'all 0.2s',
                                }}
                                    onMouseEnter={e => { e.currentTarget.style.borderColor = '#2A2A4E'; e.currentTarget.style.color = '#9090C0'; }}
                                    onMouseLeave={e => { e.currentTarget.style.borderColor = '#1A1A2E'; e.currentTarget.style.color = '#6060A0'; }}
                                    onClick={() => {
                                        const data = JSON.stringify(results, null, 2);
                                        const blob = new Blob([data], { type: 'application/json' });
                                        const a = document.createElement('a');
                                        a.href = URL.createObjectURL(blob);
                                        a.download = 'netra-x-matches.json';
                                        a.click();
                                    }}
                                >
                                    Export Report
                                </button>
                            )}
                        </div>

                        {/* scanning placeholder */}
                        {phase === 'scanning' && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                                {[1,2,3,4,5].map(i => (
                                    <div key={i} style={{
                                        height: 96, borderRadius: 12,
                                        background: '#0D0D18',
                                        border: '1px solid #1A1A2E',
                                        overflow: 'hidden', position: 'relative',
                                    }}>
                                        <div style={{
                                            position: 'absolute', inset: 0,
                                            background: 'linear-gradient(90deg, transparent 0%, rgba(0,212,160,0.03) 50%, transparent 100%)',
                                            backgroundSize: '200% 100%',
                                            animation: `shimmer ${1 + i * 0.15}s linear infinite`,
                                        }}/>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* results */}
                        {phase === 'done' && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                {results.map((r, i) => (
                                    <ResultCard key={r.id} result={r} sketchURL={sketchURL} delay={i * 100}/>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <style>{`
                @keyframes scanAnim {
                    0% { background-position: 0 -100%; }
                    100% { background-position: 0 200%; }
                }
                @keyframes shimmer {
                    0% { background-position: -200% 0; }
                    100% { background-position: 200% 0; }
                }
            `}</style>
        </div>
    );
};

export default ResultsPage;