import { useState, useRef, useEffect } from 'react';
import { Stage, Layer, Image as KonvaImage, Transformer } from 'react-konva';
import useImage from 'use-image';
import ResultsPage from './ResultsPage';

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
    neck: 0, head: 1, hair: 3, ears: 0,
    eyes: 4, nose: 4, eyebrows: 2, lips: 4, marks: 5, accessories: 6,
};

const FACE_PARTS = {
    head: [
        { id: 'head_1', name: 'Head A', category: 'head', src: '/assets/components/head1.jpg', width: 220, height: 260 },
        { id: 'head_2', name: 'Head B', category: 'head', src: '/assets/components/head2.jpg', width: 220, height: 260 },
    ],
    eyes: [
        { id: 'eyes_1', name: 'Eyes A', category: 'eyes', src: '/assets/components/eyes1.jpg', width: 150, height: 100 },
    ],
    nose: [
        { id: 'nose_1', name: 'Nose A', category: 'nose', src: '/assets/components/nose.jpg', width: 80, height: 100 },
    ],
    lips: [
         { id: 'lips1', name: 'Lips A', category: 'lips', src: '/assets/components/lips.jpg', width: 170, height: 100 },
    ],
    hair: [], ears: [], eyebrows: [], marks: [], neck: [], accessories: [],
};

const CATEGORIES = [
    { name: 'head',        icon: '⬤',  label: 'Head' },
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
    const stageRef = useRef(null);

    const selectedElement = elements.find(el => el.instanceId === selectedId);

    const addElement = (component) => {
        const newEl = { instanceId: Date.now(), ...component, x: 240, y: 170, rotation: 0 };
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

    /* ── DETECT FACE ── */
    const detectFace = async () => {
        const stage = stageRef.current;
        if (!stage) return;

        setDetecting(true);

        // capture canvas snapshot
        const dataURL = stage.toDataURL({ pixelRatio: 2 });

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

    const exportPNG = () => {
        const stage = stageRef.current;
        if (!stage) return;
        const dataURL = stage.toDataURL({ pixelRatio: 2 });
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

    const parts = (FACE_PARTS[activeCategory] || []).filter(p =>
        p.name.toLowerCase().includes(search.toLowerCase())
    );

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
                    <div className="text-xs px-3 py-1.5 rounded-full"
                        style={{ color: '#4A4A6A', border: '1px solid #1A1A2E' }}>
                        {elements.length} element{elements.length !== 1 ? 's' : ''}
                    </div>
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
                        {parts.length === 0 ? (
                            <div className="pt-8 text-center">
                                <p className="text-xs" style={{ color: '#2A2A4A' }}>No parts yet</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-2 gap-2 mt-2">
                                {parts.map(comp => (
                                    <button key={comp.id} onClick={() => addElement(comp)}
                                        className="rounded-lg overflow-hidden transition-all flex flex-col items-center p-2 gap-1.5 group"
                                        style={{ border: '1px solid #1A1A2E', background: '#0D0D18' }}
                                        onMouseEnter={e => { e.currentTarget.style.borderColor = '#00D4A030'; e.currentTarget.style.background = '#121220'; }}
                                        onMouseLeave={e => { e.currentTarget.style.borderColor = '#1A1A2E'; e.currentTarget.style.background = '#0D0D18'; }}>
                                        <img src={comp.src} alt={comp.name}
                                            className="w-14 h-14 object-cover rounded"
                                            style={{ filter: 'grayscale(20%)' }}
                                        />
                                        <span className="text-[9px] font-medium tracking-wide" style={{ color: '#4A4A6A' }}>
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
                        <Stage ref={stageRef} width={400} height={500}
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