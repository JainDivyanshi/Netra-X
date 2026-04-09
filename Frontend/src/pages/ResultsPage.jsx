import { useEffect, useState, useRef } from 'react';

/* ─────────────────────────────────────────────────────────────────────────────
   CONFIG — point this at your FastAPI server
   Override with an env var in Vite:  VITE_API_BASE_URL=http://your-server:8000
───────────────────────────────────────────────────────────────────────────── */
const API_BASE = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_BASE_URL)
    ? import.meta.env.VITE_API_BASE_URL
    : 'https://masterank-netra-x-modelapi.hf.space';

/* ─────────────────────────────────────────────────────────────────────────────
   API helpers
───────────────────────────────────────────────────────────────────────────── */

/**
 * POST /match/images
 * Sends the sketch file to the backend and receives top-k results,
 * each with an embedded base64 photo thumbnail.
 *
 * @param {File}   sketchFile   - the raw File object from the sketch builder
 * @param {number} topK         - how many results to request (default 5)
 * @param {number} maxDim       - thumbnail max pixel dimension (default 400)
 * @returns {Promise<object>}   - full API response JSON
 */
async function fetchMatchResults(sketchFile, topK = 5, maxDim = 400) {
    const fd = new FormData();
    fd.append('file',    sketchFile);
    fd.append('top_k',   String(topK));
    fd.append('max_dim', String(maxDim));

    const resp = await fetch(`${API_BASE}/match/images`, {
        method: 'POST',
        body:   fd,
    });

    if (!resp.ok) {
        // Try to parse a FastAPI detail message, fall back to HTTP status
        let detail = `HTTP ${resp.status}`;
        try { detail = (await resp.json()).detail ?? detail; } catch (_) {}
        throw new Error(detail);
    }

    return resp.json();
}

/**
 * Convert a raw backend result item into the shape ResultCard expects.
 * Maps similarity (0–1) → confidence (0–100), adds display id/name from filename.
 */
function mapApiResult(item) {
    const fname = item.filename ?? item.photo_path?.split(/[\\/]/).pop() ?? `match-${item.rank}`;
    // Strip extension for display
    const nameBase = fname.replace(/\.[^.]+$/, '');

    return {
        rank:       item.rank,
        id:         `NX-${String(item.rank).padStart(5, '0')}`,
        name:       nameBase,
        confidence: parseFloat((item.similarity * 100).toFixed(1)),
        // Extra stats surfaced from the API (shown in card footer)
        similarity: item.similarity,
        filename:   fname,
        photo_path: item.photo_path,
        // Base64 thumbnail — data-URI prefix added here once
        thumbnail:  item.image_b64
            ? `data:image/jpeg;base64,${item.image_b64}`
            : null,
        // Fields that exist in the mock but not in the model response;
        // kept as '—' so the card UI doesn't break
        age:      '—',
        gender:   '—',
        lastSeen: '—',
        location: '—',
    };
}

/* ─────────────────────────────────────────────────────────────────────────────
   Shared UI primitives  (unchanged from original)
───────────────────────────────────────────────────────────────────────────── */

const confColor = (c) => {
    if (c >= 85) return '#00D4A0';
    if (c >= 65) return '#F0C040';
    return '#E05050';
};

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

const ScanLines = () => (
    <div className="pointer-events-none fixed inset-0 z-0" style={{
        backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,212,160,0.015) 2px, rgba(0,212,160,0.015) 4px)',
    }}/>
);

const Bracket = ({ size = 12, color = '#00D4A040', pos }) => {
    const corners = {
        tl: { top: 0, left: 0, borderTop: `1.5px solid ${color}`, borderLeft: `1.5px solid ${color}` },
        tr: { top: 0, right: 0, borderTop: `1.5px solid ${color}`, borderRight: `1.5px solid ${color}` },
        bl: { bottom: 0, left: 0, borderBottom: `1.5px solid ${color}`, borderLeft: `1.5px solid ${color}` },
        br: { bottom: 0, right: 0, borderBottom: `1.5px solid ${color}`, borderRight: `1.5px solid ${color}` },
    };
    return <div style={{ position: 'absolute', width: size, height: size, ...corners[pos] }}/>;
};

/* ─────────────────────────────────────────────────────────────────────────────
   ResultCard — now uses real thumbnail + real similarity score
───────────────────────────────────────────────────────────────────────────── */
const ResultCard = ({ result, delay = 0 }) => {
    const [visible, setVisible] = useState(false);
    const [hovered, setHovered] = useState(false);
    useEffect(() => {
        const t = setTimeout(() => setVisible(true), delay);
        return () => clearTimeout(t);
    }, [delay]);

    const bar   = result.confidence;
    const isTop = result.rank === 1;

    return (
        <div
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
            style={{
                opacity:   visible ? 1 : 0,
                transform: visible ? 'translateY(0)' : 'translateY(20px)',
                transition: 'opacity 0.5s ease, transform 0.5s ease, box-shadow 0.3s ease, border-color 0.3s ease',
                background: isTop ? 'rgba(0,212,160,0.04)' : '#0D0D18',
                border: `1px solid ${hovered
                    ? (isTop ? '#00D4A0' : '#2A2A4E')
                    : (isTop ? 'rgba(0,212,160,0.3)' : '#1A1A2E')}`,
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

                {/* ── Thumbnail — real photo from the model ── */}
                <div style={{
                    width: 52, height: 64, borderRadius: 6, overflow: 'hidden', flexShrink: 0,
                    background: '#080810', border: `1px solid ${isTop ? 'rgba(0,212,160,0.2)' : '#1A1A2E'}`,
                    position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                    {result.thumbnail ? (
                        <img
                            src={result.thumbnail}
                            alt={`Match rank ${result.rank}`}
                            style={{ width: '100%', height: '100%', objectFit: 'cover', filter: 'grayscale(20%)' }}
                        />
                    ) : (
                        /* Fallback silhouette when no image returned */
                        <svg width="22" height="28" viewBox="0 0 22 28" fill="none">
                            <rect x="5" y="1" width="12" height="14" rx="6" stroke="#2A2A4A" strokeWidth="1.2"/>
                            <path d="M1 27c0-5.523 4.477-10 10-10s10 4.477 10 10" stroke="#2A2A4A" strokeWidth="1.2"/>
                        </svg>
                    )}
                    <div style={{
                        position: 'absolute', bottom: 0, left: 0, right: 0,
                        background: 'linear-gradient(transparent, rgba(0,0,0,0.75))',
                        textAlign: 'center', fontSize: 8, color: '#00D4A0',
                        fontFamily: 'monospace', paddingBottom: 2,
                    }}>#{result.rank}</div>
                </div>

                <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 3 }}>
                        <span style={{ fontFamily: 'monospace', fontSize: 9, color: '#4A4A6A', letterSpacing: '0.1em' }}>
                            {result.id}
                        </span>
                        {isTop && (
                            <span style={{
                                fontSize: 8, padding: '1px 6px', borderRadius: 999,
                                background: 'rgba(0,212,160,0.12)',
                                border: '1px solid rgba(0,212,160,0.25)',
                                color: '#00D4A0', letterSpacing: '0.08em', fontWeight: 600,
                            }}>TOP MATCH</span>
                        )}
                    </div>

                    {/* filename as subject name */}
                    <div style={{
                        fontSize: 13, fontWeight: 600, color: '#D0D0F0', marginBottom: 4,
                        letterSpacing: '0.02em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                    }}>
                        {result.name}
                    </div>

                    {/* real similarity score + raw path */}
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 9 }}>
                            <span style={{ color: '#2A2A4A' }}>Similarity: </span>
                            <span style={{ color: '#6060A0', fontFamily: 'monospace' }}>
                                {result.similarity?.toFixed(4) ?? '—'}
                            </span>
                        </span>
                        <span style={{ fontSize: 9 }}>
                            <span style={{ color: '#2A2A4A' }}>File: </span>
                            <span style={{ color: '#6060A0', fontFamily: 'monospace' }}>{result.filename}</span>
                        </span>
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
                        cos sim {result.similarity?.toFixed(3) ?? '—'}
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

/* ─────────────────────────────────────────────────────────────────────────────
   Error banner
───────────────────────────────────────────────────────────────────────────── */
const ErrorBanner = ({ message, onRetry }) => (
    <div style={{
        margin: '24px auto', maxWidth: 520,
        background: 'rgba(224,80,80,0.07)',
        border: '1px solid rgba(224,80,80,0.25)',
        borderRadius: 10, padding: '18px 20px',
    }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
            <div style={{ fontSize: 16, marginTop: 1 }}>⚠</div>
            <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#E05050', marginBottom: 6 }}>
                    API Error
                </div>
                <div style={{ fontSize: 11, color: '#8A4040', fontFamily: 'monospace', lineHeight: 1.6, wordBreak: 'break-all' }}>
                    {message}
                </div>
                <div style={{ fontSize: 10, color: '#5A3030', marginTop: 8 }}>
                    Make sure your FastAPI server is running at <code style={{ color: '#A04040' }}>{API_BASE}</code>
                </div>
            </div>
        </div>
        {onRetry && (
            <button
                onClick={onRetry}
                style={{
                    marginTop: 14, fontSize: 10, padding: '5px 14px',
                    background: 'transparent', border: '1px solid rgba(224,80,80,0.3)',
                    borderRadius: 999, color: '#A05050', cursor: 'pointer',
                }}
            >
                ↻ Retry
            </button>
        )}
    </div>
);

/* ─────────────────────────────────────────────────────────────────────────────
   Main ResultsPage
   Props:
     sketchURL  {string}  — data-URL or object-URL of the sketch (for preview)
     sketchFile {File}    — raw File object sent to the API
     onBack     {fn}      — navigates back to the sketch builder
───────────────────────────────────────────────────────────────────────────── */
const ResultsPage = ({ sketchURL, sketchFile, onBack }) => {
    const [phase, setPhase]       = useState('idle');    // 'idle' | 'scanning' | 'done' | 'error'
    const [results, setResults]   = useState([]);
    const [scanPct, setScanPct]   = useState(0);
    const [statusMsg, setStatusMsg] = useState('Initialising neural scan...');
    const [apiMeta, setApiMeta]   = useState(null);   // { match_found, similarity, gap, z_score, percentile }
    const [errorMsg, setErrorMsg] = useState('');

    // Custom upload state
    const [uploadedSketchURL,  setUploadedSketchURL]  = useState(null);
    const [uploadedSketchFile, setUploadedSketchFile] = useState(null);
    const [uploadDragOver,     setUploadDragOver]     = useState(false);
    const uploadInputRef = useRef(null);

    // Resolved sketch — prefer user-uploaded, fall back to prop
    const activeSketchURL  = uploadedSketchURL  ?? sketchURL;
    const activeSketchFile = uploadedSketchFile ?? sketchFile;

    const handleUploadFile = (file) => {
        if (!file || !file.type.startsWith('image/')) return;
        setUploadedSketchFile(file);
        setUploadedSketchURL(URL.createObjectURL(file));
        // Reset results so user can re-run with the new sketch
        setPhase('idle');
        setResults([]);
        setApiMeta(null);
        setScanPct(0);
        setErrorMsg('');
    };

    const MESSAGES = [
        'Initialising neural scan...',
        'Extracting embedding vectors...',
        'Querying biometric database...',
        'Ranking similarity vectors...',
        'Compiling match report...',
    ];

    /* ── Start scan: animate progress bar while awaiting API ── */
    const [startKey, setStartKey] = useState(0);

    const triggerScan = () => {
        setPhase('scanning');
        setScanPct(0);
        setStatusMsg('Initialising neural scan...');
        setResults([]);
        setApiMeta(null);
        setErrorMsg('');
        setStartKey(k => k + 1);
    };

    useEffect(() => {
        if (startKey === 0) return; // wait for explicit trigger
        let pct       = 0;
        let msgIdx    = 0;
        let cancelled = false;

        // Ramp bar to ~85 % quickly, then slow-crawl while awaiting real data
        const interval = setInterval(() => {
            if (cancelled) return;
            const maxNow = apiPending ? 85 : 100;
            pct += Math.random() * 5 + (pct < 50 ? 3 : 1);
            if (pct > maxNow) pct = maxNow;
            setScanPct(Math.round(pct));

            const newIdx = Math.min(Math.floor((pct / 100) * MESSAGES.length), MESSAGES.length - 1);
            if (newIdx !== msgIdx) { msgIdx = newIdx; setStatusMsg(MESSAGES[msgIdx]); }
        }, 80);

        let apiPending = true;

        /* ── Real API call ── */
        const run = async () => {
            try {
                // If caller didn't pass a File, try to synthesise one from the data-URL
                let file = activeSketchFile;
                if (!file && activeSketchURL) {
                    file = await dataURLtoFile(activeSketchURL, 'sketch.jpg');
                }
                if (!file) throw new Error('No sketch file provided. Pass sketchFile prop or upload one.');


                const data = await fetchMatchResults(file, 5, 400);

                if (cancelled) return;
                apiPending = false;

                // Store top-level stats
                setApiMeta({
                    match_found: data.match_found,
                    similarity:  data.similarity,
                    gap:         data.gap,
                    z_score:     data.z_score,
                    percentile:  data.percentile,
                });

                // Map API items → card-compatible shape
                const mapped = (data.top_k_results ?? []).map(mapApiResult);
                setResults(mapped);

                // Finish bar animation
                setScanPct(100);
                setStatusMsg('Match report compiled.');
                setTimeout(() => { if (!cancelled) setPhase('done'); }, 400);
            } catch (err) {
                if (cancelled) return;
                apiPending = false;
                clearInterval(interval);
                setErrorMsg(err.message || String(err));
                setScanPct(0);
                setPhase('error');
            }
        };

        run();

        return () => {
            cancelled = true;
            clearInterval(interval);
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [startKey]);

    /* ── Retry handler ── */
    const handleRetry = () => triggerScan();

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

                {/* ── Live API stats in header when done ── */}
                {phase === 'done' && apiMeta && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                        {/* Match found badge */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                            <div style={{
                                width: 6, height: 6, borderRadius: '50%',
                                background: apiMeta.match_found ? '#00D4A0' : '#E05050',
                                boxShadow: `0 0 6px ${apiMeta.match_found ? '#00D4A0' : '#E05050'}`,
                            }}/>
                            <span style={{
                                fontSize: 10, fontFamily: 'monospace', letterSpacing: '0.08em',
                                color: apiMeta.match_found ? '#00D4A0' : '#E05050',
                            }}>
                                {apiMeta.match_found ? 'MATCH CONFIRMED' : 'NO CONFIDENT MATCH'}
                            </span>
                        </div>

                        {/* Quick stats */}
                        {[
                            ['SIM',  apiMeta.similarity?.toFixed(3)],
                            ['GAP',  apiMeta.gap?.toFixed(3)],
                            ['Z',    apiMeta.z_score?.toFixed(2)],
                            ['PCTILE', (apiMeta.percentile * 100)?.toFixed(1) + '%'],
                        ].map(([label, val]) => (
                            <div key={label} style={{ textAlign: 'center' }}>
                                <div style={{ fontSize: 7, color: '#2A2A4A', letterSpacing: '0.1em' }}>{label}</div>
                                <div style={{ fontSize: 11, fontFamily: 'monospace', color: '#5050A0' }}>{val}</div>
                            </div>
                        ))}

                        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                            <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#00D4A0', boxShadow: '0 0 6px #00D4A0' }}/>
                            <span style={{ fontSize: 10, color: '#00D4A0', fontFamily: 'monospace', letterSpacing: '0.08em' }}>
                                {results.length} MATCHES FOUND
                            </span>
                        </div>
                    </div>
                )}
            </header>

            {/* ── BODY ── */}
            <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

                {/* LEFT: sketch preview + scan status */}
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
                        {activeSketchURL
                            ? <img src={activeSketchURL} alt="sketch" style={{ width: '100%', height: '100%', objectFit: 'contain' }}/>
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

                    {/* ── Custom Sketch Upload ── */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        <p style={{ fontSize: 9, fontWeight: 600, letterSpacing: '0.15em', textTransform: 'uppercase', color: '#3A3A6A', margin: 0 }}>
                            Upload Custom Sketch
                        </p>

                        {/* Hidden file input */}
                        <input
                            ref={uploadInputRef}
                            type="file"
                            accept="image/*"
                            style={{ display: 'none' }}
                            onChange={e => { if (e.target.files[0]) handleUploadFile(e.target.files[0]); }}
                        />

                        {/* Drop zone */}
                        <div
                            onClick={() => uploadInputRef.current?.click()}
                            onDragOver={e => { e.preventDefault(); setUploadDragOver(true); }}
                            onDragLeave={() => setUploadDragOver(false)}
                            onDrop={e => {
                                e.preventDefault();
                                setUploadDragOver(false);
                                handleUploadFile(e.dataTransfer.files[0]);
                            }}
                            style={{
                                border: `1px dashed ${uploadDragOver ? '#00D4A0' : '#2A2A4E'}`,
                                borderRadius: 8,
                                padding: '12px 8px',
                                textAlign: 'center',
                                cursor: 'pointer',
                                background: uploadDragOver ? 'rgba(0,212,160,0.04)' : 'transparent',
                                transition: 'all 0.2s',
                            }}
                        >
                            <div style={{ fontSize: 16, marginBottom: 4, opacity: 0.5 }}>⬆</div>
                            <div style={{ fontSize: 9, color: '#4A4A6A', lineHeight: 1.5 }}>
                                {uploadedSketchFile
                                    ? <span style={{ color: '#00D4A080' }}>{uploadedSketchFile.name}</span>
                                    : <>Drop image here or <span style={{ color: '#5050A0', textDecoration: 'underline' }}>browse</span></>
                                }
                            </div>
                            <div style={{ fontSize: 8, color: '#2A2A4A', marginTop: 3 }}>PNG · JPG · WEBP</div>
                        </div>
                    </div>

                    {/* ── Run Scan button ── */}
                    <button
                        onClick={triggerScan}
                        disabled={phase === 'scanning' || !activeSketchURL}
                        style={{
                            width: '100%',
                            padding: '8px 0',
                            borderRadius: 8,
                            border: '1px solid',
                            borderColor: phase === 'scanning' || !activeSketchURL ? '#1A1A2E' : 'rgba(0,212,160,0.4)',
                            background: phase === 'scanning' || !activeSketchURL ? '#0D0D18' : 'rgba(0,212,160,0.07)',
                            color: phase === 'scanning' || !activeSketchURL ? '#3A3A5A' : '#00D4A0',
                            fontSize: 10,
                            fontWeight: 600,
                            letterSpacing: '0.12em',
                            textTransform: 'uppercase',
                            cursor: phase === 'scanning' || !activeSketchURL ? 'not-allowed' : 'pointer',
                            transition: 'all 0.2s',
                        }}
                    >
                        {phase === 'scanning' ? '⟳ Scanning…' : '▶ Run Scan'}
                    </button>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: 9, color: '#2A2A4A', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
                                {phase === 'scanning' ? 'Scanning' : phase === 'error' ? 'Error' : 'Complete'}
                            </span>
                            <span style={{ fontSize: 10, fontFamily: 'monospace', color: phase === 'error' ? '#E05050' : '#00D4A0' }}>
                                {phase === 'error' ? 'ERR' : `${scanPct}%`}
                            </span>
                        </div>
                        <div style={{ height: 2, background: '#0F0F1A', borderRadius: 1 }}>
                            <div style={{
                                height: '100%',
                                width: phase === 'error' ? '100%' : `${scanPct}%`,
                                background: phase === 'error'
                                    ? 'linear-gradient(90deg, #E0505040, #E05050)'
                                    : 'linear-gradient(90deg, #00D4A040, #00D4A0)',
                                borderRadius: 1,
                                transition: 'width 0.1s linear',
                                boxShadow: phase === 'error' ? '0 0 6px #E0505080' : '0 0 6px #00D4A080',
                            }}/>
                        </div>
                        <p style={{ fontSize: 9, color: '#3A3A5A', fontFamily: 'monospace', margin: 0 }}>{statusMsg}</p>
                    </div>

                    {/* divider */}
                    <div style={{ borderTop: '1px solid #1A1A2E' }}/>

                    {/* meta — real values when done, placeholders while scanning */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {[
                            ['Endpoint',   `${API_BASE}/match/images`],
                            ['Algorithm',  'ResNet50 Triplet'],
                            ['Embed Dim',  '128-D cosine'],
                            ['Threshold',  'sim≥0.30 | gap≥0.06'],
                            ['Results',    phase === 'done' ? `${results.length} / 5` : '— / 5'],
                        ].map(([k, v]) => (
                            <div key={k} style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                                <span style={{ fontSize: 9, color: '#2A2A4A', flexShrink: 0 }}>{k}</span>
                                <span style={{
                                    fontSize: 9, fontFamily: 'monospace', color: '#5050A0',
                                    textAlign: 'right', wordBreak: 'break-all',
                                }}>{v}</span>
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
                                    Sketch Match Report
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
                                        // Export includes full API response + mapped results
                                        const payload = {
                                            generated_at: new Date().toISOString(),
                                            api_base:     API_BASE,
                                            stats:        apiMeta,
                                            results:      results.map(r => ({
                                                rank:       r.rank,
                                                filename:   r.filename,
                                                photo_path: r.photo_path,
                                                similarity: r.similarity,
                                                confidence: r.confidence,
                                            })),
                                        };
                                        const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
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

                        {/* idle state — prompt user to run scan */}
                        {phase === 'idle' && (
                            <div style={{
                                textAlign: 'center', padding: '64px 24px',
                                color: '#3A3A5A', fontFamily: 'monospace', fontSize: 12,
                            }}>
                                <div style={{ fontSize: 28, marginBottom: 12, opacity: 0.3 }}>◎</div>
                                Upload a sketch or use the one from the builder, then press{' '}
                                <span style={{ color: '#5050A0' }}>Run Scan</span> to begin matching.
                            </div>
                        )}

                        {/* scanning placeholder skeletons */}
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

                        {/* error state */}
                        {phase === 'error' && (
                            <ErrorBanner message={errorMsg} onRetry={handleRetry} />
                        )}

                        {/* real results */}
                        {phase === 'done' && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                {results.length === 0 ? (
                                    <div style={{
                                        textAlign: 'center', padding: '48px 24px',
                                        color: '#3A3A5A', fontFamily: 'monospace', fontSize: 12,
                                    }}>
                                        No results returned by the API.
                                    </div>
                                ) : (
                                    results.map((r, i) => (
                                        <ResultCard key={`${r.id}-${i}`} result={r} delay={i * 100}/>
                                    ))
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <style>{`
                @keyframes scanAnim {
                    0%   { background-position: 0 -100%; }
                    100% { background-position: 0  200%; }
                }
                @keyframes shimmer {
                    0%   { background-position: -200% 0; }
                    100% { background-position:  200% 0; }
                }
            `}</style>
        </div>
    );
};

/* ─────────────────────────────────────────────────────────────────────────────
   Utility: convert a data-URL → File object
   (needed when the sketch builder gives us a data-URL instead of a raw File)
───────────────────────────────────────────────────────────────────────────── */
async function dataURLtoFile(dataUrl, filename = 'sketch.jpg') {
    const res  = await fetch(dataUrl);
    const blob = await res.blob();
    return new File([blob], filename, { type: blob.type || 'image/jpeg' });
}

export default ResultsPage;