import React, { useState } from 'react';
import { useEditor } from '../../context/EditorContext';
import { useTheme } from '../../context/ThemeContext';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Checkbox } from '../ui/checkbox';
import { Label } from '../ui/label';
import {
  Undo2,
  Redo2,
  Save,
  Download,
  Sun,
  Moon,
  FileDown,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../ui/dialog';
import { toast } from 'sonner';
import { templatesApi } from '../../lib/api';

export const Toolbar = ({ onSave, onExport }) => {
  const { state, actions } = useEditor();
  const { theme, toggleTheme } = useTheme();
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [exportFormat, setExportFormat] = useState('png');
  const [isExporting, setIsExporting] = useState(false);

  const canUndo = state.historyIndex > 0;
  const canRedo = state.historyIndex < state.history.length - 1;

  const handleUndo = () => {
    if (canUndo) {
      actions.undo();
      toast.info('Undone');
    }
  };

  const handleRedo = () => {
    if (canRedo) {
      actions.redo();
      toast.info('Redone');
    }
  };

  const handleSave = async () => {
    try {
      await onSave?.();
      toast.success('Template saved');
    } catch (error) {
      toast.error('Failed to save template');
    }
  };

  const handleExport = async () => {
    setIsExporting(true);
    try {
      await onExport?.(exportFormat);
      setExportDialogOpen(false);
      toast.success(`Exported as ${exportFormat.toUpperCase()}`);
    } catch (error) {
      toast.error('Export failed');
    } finally {
      setIsExporting(false);
    }
  };

  const handleDownloadTemplate = async () => {
    if (!state.template.id) {
      // Download current state as JSON
      const blob = new Blob([JSON.stringify(state.template, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${state.template.name || 'template'}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Template downloaded');
      return;
    }

    try {
      const response = await templatesApi.download(state.template.id);
      const blob = new Blob([response.data], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${state.template.name || 'template'}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Template downloaded');
    } catch (error) {
      toast.error('Download failed');
    }
  };

  const formatOptions = [
    { value: 'png', label: 'PNG', description: 'High quality raster image' },
    { value: 'jpeg', label: 'JPEG', description: 'Compressed raster image' },
    { value: 'svg', label: 'SVG', description: 'Scalable vector graphics' },
    { value: 'pdf', label: 'PDF', description: 'Print-ready document' },
  ];

  return (
    <div className="h-12 border-b bg-card/50 backdrop-blur-xl flex items-center justify-between px-4" data-testid="toolbar">
      {/* Left section - Actions */}
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleUndo}
          disabled={!canUndo}
          className="h-8 px-2"
          data-testid="undo-btn"
        >
          <Undo2 className="w-4 h-4 mr-1" />
          Undo
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleRedo}
          disabled={!canRedo}
          className="h-8 px-2"
          data-testid="redo-btn"
        >
          <Redo2 className="w-4 h-4 mr-1" />
          Redo
        </Button>
        <div className="w-px h-6 bg-border mx-2" />
        <Button
          variant="default"
          size="sm"
          onClick={handleSave}
          className="h-8 px-3"
          data-testid="save-btn"
        >
          <Save className="w-4 h-4 mr-1" />
          Save
        </Button>
        <Dialog open={exportDialogOpen} onOpenChange={setExportDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm" className="h-8 px-3" data-testid="export-btn">
              <Download className="w-4 h-4 mr-1" />
              Export
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md" data-testid="export-dialog">
            <DialogHeader>
              <DialogTitle className="font-heading">Export Template</DialogTitle>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-3 mt-4">
              {formatOptions.map((format) => (
                <div
                  key={format.value}
                  onClick={() => setExportFormat(format.value)}
                  className={`p-4 rounded-lg border cursor-pointer transition-all ${
                    exportFormat === format.value
                      ? 'border-primary bg-primary/10 shadow-[0_0_15px_-3px_rgba(163,230,53,0.3)]'
                      : 'border-border hover:border-primary/50'
                  }`}
                  data-testid={`export-format-${format.value}`}
                >
                  <div className="font-semibold">{format.label}</div>
                  <div className="text-xs text-muted-foreground mt-1">{format.description}</div>
                </div>
              ))}
            </div>
            <Button
              onClick={handleExport}
              disabled={isExporting}
              className="w-full mt-4"
              data-testid="export-confirm-btn"
            >
              {isExporting ? 'Exporting...' : `Export as ${exportFormat.toUpperCase()}`}
            </Button>
          </DialogContent>
        </Dialog>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleDownloadTemplate}
          className="h-8 px-2"
          data-testid="download-template-btn"
        >
          <FileDown className="w-4 h-4" />
        </Button>
      </div>

      {/* Center section - Template info */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <Checkbox
            id="snap"
            checked={state.template.settings.snapToGrid}
            onCheckedChange={(checked) => 
              actions.updateTemplate({ 
                settings: { ...state.template.settings, snapToGrid: checked } 
              })
            }
            data-testid="snap-checkbox"
          />
          <Label htmlFor="snap" className="text-sm">Snap</Label>
        </div>
        <div className="flex items-center gap-2">
          <Label className="text-sm text-muted-foreground">Name</Label>
          <Input
            value={state.template.name}
            onChange={(e) => actions.updateTemplate({ name: e.target.value })}
            className="h-8 w-40 text-sm"
            data-testid="template-name-input"
          />
        </div>
        <div className="flex items-center gap-2 font-mono text-xs text-muted-foreground">
          <span>W</span>
          <Input
            type="number"
            value={state.template.settings.width}
            onChange={(e) => 
              actions.updateTemplate({ 
                settings: { ...state.template.settings, width: parseInt(e.target.value) || 1080 } 
              })
            }
            className="h-8 w-20 text-xs"
            data-testid="canvas-width-input"
          />
          <span>H</span>
          <Input
            type="number"
            value={state.template.settings.height}
            onChange={(e) => 
              actions.updateTemplate({ 
                settings: { ...state.template.settings, height: parseInt(e.target.value) || 1080 } 
              })
            }
            className="h-8 w-20 text-xs"
            data-testid="canvas-height-input"
          />
        </div>
      </div>

      {/* Right section - Theme toggle */}
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={toggleTheme}
          className="h-8 w-8 p-0"
          data-testid="theme-toggle-btn"
        >
          {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </Button>
      </div>
    </div>
  );
};
