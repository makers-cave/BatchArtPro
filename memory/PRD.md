# Template Editor PRD

## Original Problem Statement
Build a React application as a Template Editor that allows users to design product design templates with:
- Left sidebar with design elements (Text, Shapes, Images, Components)
- Center canvas area for product design with multiple layers
- Right panel for element configuration
- Toolbar with Undo, Redo, Save, Export options
- Tabs for Image Editor, Data Integration, History
- Data integration for CSV/XLS/JSON or API data merge
- Export to PNG/SVG/PDF/JPEG

## User Personas
- **Designers**: Creating product templates and marketing graphics
- **Marketers**: Generating bulk personalized content from data
- **Developers**: Integrating template generation via API

## Core Requirements
1. ✅ Canvas-based template editor with drag/resize/rotate
2. ✅ Element types: Text, Rectangle, Circle, Line, Image, QR Code, Barcode, Rating
3. ✅ Properties panel for styling (fill, stroke, shadow, fonts)
4. ✅ Layers panel for element management
5. ✅ Undo/Redo with history
6. ✅ Data integration (File upload: CSV/JSON/Excel, API fetch)
7. ✅ Export to multiple formats (PNG, JPEG, SVG, PDF)
8. ✅ Template save/load (MongoDB cloud + local download)
9. ✅ Light/Dark theme toggle

## What's Been Implemented (Jan 2026)
- Full template editor UI with Chivo/Manrope fonts and Electric Lime accent
- Canvas with zoom/pan controls and grid overlay
- All element types with creation and properties editing
- Layers panel with visibility/lock toggles
- Properties panel with General/Fonts/Style/Shadow tabs
- Data Integration tab with file upload and API fetch
- Export dialog with format selection
- Templates dialog for save/load operations
- Theme toggle (dark by default)
- Keyboard shortcuts (Ctrl+Z, Ctrl+C, Ctrl+V, Delete, Arrow keys)

## Prioritized Backlog
### P0 (Critical)
- [x] Core editor functionality
- [x] Element CRUD operations
- [x] Template save/load

### P1 (Important)
- [ ] Actual QR code/Barcode generation (currently placeholders)
- [ ] PDF export with proper rendering
- [ ] Batch export with data merge
- [ ] Element snapping guides

### P2 (Nice to Have)
- [ ] Template sharing/collaboration
- [ ] Version history
- [ ] Custom fonts upload
- [ ] More shape types (polygon, star, arrow)

## Next Tasks
1. Integrate proper QR code library (qrcode.react)
2. Add barcode generation library (react-barcode)
3. Implement PDF export with jsPDF
4. Add element alignment/distribution tools
5. Implement proper batch export with data merge
