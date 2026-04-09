import { useState, useRef, useEffect } from 'react';
import { Stage, Layer, Image as KonvaImage, Transformer } from 'react-konva';
import useImage from 'use-image';
import ResultsPage from './ResultsPage';
import { FILES } from '../facialjson'; 

/* ---------- utils ---------- */
const dataURLToBlob = (dataURL) => {
    const byteString = atob(dataURL.split(',')[1]);
    const mimeString = dataURL.split(',')[0].split(':')[1].split(';')[0];
    const ab = new ArrayBuffer(byteString.length);
    const ia = new Uint8Array(ab);
    for (let i = 0; i < byteString.length; i++) ia[i] = byteString.charCodeAt(i);
    return new Blob([ab], { type: mimeString });
};

/* ---------- FACE DATA ---------- */
const DEFAULT_LAYER = {
    neck: 0, face: 1, hair: 3, ears: 0,
    eyes: 4, nose: 4, eyebrows: 2, lips: 4, marks: 5, accessories: 6,
};

// Default canvas dimensions per category (width × height in px).
// Used when placing a new element; can be adjusted by the user afterwards.
const CATEGORY_DEFAULT_SIZE = {
    face:        { width: 400, height: 500 },
    neck:        { width: 400, height: 500 },
    hair:        { width: 400, height: 500 },
    ears:        { width: 400, height: 500 },
    eyes:        { width: 400, height: 500 },
    nose:        { width: 400, height: 500 },
    eyebrows:    { width: 400, height: 500 },
    lips:        { width: 400, height: 500 },
    marks:       { width: 400, height: 500 },
    accessories: { width: 400, height: 500 },
};

/**
 * Derive a human-readable label and category from a dataset filename.
 *
 * Expected pattern (from the dataset):
 *   <category>-<gender><variant>-<index>-<sub>-<size>.png
 *
 * Examples
 *   lips-m1-012-01-sz1.png   →  category=lips,   label="Lips M1 #012-01"
 *   neck-f-017-01-sz1.png    →  category=neck,   label="Neck F  #017-01"
 *   eyes-m2-003-02-sz1.png   →  category=eyes,   label="Eyes M2 #003-02"
 *
 * Any filename that doesn't match the pattern falls back gracefully.
 */
function parseFilename(filename) {
    // Strip extension
    const base = filename.replace(/\.[^.]+$/, '');

    // Known categories ordered longest-first so "eyebrows" matches before "eye"
    const KNOWN = [
        'eyebrows', 'accessories', 'marks',
        'face', 'neck', 'hair', 'ears', 'eyes', 'nose', 'lips',
    ];

    let category = 'accessories';
    for (const c of KNOWN) {
        if (base.toLowerCase().startsWith(c)) { category = c; break; }
    }

    // Try to extract variant + index tokens after the category prefix
    // e.g.  "lips-m1-012-01-sz1"  →  parts = ["m1","012","01","sz1"]
    const rest  = base.slice(category.length).replace(/^[-_]/, '');
    const parts = rest.split(/[-_]/).filter(Boolean);

    // Drop trailing size token like "sz1", "sz2"
    const filtered = parts.filter(p => !/^sz\d+$/i.test(p));

    // Build a compact display name: "Lips M1 #012-01"
    let label = category.charAt(0).toUpperCase() + category.slice(1);
    if (filtered.length >= 1) label += ' ' + filtered[0].toUpperCase();     // variant/gender
    if (filtered.length >= 3) label += ' #' + filtered[1] + '-' + filtered[2]; // index-sub
    else if (filtered.length === 2) label += ' #' + filtered[1];

    return { category, label };
}

function loadDatasetParts() {
    const map = {};

    for (const filename of FILES) {
        const { category, label } = parseFilename(filename);
        const thumbName = filename.replace(/\.png$/i, '.webp');

        if (!map[category]) map[category] = [];

        const size = CATEGORY_DEFAULT_SIZE[category] ?? { width: 120, height: 120 };
        const BASE = import.meta.env.BASE_URL;
        console.log(BASE);
        map[category].push({
            id: `${category}_${filename}`,
            name: label,
            category,
            filename,
            thumbnailSrc: `/FacialDataset/Thumbnails/${thumbName}`,
            src: `/FacialDataset/Elements/${filename}`,
            ...size,
        });
    }

    return map;
}

const CATEGORIES = [
    { name: 'face',        icon: '⬤',  label: 'Head' },
    { name: 'neck',        icon: '⬤',  label: 'Neck' },
    { name: 'hair',        icon: '⬤',  label: 'Hair' },
    { name: 'eyes',        icon: '⬤',  label: 'Eyes' },
    { name: 'nose',        icon: '⬤',  label: 'Nose' },
    { name: 'lips',        icon: '⬤',  label: 'Lips' },
    { name: 'ears',        icon: '⬤',  label: 'Ears' },
    { name: 'eyebrows',    icon: '⬤',  label: 'Eyebrows' },
    { name: 'marks',       icon: '⬤',  label: 'Marks' },
    { name: 'accessories', icon: '⬤',  label: 'Accessories' },
];

/* ---------- Field ---------- */
const Field = ({ label, value, onChange, half = false }) => (
    <div className={half ? 'w-[calc(50%-4px)]' : 'w-full'}>
        <p className="text-[10px] font-medium tracking-widest uppercase mb-1"
            style={{ color: '#4A4A6A' }}>{label}</p>
        <input
            type="number"
            value={Math.round(value)}
            onChange={(e) => onChange(Number(e.target.value))}
            className="w-full px-3 py-1.5 rounded-md text-sm focus:outline-none transition-colors"
            style={{
                background: '#0F0F1A',
                border: '1px solid #1E1E32',
                color: '#D8D8F0',
                fontFamily: 'monospace',
            }}
            onFocus={e => e.target.style.borderColor = '#00D4A0'}
            onBlur={e => e.target.style.borderColor = '#1E1E32'}
        />
    </div>
);

/* ---------- Builder ---------- */
const Builder = () => {
    const [elements, setElements] = useState([]);
    const [selectedId, setSelectedId] = useState(null);
    const [activeCategory, setActiveCategory] = useState('head');
    const [search, setSearch] = useState('');
    const [resultsView, setResultsView] = useState(null); // null | { sketchURL }
    const [detecting, setDetecting] = useState(false);
    const [showElementsPanel, setShowElementsPanel] = useState(false);
    const stageRef = useRef(null);

    // Dataset parts loaded from backend
    const [faceParts, setFaceParts]       = useState({});
    const [partsLoading, setPartsLoading] = useState(true);
    const [partsError, setPartsError]     = useState(null);

    const STAGE_WIDTH = 400;
    const STAGE_HEIGHT = 500;

    useEffect(() => {
        try {
            const map = loadDatasetParts();
            setFaceParts(map);
        } catch (err) {
            setPartsError(err.message);
        } finally {
            setPartsLoading(false);
        }
    }, []);

    const selectedElement = elements.find(el => el.instanceId === selectedId);

    const addElement = (component) => {
        const newEl = { instanceId: Date.now(), ...component, x: 0, y: 0, w: 400, h: 500, rotation: 0 };
        const targetLayer = DEFAULT_LAYER[component.category] ?? 10;
        setElements(prev => {
            const insertIndex = prev.findIndex(el => (DEFAULT_LAYER[el.category] ?? 10) > targetLayer);
            if (insertIndex === -1) return [...prev, newEl];
            const copy = [...prev];
            copy.splice(insertIndex, 0, newEl);
            return copy;
        });
    };

    const updateElement = (id, newAttrs) =>
        setElements(prev => prev.map(el => el.instanceId === id ? { ...el, ...newAttrs } : el));

    const bringForward = () => setElements(prev => {
        const idx = prev.findIndex(e => e.instanceId === selectedId);
        if (idx === -1 || idx === prev.length - 1) return prev;
        const copy = [...prev];
        [copy[idx], copy[idx + 1]] = [copy[idx + 1], copy[idx]];
        return copy;
    });

    const sendBackward = () => setElements(prev => {
        const idx = prev.findIndex(e => e.instanceId === selectedId);
        if (idx <= 0) return prev;
        const copy = [...prev];
        [copy[idx], copy[idx - 1]] = [copy[idx - 1], copy[idx]];
        return copy;
    });

    const removeSelected = () => {
        setElements(prev => prev.filter(el => el.instanceId !== selectedId));
        setSelectedId(null);
    };

    useEffect(() => {
        const handleKeyDown = (e) => {
            if (!selectedId) return;
            if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) e.preventDefault();
            setElements(prev => prev.map(el => {
                if (el.instanceId !== selectedId) return el;
                switch (e.key) {
                    case 'ArrowUp': return { ...el, y: el.y - 1 };
                    case 'ArrowDown': return { ...el, y: el.y + 1 };
                    case 'ArrowLeft': return { ...el, x: el.x - 1 };
                    case 'ArrowRight': return { ...el, x: el.x + 1 };
                    default: return el;
                }
            }));
            if (e.key === 'Delete' || e.key === 'Backspace') {
                setElements(prev => prev.filter(el => el.instanceId !== selectedId));
                setSelectedId(null);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [selectedId]);

    /* ── SHARED UTIL: composite Konva snapshot onto a white background ── */
    const getWhiteBackgroundDataURL = (pixelRatio = 2) => new Promise((resolve) => {
        const stage = stageRef.current;
        if (!stage) return resolve(null);
        const rawDataURL = stage.toDataURL({ pixelRatio });
        const img = new window.Image();
        img.onload = () => {
            const offscreen = document.createElement('canvas');
            offscreen.width  = STAGE_WIDTH  * pixelRatio;
            offscreen.height = STAGE_HEIGHT * pixelRatio;
            const ctx = offscreen.getContext('2d');
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, offscreen.width, offscreen.height);
            ctx.drawImage(img, 0, 0);
            resolve(offscreen.toDataURL('image/png'));
        };
        img.src = rawDataURL;
    });

    /* ── DETECT FACE ── */
    const detectFace = async () => {
        const stage = stageRef.current;
        if (!stage) return;

        setDetecting(true);

        // capture canvas snapshot with white background
        const dataURL = await getWhiteBackgroundDataURL(2);

        try {
            const imageBlob = dataURLToBlob(dataURL);
            const formData = new FormData();
            formData.append('sketch', imageBlob, 'sketch.png');

            const res = await fetch('http://localhost:3000/api/match', { method: 'POST', body: formData });
            const result = await res.json();

            // pass backend results + sketch to results page
            setResultsView({ sketchURL: dataURL, backendResults: result });
        } catch (err) {
            // backend unavailable → open results page with mock data (handled inside ResultsPage)
            console.warn('Backend unavailable, showing mock results:', err);
            setResultsView({ sketchURL: dataURL, backendResults: null });
        } finally {
            setDetecting(false);
        }
    };

    const exportPNG = async () => {
        const dataURL = await getWhiteBackgroundDataURL(2);
        if (!dataURL) return;
        const link = document.createElement('a');
        link.download = 'netra-x-sketch.png';
        link.href = dataURL;
        link.click();
    };

    /* ── show results page ── */
    if (resultsView) {
        return (
            <ResultsPage
                sketchURL={resultsView.sketchURL}
                backendResults={resultsView.backendResults}
                onBack={() => setResultsView(null)}
            />
        );
    }

    const parts = ((faceParts[activeCategory] || []).filter(p =>
        p.name.toLowerCase().includes(search.toLowerCase())
    ));
    return (
        <div className="h-screen flex flex-col overflow-hidden" style={{ background: '#080810', fontFamily: "'Inter', sans-serif" }}>

            {/* ── TOP NAV ── */}
            <header className="h-[52px] flex items-center justify-between px-5 shrink-0"
                style={{ background: '#0D0D18', borderBottom: '1px solid #1A1A2E' }}>

                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                        <img
                            src="/assets/logo.png"
                            alt="Logo"
                            className="h-8 w-auto object-contain rounded-md"
                            style={{ filter: 'drop-shadow(0 0 6px rgba(0,212,160,0.35))' }}
                        />
                        <span
                            className="text-sm font-semibold"
                            style={{
                                color: '#e6e6fa',
                                letterSpacing: '0.22em',
                                textShadow: '0 0 8px rgba(0,212,160,0.25)'
                            }}
                        >
                            NETRA-X
                        </span>
                    </div>
                    <span className="text-[10px] px-1.5 py-0.5 rounded font-medium tracking-wider"
                        style={{ background: '#1A1A2E', color: '#4A4A6A' }}>v2.1</span>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setShowElementsPanel(p => !p)}
                        className="text-xs px-3 py-1.5 rounded-full transition-all flex items-center gap-1.5"
                        style={{
                            color: showElementsPanel ? '#00D4A0' : '#4A4A6A',
                            border: showElementsPanel ? '1px solid rgba(0,212,160,0.35)' : '1px solid #1A1A2E',
                            background: showElementsPanel ? 'rgba(0,212,160,0.07)' : 'transparent',
                            cursor: 'pointer',
                        }}>
                        <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
                            <rect x="0.5" y="0.5" width="4" height="4" rx="1" stroke="currentColor" strokeWidth="1"/>
                            <rect x="6.5" y="0.5" width="4" height="4" rx="1" stroke="currentColor" strokeWidth="1"/>
                            <rect x="0.5" y="6.5" width="4" height="4" rx="1" stroke="currentColor" strokeWidth="1"/>
                            <rect x="6.5" y="6.5" width="4" height="4" rx="1" stroke="currentColor" strokeWidth="1"/>
                        </svg>
                        {elements.length} element{elements.length !== 1 ? 's' : ''}
                    </button>
                    <button onClick={exportPNG}
                        className="text-xs px-4 py-1.5 rounded-full transition-all"
                        style={{ border: '1px solid #1A1A2E', color: '#8888A8', background: 'transparent' }}
                        onMouseEnter={e => { e.target.style.borderColor = '#2A2A4E'; e.target.style.color = '#C0C0E0'; }}
                        onMouseLeave={e => { e.target.style.borderColor = '#1A1A2E'; e.target.style.color = '#8888A8'; }}>
                        Export PNG
                    </button>
                    <button
                        onClick={detectFace}
                        disabled={detecting}
                        className="text-xs px-5 py-1.5 rounded-full font-semibold transition-all flex items-center gap-2"
                        style={{
                            background: detecting ? '#007A5C' : '#00D4A0',
                            color: '#051410',
                            cursor: detecting ? 'not-allowed' : 'pointer',
                            opacity: detecting ? 0.8 : 1,
                        }}
                        onMouseEnter={e => { if (!detecting) e.currentTarget.style.background = '#00EFB5'; }}
                        onMouseLeave={e => { if (!detecting) e.currentTarget.style.background = '#00D4A0'; }}>
                        {detecting ? (
                            <>
                                <svg width="10" height="10" viewBox="0 0 10 10" style={{ animation: 'spin 1s linear infinite' }}>
                                    <circle cx="5" cy="5" r="4" stroke="#051410" strokeWidth="1.5" strokeDasharray="6 20" fill="none"/>
                                </svg>
                                Detecting...
                            </>
                        ) : 'Detect Face'}
                    </button>
                </div>
            </header>

            {/* ── MAIN ── */}
            <div className="flex flex-1 overflow-hidden">

                {/* ── ICON SIDEBAR ── */}
                <nav className="flex flex-col items-center pt-4 gap-1.5 shrink-0"
                    style={{ width: 56, background: '#0D0D18', borderRight: '1px solid #1A1A2E' }}>
                    {CATEGORIES.map(cat => {
                        const active = activeCategory === cat.name;
                        return (
                            <button key={cat.name}
                                onClick={() => setActiveCategory(cat.name)}
                                title={cat.label}
                                className="w-9 h-9 rounded-lg flex items-center justify-center relative transition-all group"
                                style={{
                                    background: active ? 'rgba(0,212,160,0.1)' : 'transparent',
                                    border: active ? '1px solid rgba(0,212,160,0.3)' : '1px solid transparent',
                                }}>
                                <img src={`/assets/components/icons8-${cat.name}-64.png`}
                                    alt={cat.label}
                                    className="w-5 h-5 transition-opacity"
                                    style={{ opacity: active ? 1 : 0.3, filter: active ? 'hue-rotate(0deg) saturate(200%)' : 'grayscale(100%)' }}
                                    onError={e => { e.target.style.display = 'none'; }}
                                />
                                {active && (
                                    <span className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-4 rounded-r"
                                        style={{ background: '#00D4A0' }}/>
                                )}
                            </button>
                        );
                    })}
                </nav>

                {/* ── COMPONENT PANEL ── */}
                <aside className="flex flex-col shrink-0 overflow-hidden"
                    style={{ width: 220, background: '#0F0F1A', borderRight: '1px solid #1A1A2E' }}>

                    <div className="p-3 shrink-0" style={{ borderBottom: '1px solid #1A1A2E' }}>
                        <div className="relative">
                            <input
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                placeholder="Search parts..."
                                className="w-full pl-8 pr-3 py-2 rounded-lg text-xs focus:outline-none transition-colors"
                                style={{
                                    background: '#080810',
                                    border: '1px solid #1A1A2E',
                                    color: '#B0B0D0',
                                }}
                                onFocus={e => e.target.style.borderColor = '#00D4A030'}
                                onBlur={e => e.target.style.borderColor = '#1A1A2E'}
                            />
                            <svg className="absolute left-2.5 top-1/2 -translate-y-1/2" width="13" height="13" viewBox="0 0 13 13" fill="none">
                                <circle cx="5.5" cy="5.5" r="4" stroke="#3A3A5A" strokeWidth="1.3"/>
                                <path d="M9 9l2.5 2.5" stroke="#3A3A5A" strokeWidth="1.3" strokeLinecap="round"/>
                            </svg>
                        </div>
                    </div>

                    <div className="px-3 pt-3 pb-1 shrink-0">
                        <p className="text-[9px] font-semibold tracking-[0.15em] uppercase"
                            style={{ color: '#00D4A0' }}>
                            {CATEGORIES.find(c => c.name === activeCategory)?.label}
                        </p>
                    </div>

                    <div className="flex-1 overflow-y-auto px-3 pb-3"
                        style={{ scrollbarWidth: 'thin', scrollbarColor: '#1A1A2E transparent' }}>

                        {/* Loading state */}
                        {partsLoading && (
                            <div className="pt-8 flex flex-col items-center gap-3">
                                <svg width="18" height="18" viewBox="0 0 18 18" style={{ animation: 'spin 1s linear infinite' }}>
                                    <circle cx="9" cy="9" r="7" stroke="#1A1A2E" strokeWidth="2" fill="none"/>
                                    <path d="M9 2a7 7 0 0 1 7 7" stroke="#00D4A0" strokeWidth="2" strokeLinecap="round" fill="none"/>
                                </svg>
                                <p className="text-[10px]" style={{ color: '#2A2A4A' }}>Loading dataset…</p>
                            </div>
                        )}

                        {/* Error state */}
                        {!partsLoading && partsError && (
                            <div className="pt-6 px-1 text-center flex flex-col gap-2">
                                <p className="text-[10px]" style={{ color: '#804040' }}>⚠ Could not load components</p>
                                <p className="text-[9px] break-all" style={{ color: '#3A2A2A' }}>{partsError}</p>
                                <button
                                    onClick={() => {
                                        setPartsLoading(true);
                                        setPartsError(null);
                                        try {
                                            const m = loadDatasetParts();
                                            setFaceParts(m);
                                        } catch (e) {
                                            setPartsError(e.message);
                                        } finally {
                                            setPartsLoading(false);
                                        }
                                    }}
                                    className="mt-1 text-[10px] px-3 py-1 rounded-full self-center"
                                    style={{ border: '1px solid #3A2020', color: '#A05050', background: 'transparent' }}>
                                    ↻ Retry
                                </button>
                            </div>
                        )}

                        {/* Empty state */}
                        {!partsLoading && !partsError && parts.length === 0 && (
                            <div className="pt-8 text-center">
                                <p className="text-xs" style={{ color: '#2A2A4A' }}>
                                    {search ? 'No parts match your search' : 'No parts in this category'}
                                </p>
                            </div>
                        )}

                        {/* Parts grid — thumbnail in panel, full component on canvas */}
                        {!partsLoading && !partsError && parts.length > 0 && (
                            <div className="grid grid-cols-2 gap-2 mt-2">
                                {parts.map(comp => (
                                    <button key={comp.id} onClick={() => addElement(comp)}
                                        title={comp.name}
                                        className="rounded-lg overflow-hidden transition-all flex flex-col items-center p-2 gap-1.5 group"
                                        style={{ border: '1px solid #1A1A2E', background: '#0D0D18' }}
                                        onMouseEnter={e => { e.currentTarget.style.borderColor = '#00D4A030'; e.currentTarget.style.background = '#121220'; }}
                                        onMouseLeave={e => { e.currentTarget.style.borderColor = '#1A1A2E'; e.currentTarget.style.background = '#0D0D18'; }}>

                                        {/* Show thumbnail; fallback to a placeholder on error */}
                                        <div className="w-14 h-14 rounded overflow-hidden flex items-center justify-center"
                                            style={{ background: '#0A0A14' }}>
                                            <img
                                                src={comp.thumbnailSrc}
                                                alt={comp.name}
                                                className="w-full h-full object-cover"
                                                style={{ filter: 'grayscale(15%)' }}
                                                onError={e => {
                                                    e.target.style.display = 'none';
                                                    e.target.nextSibling.style.display = 'flex';
                                                }}
                                            />
                                            {/* Fallback icon shown only when image fails */}
                                            <div style={{ display: 'none', width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' }}>
                                                <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
                                                    <rect x="1" y="1" width="20" height="20" rx="3" stroke="#2A2A4A" strokeWidth="1"/>
                                                    <path d="M6 16l4-5 3 3.5 2-2.5 3 4H6z" fill="#2A2A4A"/>
                                                    <circle cx="14" cy="8" r="2" fill="#2A2A4A"/>
                                                </svg>
                                            </div>
                                        </div>

                                        <span className="text-[9px] font-medium tracking-wide text-center leading-tight w-full truncate"
                                            style={{ color: '#4A4A6A' }}>
                                            {comp.name}
                                        </span>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </aside>

                {/* ── CANVAS ── */}
                <main className="flex-1 flex items-center justify-center relative overflow-hidden"
                    style={{ background: '#080810' }}>
                    <div className="absolute inset-0 pointer-events-none"
                        style={{
                            backgroundImage: 'radial-gradient(circle, #1C1C2E 1px, transparent 1px)',
                            backgroundSize: '24px 24px', // 500H 400w
                        }}/>

                    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-[10px] tracking-widest"
                        style={{ color: '#1E1E34' }}>400 × 500 px</div>

                    <div className="relative shadow-2xl"
                        style={{ boxShadow: '0 0 0 1px #1A1A2E, 0 32px 64px rgba(0,0,0,0.8)' }}>
                        <Stage ref={stageRef} width={STAGE_WIDTH} height={STAGE_HEIGHT}
                            style={{ background: '#F5F4F0', display: 'block' }}
                            onMouseDown={(e) => { if (e.target === e.target.getStage()) setSelectedId(null); }}>
                            <Layer>
                                {elements.map(el => (
                                    <TransformableImage key={el.instanceId} {...el}
                                        isSelected={el.instanceId === selectedId}
                                        onSelect={() => setSelectedId(el.instanceId)}
                                        onChange={attrs => updateElement(el.instanceId, attrs)}
                                    />
                                ))}
                            </Layer>
                        </Stage>
                    </div>

                    {/* ── ELEMENTS PANEL OVERLAY ── */}
                    {showElementsPanel && (
                        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-50 flex flex-col"
                            style={{
                                width: 320,
                                maxHeight: 'calc(100% - 24px)',
                                background: '#0D0D18',
                                border: '1px solid #1A1A2E',
                                borderRadius: 12,
                                boxShadow: '0 24px 60px rgba(0,0,0,0.9), 0 0 0 1px rgba(0,212,160,0.06)',
                                overflow: 'hidden',
                            }}>
                            {/* Panel header */}
                            <div className="flex items-center justify-between px-4 py-3 shrink-0"
                                style={{ borderBottom: '1px solid #1A1A2E' }}>
                                <div className="flex items-center gap-2">
                                    <p className="text-[9px] font-semibold tracking-[0.15em] uppercase" style={{ color: '#00D4A0' }}>
                                        Canvas Elements
                                    </p>
                                    <span className="text-[9px] px-1.5 py-0.5 rounded-full"
                                        style={{ background: 'rgba(0,212,160,0.1)', color: '#00D4A0', border: '1px solid rgba(0,212,160,0.2)' }}>
                                        {elements.length}
                                    </span>
                                </div>
                                <button onClick={() => setShowElementsPanel(false)}
                                    className="w-6 h-6 flex items-center justify-center rounded-md transition-all"
                                    style={{ color: '#3A3A5A', border: '1px solid #1A1A2E', background: 'transparent' }}
                                    onMouseEnter={e => { e.currentTarget.style.color = '#9090C0'; e.currentTarget.style.borderColor = '#2A2A4E'; }}
                                    onMouseLeave={e => { e.currentTarget.style.color = '#3A3A5A'; e.currentTarget.style.borderColor = '#1A1A2E'; }}>
                                    <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                                        <path d="M2 2l6 6M8 2l-6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                                    </svg>
                                </button>
                            </div>

                            {elements.length === 0 ? (
                                <div className="flex flex-col items-center justify-center gap-2 py-10 px-4">
                                    <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
                                        <rect x="1" y="1" width="26" height="26" rx="5" stroke="#1E1E32" strokeWidth="1.2"/>
                                        <path d="M9 14h10M14 9v10" stroke="#1E1E32" strokeWidth="1.2" strokeLinecap="round"/>
                                    </svg>
                                    <p className="text-[11px] text-center" style={{ color: '#2A2A4A' }}>
                                        No elements on canvas yet.<br/>Add parts from the left panel.
                                    </p>
                                </div>
                            ) : (
                                <div className="overflow-y-auto flex-1"
                                    style={{ scrollbarWidth: 'thin', scrollbarColor: '#1A1A2E transparent' }}>
                                    {/* List of elements (reverse so top-most is first) */}
                                    {[...elements].reverse().map((el, idx) => {
                                        const isActive = el.instanceId === selectedId;
                                        const layerPos = elements.length - 1 - idx; // index in actual array
                                        return (
                                            <div key={el.instanceId}>
                                                {/* Element row */}
                                                <button
                                                    onClick={() => {
                                                        setSelectedId(el.instanceId);
                                                    }}
                                                    className="w-full flex items-center gap-3 px-4 py-2.5 transition-all text-left"
                                                    style={{
                                                        background: isActive ? 'rgba(0,212,160,0.06)' : 'transparent',
                                                        borderLeft: isActive ? '2px solid #00D4A0' : '2px solid transparent',
                                                    }}
                                                    onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'rgba(255,255,255,0.02)'; }}
                                                    onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}>
                                                    {/* Thumbnail */}
                                                    <div className="w-8 h-8 rounded-md overflow-hidden shrink-0 flex items-center justify-center"
                                                        style={{ background: '#0A0A14', border: '1px solid #1A1A2E' }}>
                                                        <img src={el.thumbnailSrc} alt={el.name}
                                                            className="w-full h-full object-cover"
                                                            onError={e => { e.target.style.display = 'none'; }}/>
                                                    </div>
                                                    {/* Info */}
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-[11px] font-medium truncate" style={{ color: isActive ? '#00D4A0' : '#9090B0' }}>
                                                            {el.name}
                                                        </p>
                                                        <p className="text-[9px] mt-0.5" style={{ color: '#3A3A5A' }}>
                                                            {Math.round(el.x)}, {Math.round(el.y)} · {Math.round(el.width)}×{Math.round(el.height)}
                                                        </p>
                                                    </div>
                                                    {/* Layer badge */}
                                                    <span className="text-[9px] shrink-0 px-1.5 py-0.5 rounded"
                                                        style={{ background: '#0A0A14', color: '#3A3A5A', border: '1px solid #1A1A2E', fontFamily: 'monospace' }}>
                                                        L{layerPos}
                                                    </span>
                                                </button>

                                                {/* Inline edit fields when selected */}
                                                {isActive && (
                                                    <div className="px-4 pb-3 pt-1 flex flex-col gap-2"
                                                        style={{ background: 'rgba(0,212,160,0.03)', borderBottom: '1px solid rgba(0,212,160,0.08)' }}>
                                                        <div className="grid grid-cols-2 gap-2">
                                                            <div>
                                                                <p className="text-[9px] font-medium tracking-widest uppercase mb-1" style={{ color: '#4A4A6A' }}>X</p>
                                                                <input type="number" value={Math.round(el.x)}
                                                                    onChange={e => updateElement(el.instanceId, { x: Number(e.target.value) })}
                                                                    className="w-full px-2 py-1 rounded-md text-xs focus:outline-none"
                                                                    style={{ background: '#0A0A14', border: '1px solid #1E1E32', color: '#D8D8F0', fontFamily: 'monospace' }}
                                                                    onFocus={e => e.target.style.borderColor = '#00D4A0'}
                                                                    onBlur={e => e.target.style.borderColor = '#1E1E32'}/>
                                                            </div>
                                                            <div>
                                                                <p className="text-[9px] font-medium tracking-widest uppercase mb-1" style={{ color: '#4A4A6A' }}>Y</p>
                                                                <input type="number" value={Math.round(el.y)}
                                                                    onChange={e => updateElement(el.instanceId, { y: Number(e.target.value) })}
                                                                    className="w-full px-2 py-1 rounded-md text-xs focus:outline-none"
                                                                    style={{ background: '#0A0A14', border: '1px solid #1E1E32', color: '#D8D8F0', fontFamily: 'monospace' }}
                                                                    onFocus={e => e.target.style.borderColor = '#00D4A0'}
                                                                    onBlur={e => e.target.style.borderColor = '#1E1E32'}/>
                                                            </div>
                                                            <div>
                                                                <p className="text-[9px] font-medium tracking-widests uppercase mb-1" style={{ color: '#4A4A6A' }}>W</p>
                                                                <input type="number" value={Math.round(el.width)}
                                                                    onChange={e => updateElement(el.instanceId, { width: Number(e.target.value) })}
                                                                    className="w-full px-2 py-1 rounded-md text-xs focus:outline-none"
                                                                    style={{ background: '#0A0A14', border: '1px solid #1E1E32', color: '#D8D8F0', fontFamily: 'monospace' }}
                                                                    onFocus={e => e.target.style.borderColor = '#00D4A0'}
                                                                    onBlur={e => e.target.style.borderColor = '#1E1E32'}/>
                                                            </div>
                                                            <div>
                                                                <p className="text-[9px] font-medium tracking-widest uppercase mb-1" style={{ color: '#4A4A6A' }}>H</p>
                                                                <input type="number" value={Math.round(el.height)}
                                                                    onChange={e => updateElement(el.instanceId, { height: Number(e.target.value) })}
                                                                    className="w-full px-2 py-1 rounded-md text-xs focus:outline-none"
                                                                    style={{ background: '#0A0A14', border: '1px solid #1E1E32', color: '#D8D8F0', fontFamily: 'monospace' }}
                                                                    onFocus={e => e.target.style.borderColor = '#00D4A0'}
                                                                    onBlur={e => e.target.style.borderColor = '#1E1E32'}/>
                                                            </div>
                                                        </div>
                                                        <div>
                                                            <p className="text-[9px] font-medium tracking-widest uppercase mb-1" style={{ color: '#4A4A6A' }}>Rotation</p>
                                                            <input type="number" value={Math.round(el.rotation)}
                                                                onChange={e => updateElement(el.instanceId, { rotation: Number(e.target.value) })}
                                                                className="w-full px-2 py-1 rounded-md text-xs focus:outline-none"
                                                                style={{ background: '#0A0A14', border: '1px solid #1E1E32', color: '#D8D8F0', fontFamily: 'monospace' }}
                                                                onFocus={e => e.target.style.borderColor = '#00D4A0'}
                                                                onBlur={e => e.target.style.borderColor = '#1E1E32'}/>
                                                        </div>
                                                        {/* Layer & Delete actions */}
                                                        <div className="flex gap-1.5 pt-0.5">
                                                            <button onClick={bringForward}
                                                                className="flex-1 py-1 rounded text-[9px] transition-all"
                                                                style={{ border: '1px solid #1A1A2E', color: '#6060A0', background: 'transparent' }}
                                                                onMouseEnter={e => { e.target.style.borderColor = '#2A2A4E'; e.target.style.color = '#9090C0'; }}
                                                                onMouseLeave={e => { e.target.style.borderColor = '#1A1A2E'; e.target.style.color = '#6060A0'; }}>
                                                                ↑ Fwd
                                                            </button>
                                                            <button onClick={sendBackward}
                                                                className="flex-1 py-1 rounded text-[9px] transition-all"
                                                                style={{ border: '1px solid #1A1A2E', color: '#6060A0', background: 'transparent' }}
                                                                onMouseEnter={e => { e.target.style.borderColor = '#2A2A4E'; e.target.style.color = '#9090C0'; }}
                                                                onMouseLeave={e => { e.target.style.borderColor = '#1A1A2E'; e.target.style.color = '#6060A0'; }}>
                                                                ↓ Back
                                                            </button>
                                                            <button onClick={() => { removeSelected(); }}
                                                                className="flex-1 py-1 rounded text-[9px] transition-all"
                                                                style={{ border: '1px solid #2A1A1A', color: '#804040', background: 'transparent' }}
                                                                onMouseEnter={e => { e.target.style.background = '#1A0A0A'; e.target.style.color = '#C06060'; }}
                                                                onMouseLeave={e => { e.target.style.background = 'transparent'; e.target.style.color = '#804040'; }}>
                                                                ✕ Remove
                                                            </button>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    )}
                </main>

                {/* ── RIGHT PANEL ── */}
                <aside className="flex flex-col shrink-0 overflow-hidden"
                    style={{ width: 200, background: '#0D0D18', borderLeft: '1px solid #1A1A2E' }}>

                    <div className="px-4 pt-4 pb-3 shrink-0" style={{ borderBottom: '1px solid #1A1A2E' }}>
                        <p className="text-[9px] font-semibold tracking-[0.15em] uppercase" style={{ color: '#00D4A0' }}>
                            Properties
                        </p>
                    </div>

                    {!selectedElement ? (
                        <div className="flex-1 flex flex-col items-center justify-center gap-2 px-4">
                            <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                                style={{ background: '#0F0F1A', border: '1px solid #1A1A2E' }}>
                                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                                    <rect x="2" y="2" width="12" height="12" rx="2" stroke="#2A2A4A" strokeWidth="1.2"/>
                                    <path d="M5 8h6M8 5v6" stroke="#2A2A4A" strokeWidth="1.2" strokeLinecap="round"/>
                                </svg>
                            </div>
                            <p className="text-[10px] text-center leading-relaxed" style={{ color: '#2A2A4A' }}>
                                Select an element to edit
                            </p>
                        </div>
                    ) : (
                        <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-3"
                            style={{ scrollbarWidth: 'thin', scrollbarColor: '#1A1A2E transparent' }}>

                            <div className="text-[10px] px-2 py-1.5 rounded-md truncate"
                                style={{ background: 'rgba(0,212,160,0.07)', border: '1px solid rgba(0,212,160,0.15)', color: '#00D4A0' }}>
                                {selectedElement.name}
                            </div>

                            <div className="flex flex-col gap-2.5">
                                <Field label="X" value={selectedElement.x}
                                    onChange={v => updateElement(selectedId, { x: v })} />
                                <Field label="Y" value={selectedElement.y}
                                    onChange={v => updateElement(selectedId, { y: v })} />
                                <div className="flex gap-2">
                                    <Field label="W" value={selectedElement.width} half
                                        onChange={v => updateElement(selectedId, { width: v })} />
                                    <Field label="H" value={selectedElement.height} half
                                        onChange={v => updateElement(selectedId, { height: v })} />
                                </div>
                                <Field label="Rotation" value={selectedElement.rotation}
                                    onChange={v => updateElement(selectedId, { rotation: v })} />
                            </div>

                            <div style={{ borderTop: '1px solid #1A1A2E' }} className="pt-3">
                                <p className="text-[9px] font-semibold tracking-[0.15em] uppercase mb-2" style={{ color: '#2A2A4A' }}>
                                    Layer
                                </p>
                                <div className="flex gap-1.5">
                                    <button onClick={bringForward}
                                        className="flex-1 py-1.5 rounded-md text-[10px] transition-all"
                                        style={{ border: '1px solid #1A1A2E', color: '#6060A0', background: 'transparent' }}
                                        onMouseEnter={e => { e.target.style.borderColor = '#2A2A4E'; e.target.style.color = '#9090C0'; }}
                                        onMouseLeave={e => { e.target.style.borderColor = '#1A1A2E'; e.target.style.color = '#6060A0'; }}>
                                        ↑ Fwd
                                    </button>
                                    <button onClick={sendBackward}
                                        className="flex-1 py-1.5 rounded-md text-[10px] transition-all"
                                        style={{ border: '1px solid #1A1A2E', color: '#6060A0', background: 'transparent' }}
                                        onMouseEnter={e => { e.target.style.borderColor = '#2A2A4E'; e.target.style.color = '#9090C0'; }}
                                        onMouseLeave={e => { e.target.style.borderColor = '#1A1A2E'; e.target.style.color = '#6060A0'; }}>
                                        ↓ Back
                                    </button>
                                </div>
                            </div>

                            <div style={{ borderTop: '1px solid #1A1A2E' }} className="pt-3">
                                <button onClick={removeSelected}
                                    className="w-full py-1.5 rounded-md text-[10px] transition-all"
                                    style={{ border: '1px solid #2A1A1A', color: '#804040', background: 'transparent' }}
                                    onMouseEnter={e => { e.target.style.background = '#1A0A0A'; e.target.style.color = '#C06060'; }}
                                    onMouseLeave={e => { e.target.style.background = 'transparent'; e.target.style.color = '#804040'; }}>
                                    Remove element
                                </button>
                            </div>
                        </div>
                    )}

                    <div className="p-4 shrink-0" style={{ borderTop: '1px solid #1A1A2E' }}>
                        <button onClick={exportPNG}
                            className="w-full py-2 rounded-lg text-xs font-semibold transition-all"
                            style={{ background: '#00D4A0', color: '#041210' }}
                            onMouseEnter={e => e.target.style.background = '#00EFB5'}
                            onMouseLeave={e => e.target.style.background = '#00D4A0'}>
                            Export PNG
                        </button>
                    </div>
                </aside>
            </div>

            <style>{`
                @keyframes spin { to { transform: rotate(360deg); } }
            `}</style>
        </div>
    );
};

/* ---------- TransformableImage ---------- */
const TransformableImage = ({ src, x, y, width, height, rotation, isSelected, onSelect, onChange }) => {
    const [image] = useImage(src);
    const imageRef = useRef();
    const trRef = useRef();

    useEffect(() => {
        if (isSelected) {
            trRef.current.nodes([imageRef.current]);
            trRef.current.getLayer().batchDraw();
        }
    }, [isSelected]);

    if (!image) return null;

    return (
        <>
            <KonvaImage ref={imageRef} image={image}
                x={x} y={y} width={width} height={height} rotation={rotation}
                draggable onClick={onSelect} onTap={onSelect}
                onDragEnd={e => onChange({ x: e.target.x(), y: e.target.y() })}
                onTransformEnd={() => {
                    const node = imageRef.current;
                    const scaleX = node.scaleX();
                    const scaleY = node.scaleY();
                    node.scaleX(1);
                    node.scaleY(1);
                    onChange({
                        x: node.x(), y: node.y(), rotation: node.rotation(),
                        width: Math.max(20, node.width() * scaleX),
                        height: Math.max(20, node.height() * scaleY),
                    });
                }}
            />
            {isSelected && (
                <Transformer ref={trRef}
                    borderStroke="#00D4A0"
                    borderStrokeWidth={1.5}
                    anchorFill="#00D4A0"
                    anchorStroke="#051410"
                    anchorSize={8}
                    anchorCornerRadius={2}
                />
            )}
        </>
    );
};

export default Builder;