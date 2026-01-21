import React, { useRef, useState, useEffect, useCallback } from 'react';
import { useEditor } from '../../context/EditorContext';
import { CanvasElement } from './CanvasElement';
import { Button } from '../ui/button';
import { Slider } from '../ui/slider';
import { ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';

export const Canvas = ({ canvasRef }) => {
  const { state, actions } = useEditor();
  const containerRef = useRef(null);
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [draggedElement, setDraggedElement] = useState(null);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [resizing, setResizing] = useState(null);
  const [resizeStart, setResizeStart] = useState(null);

  const { zoom, pan, template, tool, selectedElementIds } = state;
  const { settings, elements } = template;

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Don't handle if typing in input
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const ctrlKey = isMac ? e.metaKey : e.ctrlKey;

      // Delete selected elements
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedElementIds.length > 0) {
        e.preventDefault();
        actions.deleteElements(selectedElementIds);
      }

      // Copy
      if (ctrlKey && e.key === 'c') {
        e.preventDefault();
        actions.copyElements();
      }

      // Paste
      if (ctrlKey && e.key === 'v') {
        e.preventDefault();
        actions.pasteElements();
      }

      // Undo
      if (ctrlKey && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        actions.undo();
      }

      // Redo
      if (ctrlKey && (e.key === 'y' || (e.shiftKey && e.key === 'z'))) {
        e.preventDefault();
        actions.redo();
      }

      // Select all
      if (ctrlKey && e.key === 'a') {
        e.preventDefault();
        actions.selectElements(elements.map(el => el.id));
      }

      // Escape to deselect
      if (e.key === 'Escape') {
        actions.clearSelection();
      }

      // Arrow keys to move selected elements
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key) && selectedElementIds.length > 0) {
        e.preventDefault();
        const step = e.shiftKey ? 10 : 1;
        selectedElementIds.forEach(id => {
          const element = elements.find(el => el.id === id);
          if (element && !element.locked) {
            let dx = 0, dy = 0;
            if (e.key === 'ArrowUp') dy = -step;
            if (e.key === 'ArrowDown') dy = step;
            if (e.key === 'ArrowLeft') dx = -step;
            if (e.key === 'ArrowRight') dx = step;
            actions.updateElement(id, { x: element.x + dx, y: element.y + dy });
          }
        });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedElementIds, elements, actions]);

  // Handle mouse wheel zoom
  const handleWheel = useCallback((e) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const delta = e.deltaY > 0 ? -0.1 : 0.1;
      actions.setZoom(zoom + delta);
    }
  }, [zoom, actions]);

  // Handle canvas click (deselect)
  const handleCanvasClick = (e) => {
    if (e.target === e.currentTarget || e.target.classList.contains('canvas-area')) {
      actions.clearSelection();
    }
  };

  // Handle pan start
  const handleMouseDown = (e) => {
    if (tool === 'pan' || e.button === 1) {
      setIsPanning(true);
      setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    }
  };

  // Handle pan move
  const handleMouseMove = (e) => {
    if (isPanning) {
      actions.setPan({
        x: e.clientX - panStart.x,
        y: e.clientY - panStart.y,
      });
    }

    // Handle element dragging
    if (draggedElement && !resizing) {
      const rect = containerRef.current.getBoundingClientRect();
      const x = (e.clientX - rect.left - pan.x) / zoom - dragOffset.x;
      const y = (e.clientY - rect.top - pan.y) / zoom - dragOffset.y;

      let newX = x;
      let newY = y;

      // Snap to grid
      if (settings.snapToGrid) {
        newX = Math.round(x / settings.gridSize) * settings.gridSize;
        newY = Math.round(y / settings.gridSize) * settings.gridSize;
      }

      actions.updateElement(draggedElement.id, { x: newX, y: newY });
    }

    // Handle resizing
    if (resizing && resizeStart) {
      const rect = containerRef.current.getBoundingClientRect();
      const currentX = (e.clientX - rect.left - pan.x) / zoom;
      const currentY = (e.clientY - rect.top - pan.y) / zoom;

      const element = elements.find(el => el.id === resizing.elementId);
      if (!element) return;

      let newWidth = element.width;
      let newHeight = element.height;
      let newX = element.x;
      let newY = element.y;

      const dx = currentX - resizeStart.x;
      const dy = currentY - resizeStart.y;

      switch (resizing.handle) {
        case 'se':
          newWidth = Math.max(20, resizeStart.width + dx);
          newHeight = Math.max(20, resizeStart.height + dy);
          break;
        case 'sw':
          newWidth = Math.max(20, resizeStart.width - dx);
          newX = resizeStart.elementX + dx;
          newHeight = Math.max(20, resizeStart.height + dy);
          break;
        case 'ne':
          newWidth = Math.max(20, resizeStart.width + dx);
          newHeight = Math.max(20, resizeStart.height - dy);
          newY = resizeStart.elementY + dy;
          break;
        case 'nw':
          newWidth = Math.max(20, resizeStart.width - dx);
          newHeight = Math.max(20, resizeStart.height - dy);
          newX = resizeStart.elementX + dx;
          newY = resizeStart.elementY + dy;
          break;
        case 'n':
          newHeight = Math.max(20, resizeStart.height - dy);
          newY = resizeStart.elementY + dy;
          break;
        case 's':
          newHeight = Math.max(20, resizeStart.height + dy);
          break;
        case 'e':
          newWidth = Math.max(20, resizeStart.width + dx);
          break;
        case 'w':
          newWidth = Math.max(20, resizeStart.width - dx);
          newX = resizeStart.elementX + dx;
          break;
        default:
          break;
      }

      actions.updateElement(resizing.elementId, {
        width: newWidth,
        height: newHeight,
        x: newX,
        y: newY,
      });
    }
  };

  // Handle pan/drag end
  const handleMouseUp = () => {
    setIsPanning(false);
    setDraggedElement(null);
    setResizing(null);
    setResizeStart(null);
  };

  // Element drag start
  const handleElementDragStart = (element, e) => {
    if (element.locked || tool !== 'select') return;

    const rect = containerRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left - pan.x) / zoom;
    const y = (e.clientY - rect.top - pan.y) / zoom;

    setDragOffset({ x: x - element.x, y: y - element.y });
    setDraggedElement(element);

    if (!selectedElementIds.includes(element.id)) {
      actions.selectElements([element.id], e.shiftKey);
    }
  };

  // Resize handle start
  const handleResizeStart = (elementId, handle, e) => {
    e.stopPropagation();
    const element = elements.find(el => el.id === elementId);
    if (!element) return;

    const rect = containerRef.current.getBoundingClientRect();
    const x = (e.clientX - rect.left - pan.x) / zoom;
    const y = (e.clientY - rect.top - pan.y) / zoom;

    setResizing({ elementId, handle });
    setResizeStart({
      x,
      y,
      width: element.width,
      height: element.height,
      elementX: element.x,
      elementY: element.y,
    });
  };

  // Zoom controls
  const handleZoomIn = () => actions.setZoom(zoom + 0.1);
  const handleZoomOut = () => actions.setZoom(zoom - 0.1);
  const handleZoomReset = () => {
    actions.setZoom(1);
    actions.setPan({ x: 0, y: 0 });
  };

  // Sort elements by zIndex
  const sortedElements = [...elements].sort((a, b) => a.zIndex - b.zIndex);

  return (
    <div 
      className="flex-1 flex flex-col bg-muted/20 overflow-hidden"
      data-testid="canvas-container"
    >
      {/* Canvas area */}
      <div
        ref={containerRef}
        className={`flex-1 relative overflow-hidden ${tool === 'pan' ? 'cursor-grab' : ''} ${isPanning ? 'cursor-grabbing' : ''}`}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onClick={handleCanvasClick}
        onWheel={handleWheel}
      >
        {/* Canvas wrapper for transform */}
        <div
          className="absolute"
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px)`,
          }}
        >
          {/* The actual canvas */}
          <div
            ref={canvasRef}
            className={`relative shadow-2xl ${settings.showGrid ? 'canvas-grid' : ''}`}
            style={{
              width: settings.width * zoom,
              height: settings.height * zoom,
              backgroundColor: settings.backgroundColor,
              transformOrigin: 'top left',
            }}
            data-testid="canvas"
          >
            {/* Elements */}
            {sortedElements.map((element) => (
              <CanvasElement
                key={element.id}
                element={element}
                zoom={zoom}
                isSelected={selectedElementIds.includes(element.id)}
                onDragStart={(e) => handleElementDragStart(element, e)}
                onResizeStart={(handle, e) => handleResizeStart(element.id, handle, e)}
                onClick={(e) => {
                  e.stopPropagation();
                  actions.selectElements([element.id], e.shiftKey);
                }}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Zoom controls */}
      <div className="h-10 border-t bg-card/50 backdrop-blur-xl flex items-center justify-center gap-4 px-4" data-testid="zoom-controls">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleZoomOut}
          className="h-7 w-7 p-0"
          data-testid="zoom-out-btn"
        >
          <ZoomOut className="w-4 h-4" />
        </Button>
        <div className="flex items-center gap-2 w-48">
          <span className="text-xs text-muted-foreground">Zoom</span>
          <Slider
            value={[zoom * 100]}
            onValueChange={([value]) => actions.setZoom(value / 100)}
            min={10}
            max={300}
            step={10}
            className="flex-1"
            data-testid="zoom-slider"
          />
          <span className="text-xs font-mono w-12 text-right">{Math.round(zoom * 100)}%</span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleZoomIn}
          className="h-7 w-7 p-0"
          data-testid="zoom-in-btn"
        >
          <ZoomIn className="w-4 h-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleZoomReset}
          className="h-7 w-7 p-0"
          data-testid="zoom-reset-btn"
        >
          <Maximize2 className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
};
