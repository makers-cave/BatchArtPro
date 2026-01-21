import React, { useState, useCallback } from 'react';
import { useEditor } from '../../context/EditorContext';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { ScrollArea } from '../ui/scroll-area';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../ui/dialog';
import {
  FileUp,
  Globe,
  Trash2,
  Database,
  Eye,
  Download,
  Play,
  RefreshCw,
} from 'lucide-react';
import { toast } from 'sonner';
import { dataSourcesApi, exportApi } from '../../lib/api';

export const DataIntegration = ({ onGenerateExport }) => {
  const { state, actions } = useEditor();
  const [activeTab, setActiveTab] = useState('file');
  const [isLoading, setIsLoading] = useState(false);
  const [previewData, setPreviewData] = useState(null);
  const [previewDialogOpen, setPreviewDialogOpen] = useState(false);
  
  // API form state
  const [apiUrl, setApiUrl] = useState('');
  const [apiMethod, setApiMethod] = useState('GET');
  const [apiHeaders, setApiHeaders] = useState('{}');

  // Handle file upload
  const handleFileUpload = useCallback(async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const validExtensions = ['.csv', '.json', '.xls', '.xlsx'];
    const ext = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));
    
    if (!validExtensions.includes(ext)) {
      toast.error('Please upload a CSV, JSON, or Excel file');
      return;
    }

    setIsLoading(true);
    try {
      const response = await dataSourcesApi.uploadFile(file);
      const data = response.data;
      
      actions.setDataSource({
        id: data.id,
        name: data.name,
        columns: data.columns,
        rowCount: data.rowCount,
        preview: data.preview,
      });
      
      setPreviewData(data);
      toast.success(`Loaded ${data.rowCount} rows from ${file.name}`);
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('Failed to load file: ' + (error.response?.data?.detail || error.message));
    } finally {
      setIsLoading(false);
    }
  }, [actions]);

  // Handle API fetch
  const handleApiFetch = async () => {
    if (!apiUrl) {
      toast.error('Please enter an API URL');
      return;
    }

    setIsLoading(true);
    try {
      let headers = {};
      try {
        headers = JSON.parse(apiHeaders);
      } catch (e) {
        // Ignore parse errors, use empty headers
      }

      const response = await dataSourcesApi.fetchApi({
        url: apiUrl,
        method: apiMethod,
        headers,
      });
      
      const data = response.data;
      
      actions.setDataSource({
        id: data.id,
        name: data.name,
        columns: data.columns,
        rowCount: data.rowCount,
        preview: data.preview,
      });
      
      setPreviewData(data);
      toast.success(`Loaded ${data.rowCount} rows from API`);
    } catch (error) {
      console.error('API fetch error:', error);
      toast.error('Failed to fetch API: ' + (error.response?.data?.detail || error.message));
    } finally {
      setIsLoading(false);
    }
  };

  // Clear data source
  const handleClearData = () => {
    actions.setDataSource(null);
    setPreviewData(null);
    toast.info('Data source cleared');
  };

  // Generate exports
  const handleGenerateExport = async (format) => {
    if (!state.dataSource) {
      toast.error('Please load a data source first');
      return;
    }

    try {
      await onGenerateExport?.(format, state.dataSource.id);
    } catch (error) {
      toast.error('Export failed');
    }
  };

  return (
    <div className="flex-1 flex flex-col bg-card/50 backdrop-blur-xl" data-testid="data-integration-panel">
      <div className="p-4 border-b">
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Database className="w-5 h-5" />
          Data Integration
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Import data from files or APIs to merge with your template
        </p>
      </div>

      <div className="flex-1 p-4">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-4">
            <TabsTrigger value="file" className="gap-2" data-testid="data-tab-file">
              <FileUp className="w-4 h-4" />
              File Upload
            </TabsTrigger>
            <TabsTrigger value="api" className="gap-2" data-testid="data-tab-api">
              <Globe className="w-4 h-4" />
              API
            </TabsTrigger>
          </TabsList>

          <TabsContent value="file" className="space-y-4">
            <div className="border-2 border-dashed rounded-lg p-8 text-center">
              <FileUp className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-sm text-muted-foreground mb-4">
                Drag and drop or click to upload<br />
                Supports CSV, JSON, XLS, XLSX
              </p>
              <Input
                type="file"
                accept=".csv,.json,.xls,.xlsx"
                onChange={handleFileUpload}
                className="hidden"
                id="file-upload"
                data-testid="file-upload-input"
              />
              <Label htmlFor="file-upload">
                <Button variant="outline" asChild disabled={isLoading}>
                  <span>{isLoading ? 'Loading...' : 'Choose File'}</span>
                </Button>
              </Label>
            </div>
          </TabsContent>

          <TabsContent value="api" className="space-y-4">
            <div className="space-y-3">
              <div>
                <Label className="text-xs">API URL</Label>
                <Input
                  value={apiUrl}
                  onChange={(e) => setApiUrl(e.target.value)}
                  placeholder="https://api.example.com/data"
                  className="mt-1"
                  data-testid="api-url-input"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Method</Label>
                  <select
                    value={apiMethod}
                    onChange={(e) => setApiMethod(e.target.value)}
                    className="w-full h-9 rounded-md border bg-background px-3 text-sm mt-1"
                    data-testid="api-method-select"
                  >
                    <option value="GET">GET</option>
                    <option value="POST">POST</option>
                  </select>
                </div>
                <div>
                  <Label className="text-xs">Headers (JSON)</Label>
                  <Input
                    value={apiHeaders}
                    onChange={(e) => setApiHeaders(e.target.value)}
                    placeholder='{"Authorization": "Bearer ..."}'
                    className="mt-1 font-mono text-xs"
                    data-testid="api-headers-input"
                  />
                </div>
              </div>
              <Button 
                onClick={handleApiFetch} 
                disabled={isLoading}
                className="w-full"
                data-testid="fetch-api-btn"
              >
                {isLoading ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    Fetching...
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 mr-2" />
                    Fetch Data
                  </>
                )}
              </Button>
            </div>
          </TabsContent>
        </Tabs>

        {/* Current Data Source */}
        {state.dataSource && (
          <div className="mt-6 p-4 rounded-lg border bg-background">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="font-semibold text-sm">{state.dataSource.name}</h3>
                <p className="text-xs text-muted-foreground">
                  {state.dataSource.rowCount} rows • {state.dataSource.columns?.length} columns
                </p>
              </div>
              <div className="flex gap-2">
                <Dialog open={previewDialogOpen} onOpenChange={setPreviewDialogOpen}>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm" data-testid="preview-data-btn">
                      <Eye className="w-4 h-4 mr-1" />
                      Preview
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-4xl max-h-[80vh]" data-testid="data-preview-dialog">
                    <DialogHeader>
                      <DialogTitle>Data Preview</DialogTitle>
                    </DialogHeader>
                    <ScrollArea className="h-[60vh]">
                      {previewData?.preview && (
                        <Table>
                          <TableHeader>
                            <TableRow>
                              {previewData.columns.map((col) => (
                                <TableHead key={col} className="font-mono text-xs">
                                  {col}
                                </TableHead>
                              ))}
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {previewData.preview.map((row, i) => (
                              <TableRow key={i}>
                                {previewData.columns.map((col) => (
                                  <TableCell key={col} className="text-xs">
                                    {String(row[col] ?? '')}
                                  </TableCell>
                                ))}
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      )}
                    </ScrollArea>
                  </DialogContent>
                </Dialog>
                <Button 
                  variant="destructive" 
                  size="sm"
                  onClick={handleClearData}
                  data-testid="clear-data-btn"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* Available columns */}
            <div className="mt-3">
              <Label className="text-xs text-muted-foreground">Available Fields</Label>
              <div className="flex flex-wrap gap-1 mt-1">
                {state.dataSource.columns?.map((col) => (
                  <span
                    key={col}
                    className="px-2 py-0.5 text-xs bg-primary/10 text-primary rounded-full font-mono cursor-pointer hover:bg-primary/20"
                    onClick={() => {
                      navigator.clipboard.writeText(`{{${col}}}`);
                      toast.info(`Copied {{${col}}} to clipboard`);
                    }}
                    title="Click to copy"
                  >
                    {`{{${col}}}`}
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Export section */}
        {state.dataSource && (
          <div className="mt-6 p-4 rounded-lg border bg-background">
            <h3 className="font-semibold text-sm mb-3">Generate Batch Export</h3>
            <p className="text-xs text-muted-foreground mb-3">
              Generate one output for each row in your data
            </p>
            <div className="grid grid-cols-4 gap-2">
              {['PNG', 'JPEG', 'SVG', 'PDF'].map((format) => (
                <Button
                  key={format}
                  variant="outline"
                  size="sm"
                  onClick={() => handleGenerateExport(format.toLowerCase())}
                  data-testid={`batch-export-${format.toLowerCase()}`}
                >
                  <Download className="w-4 h-4 mr-1" />
                  {format}
                </Button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
