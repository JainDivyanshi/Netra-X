import React, { useEffect, useRef } from 'react';
import { Image as KonvaImage, Transformer } from 'react-konva';
import useImage from 'use-image';

const SketchElement = ({
  x,
  y,
  src,
  rotation,
  scale,
  isSelected,
  onSelect,
  onChange,
}) => {
  const [image] = useImage(src);
  const shapeRef = useRef();
  const trRef = useRef();

  useEffect(() => {
    if (isSelected && trRef.current && shapeRef.current) {
      trRef.current.nodes([shapeRef.current]);
      trRef.current.getLayer().batchDraw();
    }
  }, [isSelected]);

  return (
    <>
      <KonvaImage
        image={image}
        x={x}
        y={y}
        scaleX={scale}
        scaleY={scale}
        rotation={rotation}
        ref={shapeRef}
        draggable
        onClick={onSelect}
        onTap={onSelect}
        onDragEnd={(e) =>
          onChange({
            x: e.target.x(),
            y: e.target.y(),
          })
        }
        onTransformEnd={() => {
          const node = shapeRef.current;
          onChange({
            x: node.x(),
            y: node.y(),
            scale: node.scaleX(),
            rotation: node.rotation(),
          });
        }}
      />

      {isSelected && (
        <Transformer
          ref={trRef}
          boundBoxFunc={(oldBox, newBox) =>
            newBox.width < 5 || newBox.height < 5 ? oldBox : newBox
          }
        />
      )}
    </>
  );
};

export default SketchElement;