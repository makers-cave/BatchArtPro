import React, { useState } from 'react';
import { useEditor } from '../../context/EditorContext';
import { ScrollArea } from '../ui/scroll-area';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Button } from '../ui/button';
import { Slider } from '../ui/slider';
import { Switch } from '../ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Textarea } from '../ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import {
  Lock,
  Unlock,
  Eye,
  EyeOff,
  Trash2,
  Copy,
  ArrowUp,
  ArrowDown,
  ChevronsUp,
  ChevronsDown,
  RefreshCw,
} from 'lucide-react';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

const PropertyRow = ({ label, children }) => (
  <div className="flex items-center gap-2 mb-2">
    <Label className="w-16 text-xs text-muted-foreground shrink-0">{label}</Label>
    <div className="flex-1">{children}</div>
  </div>
);

const ColorInput = ({ value, onChange, label }) => (
  <div className="flex items-center gap-2">
    <input
      type="color"
      value={value || '#000000'}
      onChange={(e) => onChange(e.target.value)}
      className="w-8 h-8 rounded border cursor-pointer"
    />
    <Input
      value={value || '#000000'}
      onChange={(e) => onChange(e.target.value)}
      className="h-8 flex-1 font-mono text-xs"
    />
  </div>
);

const FONT_FAMILIES = [
  'Arial',
  'Helvetica',
  'Times New Roman',
  'Georgia',
  'Verdana',
  'Courier New',
  'Comic Sans MS',
  'Impact',
  'Chivo',
  'Manrope',
  'JetBrains Mono',
  'Bree Serif',
  'Cabin',
  'Cairo',
  'Candal',
];

export const PropertiesPanel = () => {
  const { state, actions } = useEditor();
  const { selectedElementIds, template } = state;

  const selectedElements = template.elements.filter(el => selectedElementIds.includes(el.id));
  const element = selectedElements.length === 1 ? selectedElements[0] : null;

  const updateElement = (updates) => {
    if (element) {
      actions.updateElement(element.id, updates);
    }
  };

  const updateStyle = (styleUpdates) => {
    if (element) {
      actions.updateElement(element.id, {
        style: { ...element.style, ...styleUpdates },
      });
    }
  };

  const updateTextStyle = (textStyleUpdates) => {
    if (element) {
      actions.updateElement(element.id, {
        textStyle: { ...element.textStyle, ...textStyleUpdates },
      });
    }
  };

  const updateExtraProps = (propsUpdates) => {
    if (element) {
      actions.updateElement(element.id, {
        extraProps: { ...element.extraProps, ...propsUpdates },
      });
    }
  };

  if (!element) {
    return (
      <div className="w-72 border-l bg-card/50 backdrop-blur-xl flex flex-col" data-testid="properties-panel">
        <div className="p-4 border-b">
          <h3 className="font-semibold text-sm">Properties</h3>
        </div>
        <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground p-4 text-center">
          {selectedElements.length > 1 
            ? `${selectedElements.length} elements selected`
            : 'Select an element to edit properties'
          }
        </div>
      </div>
    );
  }

  return (
    <div className="w-72 border-l bg-card/50 backdrop-blur-xl flex flex-col" data-testid="properties-panel">
      <div className="p-4 border-b">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-sm">{element.name}</h3>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0"
              onClick={() => updateElement({ locked: !element.locked })}
              data-testid="toggle-lock-btn"
            >
              {element.locked ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0"
              onClick={() => updateElement({ visible: !element.visible })}
              data-testid="toggle-visibility-btn"
            >
              {element.visible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
            </Button>
          </div>
        </div>
        <Input
          value={element.name}
          onChange={(e) => updateElement({ name: e.target.value })}
          className="h-8 mt-2 text-sm"
          placeholder="Element name"
          data-testid="element-name-input"
        />
      </div>

      <ScrollArea className="flex-1">
        <Tabs defaultValue="general" className="w-full">
          <TabsList className="w-full justify-start rounded-none border-b bg-transparent px-4">
            <TabsTrigger value="general" className="text-xs" data-testid="tab-general">General</TabsTrigger>
            {element.type === 'text' && (
              <TabsTrigger value="fonts" className="text-xs" data-testid="tab-fonts">Fonts</TabsTrigger>
            )}
            {element.type === 'handwriting' && (
              <TabsTrigger value="handwriting" className="text-xs" data-testid="tab-handwriting">Handwriting</TabsTrigger>
            )}
            <TabsTrigger value="style" className="text-xs" data-testid="tab-style">Style</TabsTrigger>
            <TabsTrigger value="shadow" className="text-xs" data-testid="tab-shadow">Shadow</TabsTrigger>
          </TabsList>

          {/* General Tab */}
          <TabsContent value="general" className="p-4 space-y-4">
            {/* Position */}
            <div>
              <Label className="text-xs text-muted-foreground mb-2 block">Position</Label>
              <div className="grid grid-cols-2 gap-2">
                <div className="flex items-center gap-1">
                  <span className="text-xs font-mono w-4">X</span>
                  <Input
                    type="number"
                    value={Math.round(element.x)}
                    onChange={(e) => updateElement({ x: parseFloat(e.target.value) || 0 })}
                    className="h-8 font-mono text-xs"
                    data-testid="prop-x"
                  />
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-xs font-mono w-4">Y</span>
                  <Input
                    type="number"
                    value={Math.round(element.y)}
                    onChange={(e) => updateElement({ y: parseFloat(e.target.value) || 0 })}
                    className="h-8 font-mono text-xs"
                    data-testid="prop-y"
                  />
                </div>
              </div>
            </div>

            {/* Size */}
            <div>
              <Label className="text-xs text-muted-foreground mb-2 block">Size</Label>
              <div className="grid grid-cols-2 gap-2">
                <div className="flex items-center gap-1">
                  <span className="text-xs font-mono w-4">W</span>
                  <Input
                    type="number"
                    value={Math.round(element.width)}
                    onChange={(e) => updateElement({ width: parseFloat(e.target.value) || 20 })}
                    className="h-8 font-mono text-xs"
                    data-testid="prop-width"
                  />
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-xs font-mono w-4">H</span>
                  <Input
                    type="number"
                    value={Math.round(element.height)}
                    onChange={(e) => updateElement({ height: parseFloat(e.target.value) || 20 })}
                    className="h-8 font-mono text-xs"
                    data-testid="prop-height"
                  />
                </div>
              </div>
            </div>

            {/* Rotation */}
            <div>
              <Label className="text-xs text-muted-foreground mb-2 block">Rotation</Label>
              <div className="flex items-center gap-2">
                <Slider
                  value={[element.rotation]}
                  onValueChange={([value]) => updateElement({ rotation: value })}
                  min={0}
                  max={360}
                  step={1}
                  className="flex-1"
                  data-testid="prop-rotation-slider"
                />
                <Input
                  type="number"
                  value={element.rotation}
                  onChange={(e) => updateElement({ rotation: parseFloat(e.target.value) || 0 })}
                  className="h-8 w-16 font-mono text-xs"
                  data-testid="prop-rotation"
                />
              </div>
            </div>

            {/* Opacity */}
            <div>
              <Label className="text-xs text-muted-foreground mb-2 block">Opacity</Label>
              <div className="flex items-center gap-2">
                <Slider
                  value={[element.style.opacity * 100]}
                  onValueChange={([value]) => updateStyle({ opacity: value / 100 })}
                  min={0}
                  max={100}
                  step={1}
                  className="flex-1"
                  data-testid="prop-opacity-slider"
                />
                <span className="text-xs font-mono w-10 text-right">{Math.round(element.style.opacity * 100)}%</span>
              </div>
            </div>

            {/* Content for certain types */}
            {['text', 'qrcode', 'barcode', 'rating'].includes(element.type) && (
              <div>
                <Label className="text-xs text-muted-foreground mb-2 block">
                  {element.type === 'text' ? 'Text Content' : 
                   element.type === 'rating' ? 'Rating Value' : 'Data/Content'}
                </Label>
                <Input
                  value={element.content || ''}
                  onChange={(e) => updateElement({ content: e.target.value })}
                  className="h-8 text-xs"
                  placeholder={element.type === 'rating' ? '0-5' : 'Enter content'}
                  data-testid="prop-content"
                />
              </div>
            )}

            {/* Image URL for image type */}
            {element.type === 'image' && (
              <div>
                <Label className="text-xs text-muted-foreground mb-2 block">Image URL</Label>
                <Input
                  value={element.content || ''}
                  onChange={(e) => updateElement({ content: e.target.value })}
                  className="h-8 text-xs"
                  placeholder="Enter image URL"
                  data-testid="prop-image-url"
                />
              </div>
            )}

            {/* Data Field Binding */}
            <div>
              <Label className="text-xs text-muted-foreground mb-2 block">Data Field</Label>
              <Input
                value={element.dataField || ''}
                onChange={(e) => updateElement({ dataField: e.target.value })}
                className="h-8 text-xs"
                placeholder="e.g., {{name}}"
                data-testid="prop-datafield"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Use {'{{fieldName}}'} to bind data
              </p>
            </div>

            {/* Layer ordering */}
            <div>
              <Label className="text-xs text-muted-foreground mb-2 block">Layer Order</Label>
              <div className="flex gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 flex-1"
                  onClick={() => actions.reorderElement(element.id, 'top')}
                  data-testid="layer-top-btn"
                >
                  <ChevronsUp className="w-4 h-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 flex-1"
                  onClick={() => actions.reorderElement(element.id, 'up')}
                  data-testid="layer-up-btn"
                >
                  <ArrowUp className="w-4 h-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 flex-1"
                  onClick={() => actions.reorderElement(element.id, 'down')}
                  data-testid="layer-down-btn"
                >
                  <ArrowDown className="w-4 h-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 flex-1"
                  onClick={() => actions.reorderElement(element.id, 'bottom')}
                  data-testid="layer-bottom-btn"
                >
                  <ChevronsDown className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2 pt-2 border-t">
              <Button
                variant="outline"
                size="sm"
                className="flex-1 h-8"
                onClick={() => {
                  actions.copyElements();
                  actions.pasteElements();
                }}
                data-testid="duplicate-btn"
              >
                <Copy className="w-4 h-4 mr-1" />
                Duplicate
              </Button>
              <Button
                variant="destructive"
                size="sm"
                className="flex-1 h-8"
                onClick={() => actions.deleteElements([element.id])}
                data-testid="delete-btn"
              >
                <Trash2 className="w-4 h-4 mr-1" />
                Delete
              </Button>
            </div>
          </TabsContent>

          {/* Fonts Tab (Text only) */}
          {element.type === 'text' && (
            <TabsContent value="fonts" className="p-4 space-y-4">
              <div>
                <Label className="text-xs text-muted-foreground mb-2 block">Font Family</Label>
                <Select
                  value={element.textStyle?.fontFamily || 'Arial'}
                  onValueChange={(value) => updateTextStyle({ fontFamily: value })}
                >
                  <SelectTrigger className="h-8" data-testid="font-family-select">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FONT_FAMILIES.map((font) => (
                      <SelectItem key={font} value={font} style={{ fontFamily: font }}>
                        {font}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs text-muted-foreground mb-2 block">Font Size</Label>
                <Input
                  type="number"
                  value={element.textStyle?.fontSize || 16}
                  onChange={(e) => updateTextStyle({ fontSize: parseFloat(e.target.value) || 16 })}
                  className="h-8 font-mono text-xs"
                  data-testid="font-size-input"
                />
              </div>

              <div>
                <Label className="text-xs text-muted-foreground mb-2 block">Font Weight</Label>
                <Select
                  value={element.textStyle?.fontWeight || 'normal'}
                  onValueChange={(value) => updateTextStyle({ fontWeight: value })}
                >
                  <SelectTrigger className="h-8" data-testid="font-weight-select">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="bold">Bold</SelectItem>
                    <SelectItem value="100">100</SelectItem>
                    <SelectItem value="200">200</SelectItem>
                    <SelectItem value="300">300</SelectItem>
                    <SelectItem value="400">400</SelectItem>
                    <SelectItem value="500">500</SelectItem>
                    <SelectItem value="600">600</SelectItem>
                    <SelectItem value="700">700</SelectItem>
                    <SelectItem value="800">800</SelectItem>
                    <SelectItem value="900">900</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs text-muted-foreground mb-2 block">Font Style</Label>
                <Select
                  value={element.textStyle?.fontStyle || 'normal'}
                  onValueChange={(value) => updateTextStyle({ fontStyle: value })}
                >
                  <SelectTrigger className="h-8" data-testid="font-style-select">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="italic">Italic</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs text-muted-foreground mb-2 block">Text Align</Label>
                <Select
                  value={element.textStyle?.textAlign || 'left'}
                  onValueChange={(value) => updateTextStyle({ textAlign: value })}
                >
                  <SelectTrigger className="h-8" data-testid="text-align-select">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="left">Left</SelectItem>
                    <SelectItem value="center">Center</SelectItem>
                    <SelectItem value="right">Right</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs text-muted-foreground mb-2 block">Text Color</Label>
                <ColorInput
                  value={element.textStyle?.color || '#000000'}
                  onChange={(value) => updateTextStyle({ color: value })}
                  label="Color"
                />
              </div>

              <div>
                <Label className="text-xs text-muted-foreground mb-2 block">Line Height</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={element.textStyle?.lineHeight || 1.2}
                  onChange={(e) => updateTextStyle({ lineHeight: parseFloat(e.target.value) || 1.2 })}
                  className="h-8 font-mono text-xs"
                  data-testid="line-height-input"
                />
              </div>
            </TabsContent>
          )}

          {/* Handwriting Tab */}
          {element.type === 'handwriting' && (
            <HandwritingTab 
              element={element} 
              updateElement={updateElement}
              updateExtraProps={updateExtraProps}
            />
          )}

          {/* Style Tab */}
          <TabsContent value="style" className="p-4 space-y-4">
            <div>
              <Label className="text-xs text-muted-foreground mb-2 block">Fill Color</Label>
              <ColorInput
                value={element.style.fill}
                onChange={(value) => updateStyle({ fill: value })}
                label="Fill"
              />
            </div>

            <div>
              <Label className="text-xs text-muted-foreground mb-2 block">Stroke Color</Label>
              <ColorInput
                value={element.style.stroke}
                onChange={(value) => updateStyle({ stroke: value })}
                label="Stroke"
              />
            </div>

            <div>
              <Label className="text-xs text-muted-foreground mb-2 block">Stroke Width</Label>
              <div className="flex items-center gap-2">
                <Slider
                  value={[element.style.strokeWidth]}
                  onValueChange={([value]) => updateStyle({ strokeWidth: value })}
                  min={0}
                  max={20}
                  step={1}
                  className="flex-1"
                  data-testid="stroke-width-slider"
                />
                <span className="text-xs font-mono w-8 text-right">{element.style.strokeWidth}px</span>
              </div>
            </div>
          </TabsContent>

          {/* Shadow Tab */}
          <TabsContent value="shadow" className="p-4 space-y-4">
            <div>
              <Label className="text-xs text-muted-foreground mb-2 block">Shadow Color</Label>
              <ColorInput
                value={element.style.shadowColor || '#000000'}
                onChange={(value) => updateStyle({ shadowColor: value })}
                label="Shadow"
              />
            </div>

            <div>
              <Label className="text-xs text-muted-foreground mb-2 block">Blur</Label>
              <div className="flex items-center gap-2">
                <Slider
                  value={[element.style.shadowBlur || 0]}
                  onValueChange={([value]) => updateStyle({ shadowBlur: value })}
                  min={0}
                  max={50}
                  step={1}
                  className="flex-1"
                  data-testid="shadow-blur-slider"
                />
                <span className="text-xs font-mono w-8 text-right">{element.style.shadowBlur || 0}px</span>
              </div>
            </div>

            <div>
              <Label className="text-xs text-muted-foreground mb-2 block">Offset X</Label>
              <div className="flex items-center gap-2">
                <Slider
                  value={[element.style.shadowOffsetX || 0]}
                  onValueChange={([value]) => updateStyle({ shadowOffsetX: value })}
                  min={-50}
                  max={50}
                  step={1}
                  className="flex-1"
                  data-testid="shadow-offset-x-slider"
                />
                <span className="text-xs font-mono w-8 text-right">{element.style.shadowOffsetX || 0}px</span>
              </div>
            </div>

            <div>
              <Label className="text-xs text-muted-foreground mb-2 block">Offset Y</Label>
              <div className="flex items-center gap-2">
                <Slider
                  value={[element.style.shadowOffsetY || 0]}
                  onValueChange={([value]) => updateStyle({ shadowOffsetY: value })}
                  min={-50}
                  max={50}
                  step={1}
                  className="flex-1"
                  data-testid="shadow-offset-y-slider"
                />
                <span className="text-xs font-mono w-8 text-right">{element.style.shadowOffsetY || 0}px</span>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </ScrollArea>
    </div>
  );
};
