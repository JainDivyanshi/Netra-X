import { useState, useRef, useEffect } from 'react';
import {
    Stage,
    Layer,
    Image as KonvaImage,
    Transformer,
} from 'react-konva';
import useImage from 'use-image';

/* ---------- utils ---------- */

const dataURLToBlob = (dataURL) => {
    const byteString = atob(dataURL.split(',')[1]);
    const mimeString = dataURL.split(',')[0].split(':')[1].split(';')[0];

    const ab = new ArrayBuffer(byteString.length);
    const ia = new Uint8Array(ab);

    for (let i = 0; i < byteString.length; i++) {
        ia[i] = byteString.charCodeAt(i);
    }

    return new Blob([ab], { type: mimeString });
};

/* ---------- temp components ---------- */

/* ---------- TEMP FACE DATA (mock backend) ---------- */

const DEFAULT_LAYER = {
   neck: 0,
    head: 1,
    hair: 3,
    ears: 0,
    eyes: 4,
    nose: 4,
    eyebrows: 2,
    lips: 4,
    marks: 5,
    accessories: 6
};

const FACE_PARTS = {
    head: [
        {
            id: 'head_1',
            name: 'Head A',
            category: 'head',
            src: '/assets/components/head1.jpg',
            width: 220,
            height: 260,
        },
        {
            id: 'head_2',
            name: 'Head B',
            category: 'head',
            src: '/assets/components/head2.jpg',
            width: 220,
            height: 260,
        },
    ],
    eyes: [
        {
            id: 'eyes_1',
            name: 'Eyes A',
            category: 'eyes',
            src: '/assets/components/eyes1.jpg',
            width: 150,
            height: 100,
        },
    ],

    nose: [
        {
            id: 'nose_1',
            name: 'Nose A',
            category: 'nose',
            src: '/assets/components/nose.jpg',
            width: 80,
            height: 100,
        },
    ],
};

const CATEGORIES = [
    {
        name: 'head',
        src: '/assets/components/icons8-head-64.png'
    },
    {
        name: 'neck',
        src: '/assets/components/icons8-neck-64.png'
    },
    {
        name: 'hair',
        src: '/assets/components/icons8-hair-64.png'
    },
    {
        name: 'eyes',
        src: '/assets/components/icons8-eye-64.png'
    },
    {
        name: 'nose',
        src: '/assets/components/icons8-nose-64.png'
    },
    {
        name: 'lips',
        src: '/assets/components/icons8-lips-64.png'
    },
    {
        name: 'ears',
        src: '/assets/components/icons8-ear-64.png'
    },
    {
        name: 'eyebrows',
        src: '/assets/components/icons8-eyebrow-64.png'
    },
    {
        name: 'marks',
        src: '/assets/components/icons8-mole-64.png'
    },
    {
        name: 'accessories',
        src: '/assets/components/icons8-glasses-64.png'
    }
];

/* ---------- Builder ---------- */

const Builder = () => {
    const [elements, setElements] = useState([]);
    const [selectedId, setSelectedId] = useState(null);
    const stageRef = useRef(null);
    const [activeCategory, setActiveCategory] = useState('head');

    const selectedElement = elements.find(
        (el) => el.instanceId === selectedId
    );

    const addElement = (component) => {
        const newEl = {
            instanceId: Date.now(),
            ...component,
            x: 300,
            y: 200,
            rotation: 0,
        };

        const targetLayer = DEFAULT_LAYER[component.category] ?? 10;

        setElements((prev) => {
            const insertIndex = prev.findIndex(
                (el) =>
                    (DEFAULT_LAYER[el.category] ?? 10) > targetLayer
            );

            if (insertIndex === -1) {
                return [...prev, newEl];
            }

            const copy = [...prev];
            copy.splice(insertIndex, 0, newEl);
            return copy;
        });
    };

    const updateElement = (id, newAttrs) => {
        setElements((prev) =>
            prev.map((el) =>
                el.instanceId === id ? { ...el, ...newAttrs } : el
            )
        );
    };

    const bringForward = () => {
        setElements((prev) => {
            const idx = prev.findIndex((e) => e.instanceId === selectedId);
            if (idx === -1 || idx === prev.length - 1) return prev;
            const copy = [...prev];
            [copy[idx], copy[idx + 1]] = [copy[idx + 1], copy[idx]];
            return copy;
        });
    };

    const sendBackward = () => {
        setElements((prev) => {
            const idx = prev.findIndex((e) => e.instanceId === selectedId);
            if (idx <= 0) return prev;
            const copy = [...prev];
            [copy[idx], copy[idx - 1]] = [copy[idx - 1], copy[idx]];
            return copy;
        });
    };

    useEffect(() => {
        const handleKeyDown = (e) => {
            if (!selectedId) return;

            const MOVE_STEP = 1;

            if (
                ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)
            ) {
                e.preventDefault();
            }

            setElements((prev) =>
                prev.map((el) => {
                    if (el.instanceId !== selectedId) return el;

                    switch (e.key) {
                        case 'ArrowUp':
                            return { ...el, y: el.y - MOVE_STEP };
                        case 'ArrowDown':
                            return { ...el, y: el.y + MOVE_STEP };
                        case 'ArrowLeft':
                            return { ...el, x: el.x - MOVE_STEP };
                        case 'ArrowRight':
                            return { ...el, x: el.x + MOVE_STEP };
                        default:
                            return el;
                    }
                })
            );

            if (e.key === 'Delete' || e.key === 'Backspace') {
                setElements((prev) =>
                    prev.filter((el) => el.instanceId !== selectedId)
                );
                setSelectedId(null);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [selectedId]);

    const detectFace = async () => {
        const stage = stageRef.current;
        if (!stage) return;

        const dataURL = stage.toDataURL({ pixelRatio: 2 });
        const imageBlob = dataURLToBlob(dataURL);

        const formData = new FormData();
        formData.append('sketch', imageBlob, 'sketch.png');

        try {
            const response = await fetch('http://localhost:3000/api/match', {
                method: 'POST',
                body: formData,
            });

            const result = await response.json();
            console.log('Match result:', result);
        } catch (error) {
            console.error('Error during detection:', error);
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

    return (
        <div className="h-screen flex flex-col">

            {/* TOP NAV */}
            <div className="h-16 bg-gradient-to-r from-black via-blue-900 to-teal-700 text-white flex items-center justify-between px-6">
                <div className="text-xl font-bold">NETRA-X</div>
                <button
                    onClick={detectFace}
                    className="bg-black/60 px-5 py-2 rounded-full hover:bg-black"
                >
                    Detect
                </button>
            </div>

            {/* MAIN LAYOUT */}
            <div className="flex flex-1">

                {/* ICON BAR */}
                <div className="w-16 bg-black text-white flex flex-col items-center py-4 gap-6">
                    {CATEGORIES.map((cat) => (
                        <button
                            key={cat.name}
                            onClick={() => setActiveCategory(cat.name)}
                            className={`w-8 h-8 rounded ${activeCategory === cat.name
                                ? 'bg-blue-500'
                                : 'bg-gray-700'
                                }`}
                        >
                            <img
                                src={cat.src}
                                alt={cat.name}
                                className="w-6 h-6 mx-auto"
                            />
                        </button>
                    ))}
                </div>

                {/* COMPONENT PANEL */}
                <div className="w-72 bg-gray-900 text-white p-4 overflow-y-auto">
                    <input
                        placeholder="Describe element here"
                        className="w-full mb-4 px-3 py-2 rounded bg-gray-700 text-white"
                    />
                    <h2 className="mb-2 capitalize font-bold">
                        {activeCategory}
                    </h2>

                    <div className="grid grid-cols-2 gap-4">
                        {FACE_PARTS[activeCategory].map((comp) => (
                            <button
                                key={comp.id}
                                onClick={() => addElement(comp)}
                                className="bg-white text-black rounded p-2"
                            >
                                <img
                                    src={comp.src}
                                    alt={comp.name}
                                    className="w-16 h-16 mx-auto"
                                />
                            </button>
                        ))}
                    </div>
                </div>


                {/* CANVAS CENTER */}
                <div className="flex-1 bg-gray-300 flex items-center justify-center">
                    <div className="bg-white border-4 border-gray-300 shadow">
                        <Stage
                            ref={stageRef}
                            width={700}
                            height={500}
                            onMouseDown={(e) => {
                                if (e.target === e.target.getStage()) {
                                    setSelectedId(null);
                                }
                            }}
                        >
                            <Layer>
                                {elements.map((el) => (
                                    <TransformableImage
                                        key={el.instanceId}
                                        {...el}
                                        isSelected={el.instanceId === selectedId}
                                        onSelect={() => setSelectedId(el.instanceId)}
                                        onChange={(attrs) =>
                                            updateElement(el.instanceId, attrs)
                                        }
                                    />
                                ))}
                            </Layer>
                        </Stage>
                    </div>
                </div>

                {/* RIGHT PANEL */}
                <div className="w-64 bg-gradient-to-b from-gray-900 to-black text-white p-4 border-l border-gray-700">

                    <h2 className="font-bold text-lg mb-4 text-teal-400 tracking-wide">
                        Properties
                    </h2>

                    {!selectedElement && (
                        <p className="text-sm text-gray-400">
                            Select an element to edit properties
                        </p>
                    )}

                    {selectedElement && (
                        <div className="space-y-3 text-sm">

                            {['x', 'y', 'width', 'height', 'rotation'].map((field) => (
                                <div key={field}>
                                    <label className="block mb-1 capitalize text-gray-300">
                                        {field}
                                    </label>

                                    <input
                                        type="number"
                                        value={Math.round(selectedElement[field])}
                                        onChange={(e) =>
                                            updateElement(selectedId, {
                                                [field]: Number(e.target.value),
                                            })
                                        }
                                        className="w-full bg-gray-800 border border-gray-600 text-white px-2 py-1 rounded focus:outline-none focus:border-teal-400"
                                    />
                                </div>
                            ))}

                            <div className="flex gap-2 pt-2">
                                <button
                                    onClick={bringForward}
                                    className="flex-1 bg-teal-600 hover:bg-teal-500 text-white py-1 rounded transition"
                                >
                                    Forward
                                </button>

                                <button
                                    onClick={sendBackward}
                                    className="flex-1 bg-teal-600 hover:bg-teal-500 text-white py-1 rounded transition"
                                >
                                    Backward
                                </button>
                            </div>
                        </div>
                    )}

                    <div className="pt-4 border-t border-gray-700 mt-4 space-y-2">

                        <button
                            onClick={exportPNG}
                            className="w-full bg-black-700 border border-white hover:bg-black-500 text-white py-2 rounded-full transition"
                        >
                            Export PNG
                        </button>

                    </div>
                </div>

            </div>
        </div>
    );
};

/* ---------- TransformableImage ---------- */

const TransformableImage = ({
    src,
    x,
    y,
    width,
    height,
    rotation,
    isSelected,
    onSelect,
    onChange,
}) => {
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
            <KonvaImage
                ref={imageRef}
                image={image}
                x={x}
                y={y}
                width={width}
                height={height}
                rotation={rotation}
                draggable
                onClick={onSelect}
                onTap={onSelect}
                onDragEnd={(e) =>
                    onChange({ x: e.target.x(), y: e.target.y() })
                }
                onTransformEnd={() => {
                    const node = imageRef.current;
                    const scaleX = node.scaleX();
                    const scaleY = node.scaleY();

                    node.scaleX(1);
                    node.scaleY(1);

                    onChange({
                        x: node.x(),
                        y: node.y(),
                        rotation: node.rotation(),
                        width: Math.max(20, node.width() * scaleX),
                        height: Math.max(20, node.height() * scaleY),
                    });
                }}
            />
            {isSelected && <Transformer ref={trRef} />}
        </>
    );
};

export default Builder;
