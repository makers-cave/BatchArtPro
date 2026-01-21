import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useEditor } from '../../context/EditorContext';
import { Toolbar } from './Toolbar';
import { Sidebar } from './Sidebar';
import { Canvas } from './Canvas';
import { PropertiesPanel } from './PropertiesPanel';
import { LayersPanel } from './LayersPanel';
import { DataIntegration } from './DataIntegration';
import { Tabs, TabsList, TabsTrigger } from '../ui/tabs';
import { Button } from '../ui/button';
import { ScrollArea } from '../ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import {
  Pencil,
  Database,
  History,
  FolderOpen,
  FileUp,
  Plus,
} from 'lucide-react';
import { toast } from 'sonner';
import { templatesApi, exportApi } from '../../lib/api';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { jsPDF } from 'jspdf';

export const TemplateEditor = () => {
  const { state, actions } = useEditor();
  const canvasRef = useRef(null);
  const [activeMainTab, setActiveMainTab] = useState('editor');
  const [savedTemplates, setSavedTemplates] = useState([]);
  const [templatesDialogOpen, setTemplatesDialogOpen] = useState(false);

  // Load saved templates
  const loadTemplates = useCallback(async () => {
    try {
      const response = await templatesApi.getAll();
      setSavedTemplates(response.data);
    } catch (error) {
      console.error('Failed to load templates:', error);
    }
  }, []);

  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  // Save template
  const handleSave = async () => {
    try {
      const templateData = {
        name: state.template.name,
        description: state.template.description,
        settings: state.template.settings,
        elements: state.template.elements,
      };

      if (state.template.id) {
        await templatesApi.update(state.template.id, templateData);
      } else {
        const response = await templatesApi.create(templateData);
        actions.updateTemplate({ id: response.data.id });
      }
      
      actions.resetDirty();
      loadTemplates();
    } catch (error) {
      throw error;
    }
  };

  // Helper to load image
  const loadImage = (src) => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = src;
    });
  };

  // Render template to canvas with data
  const renderTemplateToCanvas = async (template, data = {}) => {
    const { width, height, backgroundColor } = template.settings;
    
    // Create off-screen canvas
    const offCanvas = document.createElement('canvas');
    offCanvas.width = width;
    offCanvas.height = height;
    const ctx = offCanvas.getContext('2d');
    
    // Fill background
    ctx.fillStyle = backgroundColor || '#ffffff';
    ctx.fillRect(0, 0, width, height);
    
    // Sort elements by zIndex
    const sortedElements = [...template.elements].sort((a, b) => a.zIndex - b.zIndex);
    
    // Render each element
    for (const element of sortedElements) {
      if (!element.visible) continue;
      
      ctx.save();
      
      // Apply transforms
      const centerX = element.x + element.width / 2;
      const centerY = element.y + element.height / 2;
      ctx.translate(centerX, centerY);
      ctx.rotate((element.rotation || 0) * Math.PI / 180);
      ctx.translate(-centerX, -centerY);
      ctx.globalAlpha = element.style?.opacity ?? 1;
      
      // Get content with data merge
      let content = element.content || '';
      if (data && Object.keys(data).length > 0) {
        Object.keys(data).forEach((key) => {
          const pattern = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
          content = content.replace(pattern, String(data[key]));
        });
        if (element.dataField) {
          const fieldMatch = element.dataField.match(/\{\{(\w+)\}\}/);
          if (fieldMatch && data[fieldMatch[1]]) {
            content = String(data[fieldMatch[1]]);
          }
        }
      }
      
      switch (element.type) {
        case 'rectangle':
          ctx.fillStyle = element.style?.fill || '#cccccc';
          ctx.fillRect(element.x, element.y, element.width, element.height);
          if (element.style?.strokeWidth > 0) {
            ctx.strokeStyle = element.style?.stroke || '#000000';
            ctx.lineWidth = element.style.strokeWidth;
            ctx.strokeRect(element.x, element.y, element.width, element.height);
          }
          break;
          
        case 'circle':
          ctx.fillStyle = element.style?.fill || '#cccccc';
          ctx.beginPath();
          ctx.ellipse(
            element.x + element.width / 2,
            element.y + element.height / 2,
            element.width / 2,
            element.height / 2,
            0, 0, Math.PI * 2
          );
          ctx.fill();
          if (element.style?.strokeWidth > 0) {
            ctx.strokeStyle = element.style?.stroke || '#000000';
            ctx.lineWidth = element.style.strokeWidth;
            ctx.stroke();
          }
          break;
          
        case 'line':
          ctx.fillStyle = element.style?.fill || '#000000';
          ctx.fillRect(element.x, element.y, element.width, element.height);
          break;
          
        case 'image':
          // Draw image element
          if (content) {
            try {
              const img = await loadImage(content);
              const variant = element.extraProps?.variant || 'rectangle';
              const fit = element.extraProps?.fit || 'cover';
              
              // Calculate image dimensions based on fit mode
              let sx = 0, sy = 0, sw = img.width, sh = img.height;
              let dx = element.x, dy = element.y, dw = element.width, dh = element.height;
              
              if (fit === 'cover') {
                const imgRatio = img.width / img.height;
                const boxRatio = element.width / element.height;
                if (imgRatio > boxRatio) {
                  sw = img.height * boxRatio;
                  sx = (img.width - sw) / 2;
                } else {
                  sh = img.width / boxRatio;
                  sy = (img.height - sh) / 2;
                }
              }
              
              // Apply clipping for circle variant
              if (variant === 'circle') {
                ctx.beginPath();
                ctx.ellipse(
                  element.x + element.width / 2,
                  element.y + element.height / 2,
                  element.width / 2,
                  element.height / 2,
                  0, 0, Math.PI * 2
                );
                ctx.clip();
              }
              
              ctx.drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh);
            } catch (e) {
              // Draw placeholder if image fails to load
              ctx.fillStyle = element.style?.fill || '#f0f0f0';
              ctx.fillRect(element.x, element.y, element.width, element.height);
              ctx.fillStyle = '#999999';
              ctx.font = '14px Arial';
              ctx.textAlign = 'center';
              ctx.fillText('Image', element.x + element.width/2, element.y + element.height/2);
            }
          } else {
            // Draw empty placeholder
            ctx.fillStyle = element.style?.fill || '#f0f0f0';
            if (element.extraProps?.variant === 'circle') {
              ctx.beginPath();
              ctx.ellipse(
                element.x + element.width / 2,
                element.y + element.height / 2,
                element.width / 2,
                element.height / 2,
                0, 0, Math.PI * 2
              );
              ctx.fill();
            } else {
              ctx.fillRect(element.x, element.y, element.width, element.height);
            }
            if (element.style?.strokeWidth > 0) {
              ctx.strokeStyle = element.style?.stroke || '#cccccc';
              ctx.lineWidth = element.style.strokeWidth;
              ctx.strokeRect(element.x, element.y, element.width, element.height);
            }
          }
          break;
          
        case 'text':
          const fontSize = element.textStyle?.fontSize || 16;
          const fontFamily = element.textStyle?.fontFamily || 'Arial';
          const fontWeight = element.textStyle?.fontWeight || 'normal';
          const fontStyle = element.textStyle?.fontStyle || 'normal';
          ctx.font = `${fontStyle} ${fontWeight} ${fontSize}px ${fontFamily}`;
          ctx.fillStyle = element.textStyle?.color || '#000000';
          ctx.textAlign = element.textStyle?.textAlign || 'left';
          ctx.textBaseline = 'top';
          
          // Word wrap text
          const words = content.split(' ');
          let line = '';
          let y = element.y + 4;
          const lineHeight = fontSize * (element.textStyle?.lineHeight || 1.2);
          const maxWidth = element.width - 8;
          
          for (let word of words) {
            const testLine = line + word + ' ';
            const metrics = ctx.measureText(testLine);
            if (metrics.width > maxWidth && line !== '') {
              const xPos = element.textStyle?.textAlign === 'center' 
                ? element.x + element.width / 2 
                : element.textStyle?.textAlign === 'right'
                  ? element.x + element.width - 4
                  : element.x + 4;
              ctx.fillText(line.trim(), xPos, y);
              line = word + ' ';
              y += lineHeight;
            } else {
              line = testLine;
            }
          }
          const xPos = element.textStyle?.textAlign === 'center' 
            ? element.x + element.width / 2 
            : element.textStyle?.textAlign === 'right'
              ? element.x + element.width - 4
              : element.x + 4;
          ctx.fillText(line.trim(), xPos, y);
          break;
          
        case 'rating':
          const rating = parseFloat(content) || 0;
          const maxStars = element.extraProps?.maxStars || 5;
          const starSize = Math.min(element.width / maxStars, element.height) * 0.8;
          const starColor = element.extraProps?.starColor || '#FFD700';
          const emptyColor = element.extraProps?.emptyColor || '#E0E0E0';
          
          for (let i = 0; i < maxStars; i++) {
            ctx.fillStyle = i < rating ? starColor : emptyColor;
            drawStar(ctx, element.x + i * starSize + starSize/2, element.y + element.height/2, starSize/2, 5);
          }
          break;
          
        case 'qrcode':
          // Draw QR code placeholder pattern
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(element.x, element.y, element.width, element.height);
          ctx.fillStyle = '#000000';
          const cellSize = Math.min(element.width, element.height) / 25;
          for (let row = 0; row < 25; row++) {
            for (let col = 0; col < 25; col++) {
              if (Math.random() > 0.5 || (row < 7 && col < 7) || (row < 7 && col > 17) || (row > 17 && col < 7)) {
                ctx.fillRect(element.x + col * cellSize, element.y + row * cellSize, cellSize, cellSize);
              }
            }
          }
          break;
          
        case 'barcode':
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(element.x, element.y, element.width, element.height);
          ctx.fillStyle = '#000000';
          const barWidth = element.width / 60;
          for (let i = 0; i < 60; i++) {
            if (Math.random() > 0.4) {
              ctx.fillRect(element.x + i * barWidth, element.y, barWidth * 0.8, element.height * 0.75);
            }
          }
          if (element.extraProps?.displayValue) {
            ctx.font = '12px monospace';
            ctx.textAlign = 'center';
            ctx.fillText(content, element.x + element.width/2, element.y + element.height - 5);
          }
          break;
          
        default:
          break;
      }
      
      ctx.restore();
    }
    
    return offCanvas;
  };

  // Export template (single)
  const handleExport = async (format) => {
    if (!canvasRef.current) {
      toast.error('Canvas not ready');
      return;
    }

    try {
      const { width, height } = state.template.settings;
      
      if (format === 'svg') {
        const svgContent = generateSVGContent(state.template);
        const blob = new Blob([svgContent], { type: 'image/svg+xml' });
        downloadBlob(blob, `${state.template.name}.svg`);
      } else if (format === 'pdf') {
        const canvas = await renderTemplateToCanvas(state.template);
        const imgData = canvas.toDataURL('image/png');
        const pdf = new jsPDF({
          orientation: width > height ? 'landscape' : 'portrait',
          unit: 'px',
          format: [width, height]
        });
        pdf.addImage(imgData, 'PNG', 0, 0, width, height);
        pdf.save(`${state.template.name}.pdf`);
      } else {
        const html2canvas = (await import('html2canvas')).default;
        const canvasImage = await html2canvas(canvasRef.current, {
          width,
          height,
          scale: 2,
          backgroundColor: state.template.settings.backgroundColor,
        });
        
        const mimeType = format === 'jpeg' ? 'image/jpeg' : 'image/png';
        canvasImage.toBlob((blob) => {
          if (blob) {
            downloadBlob(blob, `${state.template.name}.${format}`);
          }
        }, mimeType, 0.95);
      }
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Export failed: ' + error.message);
    }
  };

  // Batch export with data
  const handleBatchExport = async (format, dataSourceId) => {
    try {
      const response = await exportApi.generate({
        templateId: state.template.id,
        format,
        dataSourceId,
      });

      const { template, dataRows } = response.data;
      
      if (!dataRows || dataRows.length === 0) {
        toast.error('No data rows to export');
        return;
      }
      
      toast.info(`Generating ${dataRows.length} exports...`);
      
      if (format === 'pdf') {
        // Create single PDF with all pages
        const { width, height } = template.settings;
        const pdf = new jsPDF({
          orientation: width > height ? 'landscape' : 'portrait',
          unit: 'px',
          format: [width, height]
        });
        
        for (let i = 0; i < dataRows.length; i++) {
          if (i > 0) {
            pdf.addPage([width, height], width > height ? 'landscape' : 'portrait');
          }
          
          const mergedTemplate = mergeDataIntoTemplate(template, dataRows[i]);
          const canvas = await renderTemplateToCanvas(mergedTemplate, dataRows[i]);
          const imgData = canvas.toDataURL('image/png');
          pdf.addImage(imgData, 'PNG', 0, 0, width, height);
          
          toast.info(`Processing page ${i + 1}/${dataRows.length}...`);
        }
        
        pdf.save(`${template.name}_batch.pdf`);
        toast.success(`PDF exported with ${dataRows.length} pages`);
      } else {
        // Create ZIP with individual files
        const zip = new JSZip();
        const mimeType = format === 'jpeg' ? 'image/jpeg' : format === 'png' ? 'image/png' : 'image/svg+xml';
        const extension = format;
        
        for (let i = 0; i < dataRows.length; i++) {
          const mergedTemplate = mergeDataIntoTemplate(template, dataRows[i]);
          
          if (format === 'svg') {
            const svgContent = generateSVGContent(mergedTemplate);
            zip.file(`${template.name}_${i + 1}.svg`, svgContent);
          } else {
            const canvas = await renderTemplateToCanvas(mergedTemplate, dataRows[i]);
            const blob = await new Promise(resolve => canvas.toBlob(resolve, mimeType, 0.95));
            zip.file(`${template.name}_${i + 1}.${extension}`, blob);
          }
          
          toast.info(`Processing ${i + 1}/${dataRows.length}...`);
        }
        
        const zipBlob = await zip.generateAsync({ type: 'blob' });
        saveAs(zipBlob, `${template.name}_batch.zip`);
        toast.success(`ZIP exported with ${dataRows.length} files`);
      }
    } catch (error) {
      console.error('Batch export error:', error);
      toast.error('Batch export failed: ' + error.message);
    }
  };

  // Load a saved template
  const handleLoadTemplate = async (templateId) => {
    try {
      const response = await templatesApi.getOne(templateId);
      actions.setTemplate(response.data);
      setTemplatesDialogOpen(false);
      toast.success('Template loaded');
    } catch (error) {
      toast.error('Failed to load template');
    }
  };

  // Create new template
  const handleNewTemplate = () => {
    actions.setTemplate({
      id: null,
      name: 'Untitled Template',
      description: '',
      settings: {
        width: 1080,
        height: 1080,
        backgroundColor: '#ffffff',
        snapToGrid: true,
        gridSize: 10,
        showGrid: true,
      },
      elements: [],
    });
    toast.info('New template created');
  };

  // Import template from file
  const handleImportTemplate = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const response = await templatesApi.import(file);
      actions.setTemplate(response.data);
      setTemplatesDialogOpen(false);
      toast.success('Template imported');
      loadTemplates();
    } catch (error) {
      toast.error('Import failed');
    }
  };

  return (
    <div className="h-screen flex flex-col overflow-hidden" data-testid="template-editor">
      {/* Main Tabs */}
      <div className="border-b bg-card/80 backdrop-blur-xl">
        <div className="flex items-center px-4">
          <Tabs value={activeMainTab} onValueChange={setActiveMainTab} className="flex-1">
            <TabsList className="bg-transparent border-0 h-12">
              <TabsTrigger 
                value="editor" 
                className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground gap-2"
                data-testid="main-tab-editor"
              >
                <Pencil className="w-4 h-4" />
                Image Editor
              </TabsTrigger>
              <TabsTrigger 
                value="data" 
                className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground gap-2"
                data-testid="main-tab-data"
              >
                <Database className="w-4 h-4" />
                Data Integration
              </TabsTrigger>
              <TabsTrigger 
                value="history" 
                className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground gap-2"
                data-testid="main-tab-history"
              >
                <History className="w-4 h-4" />
                History
              </TabsTrigger>
            </TabsList>
          </Tabs>

          {/* Templates button */}
          <Dialog open={templatesDialogOpen} onOpenChange={setTemplatesDialogOpen}>
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => setTemplatesDialogOpen(true)}
              className="gap-2"
              data-testid="templates-btn"
            >
              <FolderOpen className="w-4 h-4" />
              Templates
            </Button>
            <DialogContent className="max-w-2xl" data-testid="templates-dialog">
              <DialogHeader>
                <DialogTitle>Templates</DialogTitle>
              </DialogHeader>
              <div className="flex gap-2 mb-4">
                <Button onClick={handleNewTemplate} size="sm" data-testid="new-template-btn">
                  <Plus className="w-4 h-4 mr-1" />
                  New Template
                </Button>
                <div>
                  <input
                    type="file"
                    accept=".json"
                    onChange={handleImportTemplate}
                    className="hidden"
                    id="import-template"
                  />
                  <label htmlFor="import-template">
                    <Button variant="outline" size="sm" asChild>
                      <span>
                        <FileUp className="w-4 h-4 mr-1" />
                        Import
                      </span>
                    </Button>
                  </label>
                </div>
              </div>
              <ScrollArea className="h-[400px]">
                {savedTemplates.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No saved templates yet
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    {savedTemplates.map((template) => (
                      <div
                        key={template.id}
                        onClick={() => handleLoadTemplate(template.id)}
                        className="p-4 border rounded-lg cursor-pointer hover:border-primary transition-colors"
                        data-testid={`template-card-${template.id}`}
                      >
                        <div className="aspect-square bg-muted rounded mb-2 flex items-center justify-center text-xs text-muted-foreground">
                          {template.settings?.width}×{template.settings?.height}
                        </div>
                        <h4 className="font-semibold text-sm truncate">{template.name}</h4>
                        <p className="text-xs text-muted-foreground">
                          {template.elements?.length || 0} elements
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Toolbar - Only show for editor tab */}
      {activeMainTab === 'editor' && (
        <Toolbar onSave={handleSave} onExport={handleExport} />
      )}

      {/* Main content area */}
      <div className="flex-1 flex overflow-hidden">
        {activeMainTab === 'editor' && (
          <>
            <Sidebar />
            <Canvas canvasRef={canvasRef} />
            <LayersPanel />
            <PropertiesPanel />
          </>
        )}

        {activeMainTab === 'data' && (
          <DataIntegration onGenerateExport={handleBatchExport} />
        )}

        {activeMainTab === 'history' && (
          <div className="flex-1 p-6">
            <h2 className="text-lg font-semibold mb-4">Edit History</h2>
            <ScrollArea className="h-[calc(100vh-200px)]">
              {state.history.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No history yet. Start editing to see history.
                </div>
              ) : (
                <div className="space-y-2">
                  {state.history.map((entry, index) => (
                    <div
                      key={index}
                      className={`p-3 rounded-lg border ${
                        index === state.historyIndex 
                          ? 'border-primary bg-primary/10' 
                          : 'border-border'
                      }`}
                    >
                      <div className="font-medium text-sm">{entry.action}</div>
                      <div className="text-xs text-muted-foreground">
                        {new Date(entry.timestamp).toLocaleTimeString()}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>
        )}
      </div>
    </div>
  );
};

// Helper functions
function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function drawStar(ctx, cx, cy, r, points) {
  ctx.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const radius = i % 2 === 0 ? r : r * 0.5;
    const angle = (i * Math.PI) / points - Math.PI / 2;
    const x = cx + Math.cos(angle) * radius;
    const y = cy + Math.sin(angle) * radius;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();
}

function generateSVGContent(template) {
  const { settings, elements } = template;
  
  let elementsContent = '';
  const sortedElements = [...elements].sort((a, b) => a.zIndex - b.zIndex);
  
  sortedElements.forEach((el) => {
    if (!el.visible) return;
    
    const transform = el.rotation ? `transform="rotate(${el.rotation} ${el.x + el.width/2} ${el.y + el.height/2})"` : '';
    const opacity = el.style?.opacity !== 1 ? `opacity="${el.style.opacity}"` : '';
    
    if (el.type === 'rectangle') {
      elementsContent += `<rect x="${el.x}" y="${el.y}" width="${el.width}" height="${el.height}" 
        fill="${el.style?.fill || '#cccccc'}" stroke="${el.style?.stroke || '#000000'}" 
        stroke-width="${el.style?.strokeWidth || 0}" ${transform} ${opacity} />`;
    } else if (el.type === 'circle') {
      const cx = el.x + el.width / 2;
      const cy = el.y + el.height / 2;
      const rx = el.width / 2;
      const ry = el.height / 2;
      elementsContent += `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" 
        fill="${el.style?.fill || '#cccccc'}" stroke="${el.style?.stroke || '#000000'}" 
        stroke-width="${el.style?.strokeWidth || 0}" ${transform} ${opacity} />`;
    } else if (el.type === 'line') {
      elementsContent += `<rect x="${el.x}" y="${el.y}" width="${el.width}" height="${el.height}" 
        fill="${el.style?.fill || '#000000'}" ${transform} ${opacity} />`;
    } else if (el.type === 'text') {
      const fontSize = el.textStyle?.fontSize || 16;
      const fontFamily = el.textStyle?.fontFamily || 'Arial';
      const textAnchor = el.textStyle?.textAlign === 'center' ? 'middle' : 
                         el.textStyle?.textAlign === 'right' ? 'end' : 'start';
      const x = el.textStyle?.textAlign === 'center' ? el.x + el.width/2 : 
                el.textStyle?.textAlign === 'right' ? el.x + el.width : el.x;
      elementsContent += `<text x="${x}" y="${el.y + fontSize}" 
        font-family="${fontFamily}" font-size="${fontSize}"
        font-weight="${el.textStyle?.fontWeight || 'normal'}"
        fill="${el.textStyle?.color || '#000000'}" text-anchor="${textAnchor}"
        ${transform} ${opacity}>${el.content || ''}</text>`;
    }
  });

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${settings.width}" height="${settings.height}">
  <rect width="100%" height="100%" fill="${settings.backgroundColor}"/>
  ${elementsContent}
</svg>`;
}

function mergeDataIntoTemplate(template, data) {
  const merged = JSON.parse(JSON.stringify(template));
  
  merged.elements = merged.elements.map((el) => {
    let content = el.content || '';
    let dataField = el.dataField || '';
    
    // Replace {{field}} patterns
    Object.keys(data).forEach((key) => {
      const pattern = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
      content = content.replace(pattern, String(data[key]));
      if (dataField === `{{${key}}}`) {
        content = String(data[key]);
      }
    });
    
    return { ...el, content };
  });
  
  return merged;
}
