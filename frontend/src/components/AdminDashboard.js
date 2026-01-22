import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { ScrollArea } from './ui/scroll-area';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from './ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import {
  Package,
  Download,
  Eye,
  Search,
  RefreshCw,
  LogOut,
  ChevronLeft,
  ChevronRight,
  CheckCircle,
  Clock,
  ShoppingCart,
  FileCheck,
} from 'lucide-react';
import { toast } from 'sonner';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;

const statusConfig = {
  pending: { label: 'Pending', color: 'bg-yellow-500/20 text-yellow-500', icon: Clock },
  added_to_cart: { label: 'In Cart', color: 'bg-blue-500/20 text-blue-500', icon: ShoppingCart },
  ordered: { label: 'Ordered', color: 'bg-purple-500/20 text-purple-500', icon: Package },
  exported: { label: 'Exported', color: 'bg-green-500/20 text-green-500', icon: FileCheck },
};

export const AdminDashboard = ({ onOpenEditor }) => {
  const { user, token, logout } = useAuth();
  const [designs, setDesigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDesign, setSelectedDesign] = useState(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [exporting, setExporting] = useState(null);

  const loadDesigns = async () => {
    setLoading(true);
    try {
      let url = `${BACKEND_URL}/api/admin/designs?page=${page}&limit=20`;
      if (statusFilter !== 'all') {
        url += `&status=${statusFilter}`;
      }

      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        setDesigns(data.designs);
        setTotalPages(data.pages);
      } else {
        toast.error('Failed to load designs');
      }
    } catch (error) {
      toast.error('Failed to load designs');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDesigns();
  }, [page, statusFilter]);

  const handleViewDetails = async (designId) => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/admin/designs/${designId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.ok) {
        const design = await response.json();
        setSelectedDesign(design);
        setDetailsOpen(true);
      }
    } catch (error) {
      toast.error('Failed to load design details');
    }
  };

  const handleExport = async (designId, format = 'png') => {
    setExporting(designId);
    try {
      const response = await fetch(`${BACKEND_URL}/api/admin/designs/${designId}/export?format=${format}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        // Pass to editor for actual export
        onOpenEditor?.(data.template, data.data_source, format, designId);
        toast.success('Design loaded for export');
        loadDesigns(); // Refresh to show updated status
      }
    } catch (error) {
      toast.error('Export failed');
    } finally {
      setExporting(null);
    }
  };

  const handleMarkExported = async (designId) => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/admin/designs/${designId}/mark-exported`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.ok) {
        toast.success('Marked as exported');
        loadDesigns();
      }
    } catch (error) {
      toast.error('Failed to update status');
    }
  };

  const filteredDesigns = designs.filter(d => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      d.product_name?.toLowerCase().includes(query) ||
      d.customer_email?.toLowerCase().includes(query) ||
      d.wc_order_id?.includes(query) ||
      d.id.includes(query)
    );
  });

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card/50 backdrop-blur-xl sticky top-0 z-50">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Package className="w-6 h-6 text-primary" />
            <h1 className="text-xl font-bold">Admin Dashboard</h1>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground">
              Welcome, <strong>{user?.username}</strong>
            </span>
            <Button variant="outline" size="sm" onClick={() => onOpenEditor?.()}>
              Open Editor
            </Button>
            <Button variant="ghost" size="sm" onClick={logout}>
              <LogOut className="w-4 h-4 mr-2" />
              Logout
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          {Object.entries(statusConfig).map(([status, config]) => {
            const count = designs.filter(d => d.status === status).length;
            const Icon = config.icon;
            return (
              <Card 
                key={status} 
                className="cursor-pointer hover:border-primary transition-colors"
                onClick={() => setStatusFilter(status)}
              >
                <CardContent className="p-4 flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-lg ${config.color} flex items-center justify-center`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{count}</p>
                    <p className="text-sm text-muted-foreground">{config.label}</p>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-4 mb-6">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search by product, email, order ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Filter status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="added_to_cart">In Cart</SelectItem>
              <SelectItem value="ordered">Ordered</SelectItem>
              <SelectItem value="exported">Exported</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" onClick={loadDesigns} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        {/* Designs Table */}
        <Card>
          <CardHeader>
            <CardTitle>Customer Designs</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Design ID</TableHead>
                  <TableHead>Product</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Order</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredDesigns.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      {loading ? 'Loading...' : 'No designs found'}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredDesigns.map((design) => {
                    const status = statusConfig[design.status] || statusConfig.pending;
                    const StatusIcon = status.icon;
                    return (
                      <TableRow key={design.id}>
                        <TableCell className="font-mono text-xs">
                          {design.id.slice(0, 8)}...
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">{design.product_name || 'N/A'}</p>
                            <p className="text-xs text-muted-foreground">ID: {design.product_id}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <p className="text-sm">{design.customer_email || 'Guest'}</p>
                        </TableCell>
                        <TableCell>
                          {design.wc_order_id ? (
                            <Badge variant="outline">#{design.wc_order_id}</Badge>
                          ) : (
                            <span className="text-muted-foreground text-sm">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge className={status.color}>
                            <StatusIcon className="w-3 h-3 mr-1" />
                            {status.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm">
                          {new Date(design.createdAt).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleViewDetails(design.id)}
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleExport(design.id, 'png')}
                              disabled={exporting === design.id}
                            >
                              <Download className={`w-4 h-4 ${exporting === design.id ? 'animate-spin' : ''}`} />
                            </Button>
                            {!design.exported && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleMarkExported(design.id)}
                              >
                                <CheckCircle className="w-4 h-4" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <span className="text-sm">
                  Page {page} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </main>

      {/* Design Details Dialog */}
      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Design Details</DialogTitle>
          </DialogHeader>
          {selectedDesign && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Design ID</p>
                  <p className="font-mono text-sm">{selectedDesign.id}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Status</p>
                  <Badge className={statusConfig[selectedDesign.status]?.color}>
                    {statusConfig[selectedDesign.status]?.label}
                  </Badge>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Product</p>
                  <p>{selectedDesign.product_name || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Order ID</p>
                  <p>{selectedDesign.wc_order_id || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Customer</p>
                  <p>{selectedDesign.customer_email || 'Guest'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Created</p>
                  <p>{new Date(selectedDesign.createdAt).toLocaleString()}</p>
                </div>
              </div>

              {selectedDesign.thumbnail_path && (
                <div>
                  <p className="text-sm text-muted-foreground mb-2">Thumbnail</p>
                  <img 
                    src={`${BACKEND_URL}/api/designs/${selectedDesign.id}/thumbnail`}
                    alt="Design thumbnail"
                    className="max-w-full h-auto rounded-lg border"
                  />
                </div>
              )}

              <div>
                <p className="text-sm text-muted-foreground mb-2">Template Data</p>
                <ScrollArea className="h-40 rounded-lg border bg-muted/50 p-3">
                  <pre className="text-xs font-mono">
                    {JSON.stringify(selectedDesign.template_data, null, 2)}
                  </pre>
                </ScrollArea>
              </div>

              <div className="flex gap-2">
                <Button onClick={() => handleExport(selectedDesign.id, 'png')}>
                  <Download className="w-4 h-4 mr-2" />
                  Export PNG
                </Button>
                <Button variant="outline" onClick={() => handleExport(selectedDesign.id, 'pdf')}>
                  Export PDF
                </Button>
                <Button variant="outline" onClick={() => handleExport(selectedDesign.id, 'svg')}>
                  Export SVG
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};
