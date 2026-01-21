import React from 'react';
import { useEditor } from '../../context/EditorContext';
import { ScrollArea } from '../ui/scroll-area';
import { Button } from '../ui/button';
import {
  Type,
  Square,
  Circle,
  Minus,
  Image,
  QrCode,
  Barcode,
  Star,
  Eye,
  EyeOff,
  Lock,
  Unlock,
  GripVertical,
  Layers,
} from 'lucide-react';

const getElementIcon = (type) => {
  const icons = {
    text: Type,
    rectangle: Square,
    circle: Circle,
    line: Minus,
    image: Image,
    qrcode: QrCode,
    barcode: Barcode,
    rating: Star,
  };
  return icons[type] || Square;
};

export const LayersPanel = () => {
  const { state, actions } = useEditor();
  const { template, selectedElementIds } = state;

  // Sort elements by zIndex (highest first for layer panel)
  const sortedElements = [...template.elements].sort((a, b) => b.zIndex - a.zIndex);

  const handleSelectElement = (id, e) => {
    actions.selectElements([id], e.shiftKey || e.ctrlKey || e.metaKey);
  };

  const toggleVisibility = (id, visible, e) => {
    e.stopPropagation();
    actions.updateElement(id, { visible: !visible });
  };

  const toggleLock = (id, locked, e) => {
    e.stopPropagation();
    actions.updateElement(id, { locked: !locked });
  };

  return (
    <div 
      className="w-48 border-l bg-card/50 backdrop-blur-xl flex flex-col"
      data-testid="layers-panel"
    >
      <div className="p-3 border-b flex items-center gap-2">
        <Layers className="w-4 h-4" />
        <span className="text-sm font-semibold">Layers</span>
        <span className="text-xs text-muted-foreground ml-auto">{template.elements.length}</span>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1">
          {sortedElements.length === 0 ? (
            <div className="text-xs text-muted-foreground text-center py-8">
              No elements yet.<br />
              Add elements from the sidebar.
            </div>
          ) : (
            sortedElements.map((element) => {
              const Icon = getElementIcon(element.type);
              const isSelected = selectedElementIds.includes(element.id);

              return (
                <div
                  key={element.id}
                  className={`layer-item ${isSelected ? 'selected' : ''}`}
                  onClick={(e) => handleSelectElement(element.id, e)}
                  data-testid={`layer-item-${element.id}`}
                >
                  <GripVertical className="w-3 h-3 text-muted-foreground cursor-grab" />
                  <Icon className="w-4 h-4 shrink-0" />
                  <span className="text-xs truncate flex-1" title={element.name}>
                    {element.name}
                  </span>
                  <div className="flex items-center gap-0.5">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-5 w-5 p-0"
                      onClick={(e) => toggleVisibility(element.id, element.visible, e)}
                      data-testid={`layer-visibility-${element.id}`}
                    >
                      {element.visible ? (
                        <Eye className="w-3 h-3" />
                      ) : (
                        <EyeOff className="w-3 h-3 text-muted-foreground" />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-5 w-5 p-0"
                      onClick={(e) => toggleLock(element.id, element.locked, e)}
                      data-testid={`layer-lock-${element.id}`}
                    >
                      {element.locked ? (
                        <Lock className="w-3 h-3 text-primary" />
                      ) : (
                        <Unlock className="w-3 h-3 text-muted-foreground" />
                      )}
                    </Button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </ScrollArea>
    </div>
  );
};
