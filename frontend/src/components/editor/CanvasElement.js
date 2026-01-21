import React, { useState, useRef, useEffect } from 'react';
import { useEditor } from '../../context/EditorContext';
import { Star } from 'lucide-react';

// Resize handles component
const ResizeHandles = ({ onResizeStart }) => {
  const handles = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];
  
  const handlePositions = {
    nw: { top: -4, left: -4, cursor: 'nw-resize' },
    n: { top: -4, left: '50%', transform: 'translateX(-50%)', cursor: 'n-resize' },
    ne: { top: -4, right: -4, cursor: 'ne-resize' },
    e: { top: '50%', right: -4, transform: 'translateY(-50%)', cursor: 'e-resize' },
    se: { bottom: -4, right: -4, cursor: 'se-resize' },
    s: { bottom: -4, left: '50%', transform: 'translateX(-50%)', cursor: 's-resize' },
    sw: { bottom: -4, left: -4, cursor: 'sw-resize' },
    w: { top: '50%', left: -4, transform: 'translateY(-50%)', cursor: 'w-resize' },
  };

  return (
    <>
      {handles.map((handle) => (
        <div
          key={handle}
          className="selection-handle"
          style={{
            ...handlePositions[handle],
            cursor: handlePositions[handle].cursor,
          }}
          onMouseDown={(e) => {
            e.stopPropagation();
            onResizeStart(handle, e);
          }}
          data-testid={`resize-handle-${handle}`}
        />
      ))}
    </>
  );
};

// Rating stars component
const RatingStars = ({ value, maxStars = 5, starColor = '#FFD700', emptyColor = '#E0E0E0', size = 20 }) => {
  const numValue = parseFloat(value) || 0;
  
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: maxStars }, (_, i) => (
        <Star
          key={i}
          size={size}
          fill={i < numValue ? starColor : emptyColor}
          stroke={i < numValue ? starColor : emptyColor}
        />
      ))}
    </div>
  );
};

// QR Code placeholder (actual QR would need a library)
const QRCodePlaceholder = ({ content, size }) => (
  <div 
    className="flex items-center justify-center bg-white border-2 border-gray-300"
    style={{ width: size, height: size }}
  >
    <div className="grid grid-cols-5 gap-0.5 p-2" style={{ width: size * 0.7, height: size * 0.7 }}>
      {Array.from({ length: 25 }, (_, i) => (
        <div 
          key={i} 
          className={`${Math.random() > 0.4 ? 'bg-black' : 'bg-white'}`}
          style={{ aspectRatio: '1' }}
        />
      ))}
    </div>
  </div>
);

// Barcode placeholder
const BarcodePlaceholder = ({ content, width, height, displayValue }) => (
  <div 
    className="flex flex-col items-center justify-center bg-white"
    style={{ width, height }}
  >
    <div className="flex items-end h-3/4 gap-px">
      {content?.split('').map((char, i) => (
        <div 
          key={i}
          className="bg-black"
          style={{ 
            width: Math.max(2, width / 50),
            height: `${50 + Math.random() * 50}%` 
          }}
        />
      ))}
    </div>
    {displayValue && (
      <span className="text-xs font-mono mt-1">{content}</span>
    )}
  </div>
);

export const CanvasElement = ({ 
  element, 
  zoom, 
  isSelected, 
  onDragStart, 
  onResizeStart,
  onClick 
}) => {
  const { actions } = useEditor();
  const [isEditing, setIsEditing] = useState(false);
  const inputRef = useRef(null);

  const {
    id,
    type,
    x,
    y,
    width,
    height,
    rotation,
    visible,
    locked,
    style,
    textStyle,
    content,
    extraProps,
  } = element;

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  if (!visible) return null;

  const handleDoubleClick = (e) => {
    e.stopPropagation();
    if (type === 'text' && !locked) {
      setIsEditing(true);
    }
  };

  const handleTextChange = (e) => {
    actions.updateElement(id, { content: e.target.value });
  };

  const handleTextBlur = () => {
    setIsEditing(false);
  };

  const handleTextKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      setIsEditing(false);
    }
    if (e.key === 'Escape') {
      setIsEditing(false);
    }
  };

  const baseStyle = {
    position: 'absolute',
    left: x * zoom,
    top: y * zoom,
    width: width * zoom,
    height: height * zoom,
    transform: `rotate(${rotation}deg)`,
    opacity: style.opacity,
    cursor: locked ? 'not-allowed' : 'move',
    pointerEvents: locked ? 'none' : 'auto',
  };

  const renderElement = () => {
    switch (type) {
      case 'text':
        return (
          <div
            style={{
              ...baseStyle,
              display: 'flex',
              alignItems: 'center',
              justifyContent: textStyle?.textAlign === 'center' ? 'center' : 
                             textStyle?.textAlign === 'right' ? 'flex-end' : 'flex-start',
              backgroundColor: style.fill !== 'transparent' ? style.fill : undefined,
              border: style.strokeWidth > 0 ? `${style.strokeWidth}px solid ${style.stroke}` : undefined,
            }}
          >
            {isEditing ? (
              <textarea
                ref={inputRef}
                value={content}
                onChange={handleTextChange}
                onBlur={handleTextBlur}
                onKeyDown={handleTextKeyDown}
                className="w-full h-full bg-transparent resize-none outline-none p-1"
                style={{
                  fontFamily: textStyle?.fontFamily,
                  fontSize: (textStyle?.fontSize || 16) * zoom,
                  fontWeight: textStyle?.fontWeight,
                  fontStyle: textStyle?.fontStyle,
                  textDecoration: textStyle?.textDecoration,
                  textAlign: textStyle?.textAlign,
                  lineHeight: textStyle?.lineHeight,
                  color: textStyle?.color || '#000000',
                }}
              />
            ) : (
              <span
                style={{
                  fontFamily: textStyle?.fontFamily,
                  fontSize: (textStyle?.fontSize || 16) * zoom,
                  fontWeight: textStyle?.fontWeight,
                  fontStyle: textStyle?.fontStyle,
                  textDecoration: textStyle?.textDecoration,
                  lineHeight: textStyle?.lineHeight,
                  color: textStyle?.color || '#000000',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  padding: 4 * zoom,
                }}
              >
                {content}
              </span>
            )}
          </div>
        );

      case 'rectangle':
        return (
          <div
            style={{
              ...baseStyle,
              backgroundColor: style.fill,
              border: `${style.strokeWidth}px solid ${style.stroke}`,
              boxShadow: style.shadowBlur > 0 
                ? `${style.shadowOffsetX}px ${style.shadowOffsetY}px ${style.shadowBlur}px ${style.shadowColor}`
                : undefined,
            }}
          />
        );

      case 'circle':
        return (
          <div
            style={{
              ...baseStyle,
              backgroundColor: style.fill,
              border: `${style.strokeWidth}px solid ${style.stroke}`,
              borderRadius: '50%',
              boxShadow: style.shadowBlur > 0 
                ? `${style.shadowOffsetX}px ${style.shadowOffsetY}px ${style.shadowBlur}px ${style.shadowColor}`
                : undefined,
            }}
          />
        );

      case 'line':
        return (
          <div
            style={{
              ...baseStyle,
              backgroundColor: style.fill,
              height: Math.max(2, height * zoom),
            }}
          />
        );

      case 'image':
        const imageVariant = extraProps?.variant || 'rectangle';
        return (
          <div
            style={{
              ...baseStyle,
              backgroundColor: style.fill,
              border: `${style.strokeWidth}px solid ${style.stroke}`,
              borderRadius: imageVariant === 'circle' ? '50%' : 0,
              overflow: 'hidden',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {content ? (
              <img 
                src={content} 
                alt="" 
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: extraProps?.fit || 'cover',
                  borderRadius: imageVariant === 'circle' ? '50%' : 0,
                }}
              />
            ) : (
              <div className="text-xs text-muted-foreground">
                {imageVariant === 'circle' ? '○' : '□'} Image
              </div>
            )}
          </div>
        );

      case 'qrcode':
        return (
          <div style={baseStyle}>
            <QRCodePlaceholder 
              content={content} 
              size={Math.min(width, height) * zoom} 
            />
          </div>
        );

      case 'barcode':
        return (
          <div style={baseStyle}>
            <BarcodePlaceholder 
              content={content}
              width={width * zoom}
              height={height * zoom}
              displayValue={extraProps?.displayValue}
            />
          </div>
        );

      case 'rating':
        return (
          <div
            style={{
              ...baseStyle,
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <RatingStars
              value={content}
              maxStars={extraProps?.maxStars || 5}
              starColor={extraProps?.starColor || '#FFD700'}
              emptyColor={extraProps?.emptyColor || '#E0E0E0'}
              size={(height * zoom) * 0.8}
            />
          </div>
        );

      default:
        return null;
    }
  };

  const wrapperStyle = {
    position: 'absolute',
    left: x * zoom,
    top: y * zoom,
    width: width * zoom,
    height: height * zoom,
    transform: `rotate(${rotation}deg)`,
    transformOrigin: 'center center',
    zIndex: element.zIndex + 10,
  };

  return (
    <div
      className={`${isSelected ? 'element-selected' : ''} ${!isSelected ? 'hover:element-hover' : ''}`}
      style={wrapperStyle}
      onMouseDown={(e) => {
        e.stopPropagation();
        if (!locked && !isEditing) {
          onDragStart(e);
        }
      }}
      onClick={onClick}
      onDoubleClick={handleDoubleClick}
      data-testid={`canvas-element-${id}`}
    >
      {/* The actual element content */}
      {renderElement()}

      {/* Selection handles */}
      {isSelected && !locked && (
        <ResizeHandles onResizeStart={onResizeStart} />
      )}

      {/* Locked indicator */}
      {locked && isSelected && (
        <div className="absolute -top-6 left-0 text-xs text-muted-foreground bg-background px-1 rounded">
          Locked
        </div>
      )}
    </div>
  );
};
