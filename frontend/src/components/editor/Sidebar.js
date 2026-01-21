import React from 'react';
import { useEditor } from '../../context/EditorContext';
import { ScrollArea } from '../ui/scroll-area';
import { Separator } from '../ui/separator';
import {
  Type,
  Square,
  Circle,
  Minus,
  Image,
  QrCode,
  Barcode,
  Star,
  MousePointer2,
  Move,
  ImagePlus,
  CircleDot,
  Heart,
} from 'lucide-react';
import { toast } from 'sonner';

const ToolButton = ({ icon: Icon, label, onClick, active, testId }) => (
  <button
    onClick={onClick}
    className={`tool-btn w-full ${active ? 'bg-primary/20 text-primary' : ''}`}
    data-testid={testId}
  >
    <Icon className="w-5 h-5 mb-1" />
    <span className="text-xs">{label}</span>
  </button>
);

const SidebarSection = ({ title, children }) => (
  <div className="sidebar-section">
    <div className="sidebar-section-title">{title}</div>
    <div className="grid grid-cols-2 gap-1 px-2">
      {children}
    </div>
  </div>
);

export const Sidebar = () => {
  const { state, actions } = useEditor();

  const createTextElement = () => {
    actions.addElement({
      type: 'text',
      name: 'Text',
      x: 100,
      y: 100,
      width: 200,
      height: 50,
      content: 'Double-click to edit',
      style: {
        fill: 'transparent',
        stroke: 'transparent',
        strokeWidth: 0,
        opacity: 1,
      },
      textStyle: {
        fontFamily: 'Arial',
        fontSize: 24,
        fontWeight: 'normal',
        fontStyle: 'normal',
        textDecoration: 'none',
        textAlign: 'left',
        lineHeight: 1.2,
        color: '#000000',
      },
    });
    actions.setTool('select');
    toast.success('Text element added');
  };

  const createShapeElement = (shapeType) => {
    const shapeConfig = {
      rectangle: { width: 150, height: 100 },
      circle: { width: 100, height: 100 },
      line: { width: 200, height: 4 },
    };

    const config = shapeConfig[shapeType] || shapeConfig.rectangle;

    actions.addElement({
      type: shapeType,
      name: shapeType.charAt(0).toUpperCase() + shapeType.slice(1),
      x: 100,
      y: 100,
      ...config,
      style: {
        fill: shapeType === 'line' ? '#000000' : '#e0e0e0',
        stroke: '#000000',
        strokeWidth: shapeType === 'line' ? 0 : 2,
        opacity: 1,
      },
    });
    actions.setTool('select');
    toast.success(`${shapeType} added`);
  };

  const createImageElement = (variant = 'rectangle') => {
    const baseConfig = {
      type: 'image',
      name: `Image (${variant})`,
      x: 100,
      y: 100,
      width: 200,
      height: 200,
      content: '', // URL will be set when image is loaded
      style: {
        fill: '#f0f0f0',
        stroke: '#cccccc',
        strokeWidth: 1,
        opacity: 1,
      },
      extraProps: {
        variant, // rectangle, circle, masked
        fit: 'cover',
      },
    };

    actions.addElement(baseConfig);
    actions.setTool('select');
    toast.success('Image placeholder added');
  };

  const createComponentElement = (componentType) => {
    const componentConfigs = {
      qrcode: {
        type: 'qrcode',
        name: 'QR Code',
        width: 150,
        height: 150,
        content: 'https://example.com',
        extraProps: {
          errorCorrectionLevel: 'M',
          margin: 4,
        },
      },
      barcode: {
        type: 'barcode',
        name: 'Barcode',
        width: 200,
        height: 80,
        content: '123456789012',
        extraProps: {
          format: 'CODE128',
          displayValue: true,
        },
      },
      rating: {
        type: 'rating',
        name: 'Rating',
        width: 150,
        height: 30,
        content: '4',
        extraProps: {
          maxStars: 5,
          starColor: '#FFD700',
          emptyColor: '#E0E0E0',
        },
      },
    };

    const config = componentConfigs[componentType];
    if (!config) return;

    actions.addElement({
      ...config,
      x: 100,
      y: 100,
      style: {
        fill: 'transparent',
        stroke: 'transparent',
        strokeWidth: 0,
        opacity: 1,
      },
    });
    actions.setTool('select');
    toast.success(`${config.name} added`);
  };

  return (
    <div className="w-56 border-r bg-card/50 backdrop-blur-xl flex flex-col" data-testid="sidebar">
      <ScrollArea className="flex-1">
        <div className="py-4">
          {/* Selection Tools */}
          <SidebarSection title="Tools">
            <ToolButton
              icon={MousePointer2}
              label="Select"
              onClick={() => actions.setTool('select')}
              active={state.tool === 'select'}
              testId="tool-select"
            />
            <ToolButton
              icon={Move}
              label="Pan"
              onClick={() => actions.setTool('pan')}
              active={state.tool === 'pan'}
              testId="tool-pan"
            />
          </SidebarSection>

          <Separator className="my-2" />

          {/* Text */}
          <SidebarSection title="Text">
            <ToolButton
              icon={Type}
              label="Text"
              onClick={createTextElement}
              testId="add-text"
            />
          </SidebarSection>

          <Separator className="my-2" />

          {/* Shapes */}
          <SidebarSection title="Shapes">
            <ToolButton
              icon={Square}
              label="Rectangle"
              onClick={() => createShapeElement('rectangle')}
              testId="add-rectangle"
            />
            <ToolButton
              icon={Circle}
              label="Circle"
              onClick={() => createShapeElement('circle')}
              testId="add-circle"
            />
            <ToolButton
              icon={Minus}
              label="Line"
              onClick={() => createShapeElement('line')}
              testId="add-line"
            />
          </SidebarSection>

          <Separator className="my-2" />

          {/* Images */}
          <SidebarSection title="Images">
            <ToolButton
              icon={Image}
              label="Rect"
              onClick={() => createImageElement('rectangle')}
              testId="add-image-rect"
            />
            <ToolButton
              icon={CircleDot}
              label="Circle"
              onClick={() => createImageElement('circle')}
              testId="add-image-circle"
            />
            <ToolButton
              icon={Heart}
              label="Masked"
              onClick={() => createImageElement('masked')}
              testId="add-image-masked"
            />
            <ToolButton
              icon={ImagePlus}
              label="Static"
              onClick={() => createImageElement('static')}
              testId="add-image-static"
            />
          </SidebarSection>

          <Separator className="my-2" />

          {/* Components */}
          <SidebarSection title="Components">
            <ToolButton
              icon={QrCode}
              label="QR Code"
              onClick={() => createComponentElement('qrcode')}
              testId="add-qrcode"
            />
            <ToolButton
              icon={Barcode}
              label="Barcode"
              onClick={() => createComponentElement('barcode')}
              testId="add-barcode"
            />
            <ToolButton
              icon={Star}
              label="Rating"
              onClick={() => createComponentElement('rating')}
              testId="add-rating"
            />
          </SidebarSection>
        </div>
      </ScrollArea>
    </div>
  );
};
