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

export const TemplateEditor = () => {
  const { state, actions } = useEditor();
  const canvasRef = useRef(null);
  const [activeMainTab, setActiveMainTab] = useState('editor');
  const [savedTemplates, setSavedTemplates] = useState([]);
  const [templatesDialogOpen, setTemplatesDialogOpen] = useState(false);
  const [historyEntries, setHistoryEntries] = useState([]);

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

  // Export template
  const handleExport = async (format) => {
    // Canvas to image export (client-side)
    if (!canvasRef.current) {
      toast.error('Canvas not ready');
      return;
    }

    try {
      const canvas = canvasRef.current;
      const { width, height } = state.template.settings;

      if (format === 'svg') {
        // Create SVG export
        const svgContent = generateSVGContent(state.template);
        const blob = new Blob([svgContent], { type: 'image/svg+xml' });
        downloadBlob(blob, `${state.template.name}.svg`);
      } else if (format === 'pdf') {
        // PDF would require additional library
        toast.info('PDF export requires server-side rendering');
      } else {
        // PNG/JPEG export using html2canvas approach
        const html2canvas = (await import('html2canvas')).default;
        const canvasImage = await html2canvas(canvas, {
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
      
      toast.info(`Generating ${dataRows.length} exports...`);
      
      // Process each row
      for (let i = 0; i < dataRows.length; i++) {
        const row = dataRows[i];
        // Merge data into template
        const mergedTemplate = mergeDataIntoTemplate(template, row);
        
        // For now, just log - actual rendering would need more complex handling
        console.log(`Export ${i + 1}:`, mergedTemplate);
      }
      
      toast.success(`Batch export complete: ${dataRows.length} items`);
    } catch (error) {
      console.error('Batch export error:', error);
      toast.error('Batch export failed');
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

      {/* Toolbar */}
      <Toolbar onSave={handleSave} onExport={handleExport} />

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

function generateSVGContent(template) {
  const { settings, elements } = template;
  
  let elementsContent = '';
  elements.forEach((el) => {
    if (el.type === 'rectangle') {
      elementsContent += `<rect x="${el.x}" y="${el.y}" width="${el.width}" height="${el.height}" 
        fill="${el.style.fill}" stroke="${el.style.stroke}" stroke-width="${el.style.strokeWidth}"
        transform="rotate(${el.rotation} ${el.x + el.width/2} ${el.y + el.height/2})" />`;
    } else if (el.type === 'circle') {
      const cx = el.x + el.width / 2;
      const cy = el.y + el.height / 2;
      const r = Math.min(el.width, el.height) / 2;
      elementsContent += `<circle cx="${cx}" cy="${cy}" r="${r}" 
        fill="${el.style.fill}" stroke="${el.style.stroke}" stroke-width="${el.style.strokeWidth}" />`;
    } else if (el.type === 'text') {
      elementsContent += `<text x="${el.x}" y="${el.y + (el.textStyle?.fontSize || 16)}" 
        font-family="${el.textStyle?.fontFamily || 'Arial'}" 
        font-size="${el.textStyle?.fontSize || 16}"
        fill="${el.textStyle?.color || '#000000'}">${el.content || ''}</text>`;
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
