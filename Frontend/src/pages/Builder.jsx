import { useState, useRef, useEffect } from 'react';
import {
  Stage,
  Layer,
  Image as KonvaImage,
  Transformer,
} from 'react-konva';
import useImage from 'use-image';

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

const COMPONENT_LIBRARY = [
  {
    id: 'eyes',
    name: 'Eyes',
    src: '/assets/components/eyes1.jpg',
    width: 150,
    height: 100,
  },
  {
    id: 'nose',
    name: 'Nose',
    src: '/assets/components/nose.jpg',
    width: 80,
    height: 100,
  },
];

const Builder = () => {
  const [elements, setElements] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const stageRef = useRef(null);

  const selectedElement = elements.find(
    (el) => el.instanceId === selectedId
  );

  const addElement = (component) => {
    setElements((prev) => [
      ...prev,
      {
        instanceId: Date.now(),
        ...component,
        x: 300,
        y: 200,
        rotation: 0,
      },
    ]);
  };

  const updateElement = (id, newAttrs) => {
    setElements((prev) =>
      prev.map((el) =>
        el.instanceId === id ? { ...el, ...newAttrs } : el
      )
    );
  };

  const deleteSelected = () => {
    if (!selectedId) return;
    setElements((prev) =>
      prev.filter((el) => el.instanceId !== selectedId)
    );
    setSelectedId(null);
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

      // Prevent page scrolling with arrow keys
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

      // Delete key handling
      if (e.key === 'Delete' || e.key === 'Backspace') {
        setElements((prev) =>
          prev.filter((el) => el.instanceId !== selectedId)
        );
        setSelectedId(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [selectedId, setElements]);

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

      if (!response.ok) {
        throw new Error('Detection failed');
      }

      const result = await response.json();
      console.log('Match result:', result);

      // later: navigate to /match-result
    } catch (error) {
      console.error('Error during detection:', error);
    }
  };

  const exportPNG = () => {
    const stage = stageRef.current;
    if (!stage) return;

    const dataURL = stage.toDataURL({
      pixelRatio: 2, // higher quality
    });

    const link = document.createElement('a');
    link.download = 'netra-x-sketch.png';
    link.href = dataURL;
    link.click();
  };
  return (
    <div className="h-screen flex">
      {/* LEFT SIDEBAR */}
      <div className="w-1/5 bg-gray-200 p-4">
        <h2 className="font-bold text-lg mb-4">Components</h2>

        {COMPONENT_LIBRARY.map((comp) => (
          <button
            key={comp.id}
            onClick={() => addElement(comp)}
            className="mb-3 w-full bg-white rounded shadow p-2"
          >
            <img src={comp.src} alt={comp.name} className="w-16 h-16 mx-auto" />
            <p className="text-sm text-center mt-1">{comp.name}</p>
          </button>
        ))}

        <button
          onClick={deleteSelected}
          disabled={!selectedId}
          className="mt-6 w-full bg-red-500 text-white py-2 rounded disabled:opacity-50"
        >
          Delete
        </button>
      </div>

      {/* CANVAS */}
      <div className="w-3/5 bg-white p-4">
        <h2 className="font-bold text-lg mb-2">Canvas</h2>

        <Stage
          ref={stageRef}
          width={700}
          height={500}
          className="border border-gray-400"
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

      {/* RIGHT PROPERTIES PANEL */}
      <div className="w-1/5 bg-gray-100 p-4 border-l">
        <h2 className="font-bold text-lg mb-4">Properties</h2>

        {!selectedElement && (
          <p className="text-sm text-gray-500">
            Select an element to edit properties
          </p>
        )}

        {selectedElement && (
          <div className="space-y-3 text-sm">
            {['x', 'y', 'width', 'height', 'rotation'].map((field) => (
              <div key={field}>
                <label className="block mb-1 capitalize">{field}</label>
                <input
                  type="number"
                  value={Math.round(selectedElement[field])}
                  onChange={(e) =>
                    updateElement(selectedId, {
                      [field]: Number(e.target.value),
                    })
                  }
                  className="w-full border px-2 py-1 rounded"
                />
              </div>
            ))}

            <div className="flex gap-2 pt-2">
              <button
                onClick={bringForward}
                className="flex-1 bg-blue-500 text-white py-1 rounded"
              >
                Forward
              </button>
              <button
                onClick={sendBackward}
                className="flex-1 bg-blue-500 text-white py-1 rounded"
              >
                Backward
              </button>
            </div>
          </div>
        )}
        <div className="pt-4 border-t mt-4 space-y-2">
          <button
            onClick={exportPNG}
            className="w-full bg-green-600 text-white py-2 rounded"
          >
            Export PNG
          </button>

          <button
            onClick={detectFace}
            className="w-full bg-purple-600 text-white py-2 rounded"
          >
            Detect
          </button>
        </div>
      </div>
    </div>
  );
};

// Transformable Image Component
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