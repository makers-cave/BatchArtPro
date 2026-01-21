from fastapi import FastAPI, APIRouter, HTTPException, UploadFile, File, Query
from fastapi.responses import StreamingResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional, Dict, Any, Union
import uuid
from datetime import datetime, timezone
import json
import io
import base64
import pandas as pd

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app without a prefix
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# ============== Models ==============

class ElementStyle(BaseModel):
    fill: Optional[str] = "#ffffff"
    stroke: Optional[str] = "#000000"
    strokeWidth: Optional[float] = 1
    opacity: Optional[float] = 1
    shadowColor: Optional[str] = None
    shadowBlur: Optional[float] = 0
    shadowOffsetX: Optional[float] = 0
    shadowOffsetY: Optional[float] = 0

class TextStyle(BaseModel):
    fontFamily: Optional[str] = "Arial"
    fontSize: Optional[float] = 16
    fontWeight: Optional[str] = "normal"
    fontStyle: Optional[str] = "normal"
    textDecoration: Optional[str] = "none"
    textAlign: Optional[str] = "left"
    lineHeight: Optional[float] = 1.2

class TemplateElement(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    type: str  # text, rectangle, circle, line, image, qrcode, barcode, rating
    name: str
    x: float = 0
    y: float = 0
    width: float = 100
    height: float = 100
    rotation: float = 0
    scaleX: float = 1
    scaleY: float = 1
    visible: bool = True
    locked: bool = False
    zIndex: int = 0
    style: ElementStyle = Field(default_factory=ElementStyle)
    textStyle: Optional[TextStyle] = None
    content: Optional[str] = None  # For text, image URL, QR data
    dataField: Optional[str] = None  # For data binding
    extraProps: Optional[Dict[str, Any]] = None  # For element-specific properties

class TemplateSettings(BaseModel):
    width: int = 1080
    height: int = 1080
    backgroundColor: str = "#ffffff"
    snapToGrid: bool = True
    gridSize: int = 10
    showGrid: bool = True

class Template(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    description: Optional[str] = None
    settings: TemplateSettings = Field(default_factory=TemplateSettings)
    elements: List[TemplateElement] = []
    createdAt: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updatedAt: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class TemplateCreate(BaseModel):
    name: str
    description: Optional[str] = None
    settings: Optional[TemplateSettings] = None
    elements: Optional[List[TemplateElement]] = None

class TemplateUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    settings: Optional[TemplateSettings] = None
    elements: Optional[List[TemplateElement]] = None

class DataSource(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    type: str  # file, api
    config: Dict[str, Any] = {}
    data: Optional[List[Dict[str, Any]]] = None
    columns: Optional[List[str]] = None
    createdAt: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class DataSourceCreate(BaseModel):
    name: str
    type: str
    config: Optional[Dict[str, Any]] = None

class ExportRequest(BaseModel):
    templateId: str
    format: str  # png, svg, pdf, jpeg
    dataSourceId: Optional[str] = None
    rowIndices: Optional[List[int]] = None  # Which rows to export, None = all

class HistoryEntry(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    templateId: str
    action: str
    snapshot: Dict[str, Any]
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# ============== Template Endpoints ==============

@api_router.get("/")
async def root():
    return {"message": "Template Editor API"}

@api_router.post("/templates", response_model=Template)
async def create_template(input: TemplateCreate):
    template = Template(
        name=input.name,
        description=input.description,
        settings=input.settings or TemplateSettings(),
        elements=input.elements or []
    )
    doc = template.model_dump()
    doc['createdAt'] = doc['createdAt'].isoformat()
    doc['updatedAt'] = doc['updatedAt'].isoformat()
    
    await db.templates.insert_one(doc)
    return template

@api_router.get("/templates", response_model=List[Template])
async def get_templates():
    templates = await db.templates.find({}, {"_id": 0}).to_list(1000)
    for t in templates:
        if isinstance(t.get('createdAt'), str):
            t['createdAt'] = datetime.fromisoformat(t['createdAt'])
        if isinstance(t.get('updatedAt'), str):
            t['updatedAt'] = datetime.fromisoformat(t['updatedAt'])
    return templates

@api_router.get("/templates/{template_id}", response_model=Template)
async def get_template(template_id: str):
    template = await db.templates.find_one({"id": template_id}, {"_id": 0})
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    if isinstance(template.get('createdAt'), str):
        template['createdAt'] = datetime.fromisoformat(template['createdAt'])
    if isinstance(template.get('updatedAt'), str):
        template['updatedAt'] = datetime.fromisoformat(template['updatedAt'])
    return template

@api_router.put("/templates/{template_id}", response_model=Template)
async def update_template(template_id: str, input: TemplateUpdate):
    existing = await db.templates.find_one({"id": template_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Template not found")
    
    update_data = input.model_dump(exclude_unset=True)
    update_data['updatedAt'] = datetime.now(timezone.utc).isoformat()
    
    await db.templates.update_one({"id": template_id}, {"$set": update_data})
    
    updated = await db.templates.find_one({"id": template_id}, {"_id": 0})
    if isinstance(updated.get('createdAt'), str):
        updated['createdAt'] = datetime.fromisoformat(updated['createdAt'])
    if isinstance(updated.get('updatedAt'), str):
        updated['updatedAt'] = datetime.fromisoformat(updated['updatedAt'])
    return updated

@api_router.delete("/templates/{template_id}")
async def delete_template(template_id: str):
    result = await db.templates.delete_one({"id": template_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Template not found")
    return {"message": "Template deleted"}

# ============== Data Source Endpoints ==============

@api_router.post("/datasources", response_model=DataSource)
async def create_datasource(input: DataSourceCreate):
    datasource = DataSource(
        name=input.name,
        type=input.type,
        config=input.config or {}
    )
    doc = datasource.model_dump()
    doc['createdAt'] = doc['createdAt'].isoformat()
    
    await db.datasources.insert_one(doc)
    return datasource

@api_router.get("/datasources", response_model=List[DataSource])
async def get_datasources():
    datasources = await db.datasources.find({}, {"_id": 0}).to_list(1000)
    for ds in datasources:
        if isinstance(ds.get('createdAt'), str):
            ds['createdAt'] = datetime.fromisoformat(ds['createdAt'])
    return datasources

@api_router.get("/datasources/{datasource_id}", response_model=DataSource)
async def get_datasource(datasource_id: str):
    datasource = await db.datasources.find_one({"id": datasource_id}, {"_id": 0})
    if not datasource:
        raise HTTPException(status_code=404, detail="DataSource not found")
    if isinstance(datasource.get('createdAt'), str):
        datasource['createdAt'] = datetime.fromisoformat(datasource['createdAt'])
    return datasource

@api_router.delete("/datasources/{datasource_id}")
async def delete_datasource(datasource_id: str):
    result = await db.datasources.delete_one({"id": datasource_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="DataSource not found")
    return {"message": "DataSource deleted"}

@api_router.post("/datasources/upload")
async def upload_data_file(file: UploadFile = File(...)):
    """Upload CSV, JSON, or Excel file and parse it"""
    try:
        content = await file.read()
        filename = file.filename.lower()
        
        if filename.endswith('.csv'):
            df = pd.read_csv(io.BytesIO(content))
        elif filename.endswith('.json'):
            data = json.loads(content.decode('utf-8'))
            if isinstance(data, list):
                df = pd.DataFrame(data)
            else:
                df = pd.DataFrame([data])
        elif filename.endswith(('.xls', '.xlsx')):
            df = pd.read_excel(io.BytesIO(content))
        else:
            raise HTTPException(status_code=400, detail="Unsupported file format")
        
        # Convert to list of dicts
        records = df.fillna('').to_dict('records')
        columns = list(df.columns)
        
        # Create datasource
        datasource = DataSource(
            name=file.filename,
            type="file",
            config={"filename": file.filename, "format": filename.split('.')[-1]},
            data=records,
            columns=columns
        )
        
        doc = datasource.model_dump()
        doc['createdAt'] = doc['createdAt'].isoformat()
        
        await db.datasources.insert_one(doc)
        
        return {
            "id": datasource.id,
            "name": datasource.name,
            "columns": columns,
            "rowCount": len(records),
            "preview": records[:5]  # First 5 rows preview
        }
    except Exception as e:
        logger.error(f"File upload error: {e}")
        raise HTTPException(status_code=400, detail=str(e))

@api_router.post("/datasources/api")
async def fetch_api_data(config: Dict[str, Any]):
    """Fetch data from an API endpoint"""
    import requests
    
    try:
        url = config.get('url')
        method = config.get('method', 'GET').upper()
        headers = config.get('headers', {})
        body = config.get('body')
        
        if method == 'GET':
            response = requests.get(url, headers=headers, timeout=30)
        else:
            response = requests.post(url, headers=headers, json=body, timeout=30)
        
        response.raise_for_status()
        data = response.json()
        
        if isinstance(data, list):
            records = data
        elif isinstance(data, dict):
            # Try to find array in response
            for key, value in data.items():
                if isinstance(value, list) and len(value) > 0:
                    records = value
                    break
            else:
                records = [data]
        else:
            records = [{"value": data}]
        
        df = pd.DataFrame(records)
        columns = list(df.columns)
        
        datasource = DataSource(
            name=f"API: {url[:50]}",
            type="api",
            config=config,
            data=records,
            columns=columns
        )
        
        doc = datasource.model_dump()
        doc['createdAt'] = doc['createdAt'].isoformat()
        
        await db.datasources.insert_one(doc)
        
        return {
            "id": datasource.id,
            "name": datasource.name,
            "columns": columns,
            "rowCount": len(records),
            "preview": records[:5]
        }
    except Exception as e:
        logger.error(f"API fetch error: {e}")
        raise HTTPException(status_code=400, detail=str(e))

# ============== Export Endpoints ==============

@api_router.post("/export")
async def export_template(request: ExportRequest):
    """Generate export data for template (actual rendering happens on frontend)"""
    template = await db.templates.find_one({"id": request.templateId}, {"_id": 0})
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    
    data_rows = []
    if request.dataSourceId:
        datasource = await db.datasources.find_one({"id": request.dataSourceId}, {"_id": 0})
        if datasource and datasource.get('data'):
            all_data = datasource['data']
            if request.rowIndices:
                data_rows = [all_data[i] for i in request.rowIndices if i < len(all_data)]
            else:
                data_rows = all_data
    
    return {
        "template": template,
        "format": request.format,
        "dataRows": data_rows if data_rows else [{}],  # At least one empty row for single export
        "totalPages": len(data_rows) if data_rows else 1
    }

# ============== History Endpoints ==============

@api_router.post("/history")
async def save_history(templateId: str, action: str, snapshot: Dict[str, Any]):
    """Save a history entry for undo/redo"""
    entry = HistoryEntry(
        templateId=templateId,
        action=action,
        snapshot=snapshot
    )
    doc = entry.model_dump()
    doc['timestamp'] = doc['timestamp'].isoformat()
    
    await db.history.insert_one(doc)
    
    # Keep only last 50 history entries per template
    count = await db.history.count_documents({"templateId": templateId})
    if count > 50:
        oldest = await db.history.find({"templateId": templateId}).sort("timestamp", 1).limit(count - 50).to_list(count - 50)
        ids_to_delete = [h['id'] for h in oldest]
        await db.history.delete_many({"id": {"$in": ids_to_delete}})
    
    return {"id": entry.id}

@api_router.get("/history/{template_id}")
async def get_history(template_id: str, limit: int = Query(default=50, le=100)):
    """Get history entries for a template"""
    entries = await db.history.find(
        {"templateId": template_id}, 
        {"_id": 0}
    ).sort("timestamp", -1).limit(limit).to_list(limit)
    
    for e in entries:
        if isinstance(e.get('timestamp'), str):
            e['timestamp'] = datetime.fromisoformat(e['timestamp'])
    
    return entries

@api_router.delete("/history/{template_id}")
async def clear_history(template_id: str):
    """Clear all history for a template"""
    await db.history.delete_many({"templateId": template_id})
    return {"message": "History cleared"}

# ============== Template Download/Import ==============

@api_router.get("/templates/{template_id}/download")
async def download_template(template_id: str):
    """Download template as JSON file"""
    template = await db.templates.find_one({"id": template_id}, {"_id": 0})
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    
    # Convert datetime to string for JSON
    if isinstance(template.get('createdAt'), datetime):
        template['createdAt'] = template['createdAt'].isoformat()
    if isinstance(template.get('updatedAt'), datetime):
        template['updatedAt'] = template['updatedAt'].isoformat()
    
    json_str = json.dumps(template, indent=2)
    
    return StreamingResponse(
        io.BytesIO(json_str.encode()),
        media_type="application/json",
        headers={"Content-Disposition": f"attachment; filename={template['name']}.json"}
    )

@api_router.post("/templates/import")
async def import_template(file: UploadFile = File(...)):
    """Import a template from JSON file"""
    try:
        content = await file.read()
        template_data = json.loads(content.decode('utf-8'))
        
        # Generate new ID and timestamps
        template_data['id'] = str(uuid.uuid4())
        template_data['createdAt'] = datetime.now(timezone.utc).isoformat()
        template_data['updatedAt'] = datetime.now(timezone.utc).isoformat()
        
        await db.templates.insert_one(template_data)
        
        if isinstance(template_data.get('createdAt'), str):
            template_data['createdAt'] = datetime.fromisoformat(template_data['createdAt'])
        if isinstance(template_data.get('updatedAt'), str):
            template_data['updatedAt'] = datetime.fromisoformat(template_data['updatedAt'])
        
        return template_data
    except Exception as e:
        logger.error(f"Import error: {e}")
        raise HTTPException(status_code=400, detail=str(e))

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
