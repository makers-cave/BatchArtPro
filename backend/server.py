from fastapi import FastAPI, APIRouter, HTTPException, UploadFile, File, Query, Depends, Header, Request, Response, Cookie
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
from datetime import datetime, timezone, timedelta
import json
import io
import base64
import pandas as pd
import hashlib
import hmac
import httpx

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

# Emergent OAuth Configuration
EMERGENT_AUTH_URL = "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data"
SESSION_EXPIRY_DAYS = 7

# WooCommerce Configuration
WOOCOMMERCE_URL = os.environ.get('WOOCOMMERCE_URL', '')
WOOCOMMERCE_CONSUMER_KEY = os.environ.get('WOOCOMMERCE_CONSUMER_KEY', '')
WOOCOMMERCE_CONSUMER_SECRET = os.environ.get('WOOCOMMERCE_CONSUMER_SECRET', '')
WOOCOMMERCE_WEBHOOK_SECRET = os.environ.get('WOOCOMMERCE_WEBHOOK_SECRET', '')

# Upload directory for design files
UPLOAD_DIR = ROOT_DIR / 'uploads'
UPLOAD_DIR.mkdir(exist_ok=True)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# ============== Auth Models (Emergent Google OAuth) ==============

class User(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    user_id: str = Field(default_factory=lambda: f"user_{uuid.uuid4().hex[:12]}")
    email: str
    name: str
    picture: Optional[str] = None
    role: str = "admin"  # admin or customer
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class UserSession(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    user_id: str
    session_token: str
    expires_at: datetime
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class SessionRequest(BaseModel):
    session_id: str

# ============== WooCommerce Integration Models ==============

class WooCommerceSession(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    session_token: str
    product_id: str
    product_name: Optional[str] = None
    template_size: Optional[Dict[str, int]] = None  # {width, height}
    card_id: Optional[str] = None
    customer_id: Optional[str] = None
    customer_email: Optional[str] = None
    wc_cart_key: Optional[str] = None
    return_url: Optional[str] = None
    createdAt: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    expiresAt: datetime = Field(default_factory=lambda: datetime.now(timezone.utc) + timedelta(hours=24))

class WooSessionCreate(BaseModel):
    product_id: str
    product_name: Optional[str] = None
    template_width: Optional[int] = 1080
    template_height: Optional[int] = 1080
    card_id: Optional[str] = None
    customer_id: Optional[str] = None
    customer_email: Optional[str] = None
    return_url: Optional[str] = None

class CustomerDesign(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    session_id: str
    product_id: str
    product_name: Optional[str] = None
    customer_id: Optional[str] = None
    customer_email: Optional[str] = None
    template_data: Dict[str, Any]  # Full template JSON
    data_source: Optional[Dict[str, Any]] = None  # Data integration if any
    thumbnail_path: Optional[str] = None
    thumbnail_base64: Optional[str] = None
    status: str = "pending"  # pending, added_to_cart, ordered, exported
    wc_order_id: Optional[str] = None
    wc_order_item_id: Optional[str] = None
    exported: bool = False
    exportedAt: Optional[datetime] = None
    exportedBy: Optional[str] = None
    createdAt: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updatedAt: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class AddToCartRequest(BaseModel):
    session_token: str
    template_data: Dict[str, Any]
    data_source: Optional[Dict[str, Any]] = None
    thumbnail_base64: Optional[str] = None

# ============== Element Models ==============

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
    type: str
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
    content: Optional[str] = None
    dataField: Optional[str] = None
    extraProps: Optional[Dict[str, Any]] = None

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
    type: str
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
    format: str
    dataSourceId: Optional[str] = None
    rowIndices: Optional[List[int]] = None

class HistoryEntry(BaseModel):
    model_config = ConfigDict(extra="ignore")
    
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    templateId: str
    action: str
    snapshot: Dict[str, Any]
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# ============== Auth Helper Functions (Emergent Google OAuth) ==============

async def get_session_token_from_request(
    request: Request,
    session_token: Optional[str] = Cookie(None),
    authorization: Optional[str] = Header(None)
) -> Optional[str]:
    """Extract session token from cookie or Authorization header"""
    # First try cookie
    if session_token:
        return session_token
    
    # Then try Authorization header as fallback
    if authorization and authorization.startswith("Bearer "):
        return authorization[7:]
    
    return None

async def get_current_user(
    request: Request,
    session_token: Optional[str] = Cookie(None),
    authorization: Optional[str] = Header(None)
) -> Optional[Dict[str, Any]]:
    """Get current user from session token (cookie or header)"""
    token = await get_session_token_from_request(request, session_token, authorization)
    
    if not token:
        return None
    
    # Find session in database
    session_doc = await db.user_sessions.find_one({"session_token": token}, {"_id": 0})
    if not session_doc:
        return None
    
    # Check expiration (handle timezone)
    expires_at = session_doc["expires_at"]
    if isinstance(expires_at, str):
        expires_at = datetime.fromisoformat(expires_at)
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at < datetime.now(timezone.utc):
        return None
    
    # Get user
    user_doc = await db.users.find_one({"user_id": session_doc["user_id"]}, {"_id": 0})
    return user_doc

async def require_admin(
    request: Request,
    session_token: Optional[str] = Cookie(None),
    authorization: Optional[str] = Header(None)
) -> Dict[str, Any]:
    """Require admin authentication"""
    user = await get_current_user(request, session_token, authorization)
    
    if not user:
        raise HTTPException(status_code=401, detail="Authentication required")
    
    if user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    return user

# ============== Auth Endpoints (Emergent Google OAuth) ==============

@api_router.post("/auth/session")
async def process_session(input: SessionRequest, response: Response):
    """
    Process session_id from Emergent Auth to get user data and create session.
    Called after Google OAuth redirect with session_id in URL fragment.
    """
    try:
        # Call Emergent Auth API to get user data
        async with httpx.AsyncClient() as client_http:
            auth_response = await client_http.get(
                EMERGENT_AUTH_URL,
                headers={"X-Session-ID": input.session_id},
                timeout=30.0
            )
        
        if auth_response.status_code != 200:
            raise HTTPException(status_code=401, detail="Invalid session ID")
        
        auth_data = auth_response.json()
        email = auth_data.get("email")
        name = auth_data.get("name")
        picture = auth_data.get("picture")
        session_token = auth_data.get("session_token")
        
        if not email or not session_token:
            raise HTTPException(status_code=400, detail="Invalid auth response")
        
        # Check if user exists by email
        existing_user = await db.users.find_one({"email": email}, {"_id": 0})
        
        if existing_user:
            # Update existing user if needed
            user_id = existing_user["user_id"]
            await db.users.update_one(
                {"user_id": user_id},
                {"$set": {
                    "name": name,
                    "picture": picture,
                    "updated_at": datetime.now(timezone.utc).isoformat()
                }}
            )
        else:
            # Create new user
            user_id = f"user_{uuid.uuid4().hex[:12]}"
            new_user = {
                "user_id": user_id,
                "email": email,
                "name": name,
                "picture": picture,
                "role": "admin",  # First user or default role
                "created_at": datetime.now(timezone.utc).isoformat(),
                "updated_at": datetime.now(timezone.utc).isoformat()
            }
            await db.users.insert_one(new_user)
        
        # Create session
        expires_at = datetime.now(timezone.utc) + timedelta(days=SESSION_EXPIRY_DAYS)
        session_doc = {
            "user_id": user_id,
            "session_token": session_token,
            "expires_at": expires_at.isoformat(),
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        
        # Remove any existing sessions for this user
        await db.user_sessions.delete_many({"user_id": user_id})
        await db.user_sessions.insert_one(session_doc)
        
        # Set httpOnly cookie
        response.set_cookie(
            key="session_token",
            value=session_token,
            httponly=True,
            secure=True,
            samesite="none",
            max_age=SESSION_EXPIRY_DAYS * 24 * 60 * 60,
            path="/"
        )
        
        # Get updated user data
        user_doc = await db.users.find_one({"user_id": user_id}, {"_id": 0})
        
        return {
            "success": True,
            "user": user_doc
        }
        
    except httpx.RequestError as e:
        logger.error(f"Auth request failed: {e}")
        raise HTTPException(status_code=500, detail="Authentication service unavailable")

@api_router.get("/auth/me")
async def get_current_user_info(
    request: Request,
    session_token: Optional[str] = Cookie(None),
    authorization: Optional[str] = Header(None)
):
    """Get current user info - validates session and returns user data"""
    user = await get_current_user(request, session_token, authorization)
    
    if not user:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    return user

@api_router.post("/auth/logout")
async def logout(
    response: Response,
    request: Request,
    session_token: Optional[str] = Cookie(None),
    authorization: Optional[str] = Header(None)
):
    """Logout - delete session and clear cookie"""
    token = await get_session_token_from_request(request, session_token, authorization)
    
    if token:
        # Delete session from database
        await db.user_sessions.delete_many({"session_token": token})
    
    # Clear cookie
    response.delete_cookie(
        key="session_token",
        path="/",
        secure=True,
        samesite="none"
    )
    
    return {"success": True, "message": "Logged out"}

# ============== WooCommerce Integration Endpoints ==============

@api_router.post("/woocommerce/create-session")
async def create_woocommerce_session(input: WooSessionCreate):
    """Create a new editing session from WooCommerce"""
    session_token = str(uuid.uuid4())
    
    session = WooCommerceSession(
        session_token=session_token,
        product_id=input.product_id,
        product_name=input.product_name,
        template_size={"width": input.template_width, "height": input.template_height},
        card_id=input.card_id,
        customer_id=input.customer_id,
        customer_email=input.customer_email,
        return_url=input.return_url
    )
    
    doc = session.model_dump()
    doc['createdAt'] = doc['createdAt'].isoformat()
    doc['expiresAt'] = doc['expiresAt'].isoformat()
    
    await db.wc_sessions.insert_one(doc)
    
    return {
        "session_token": session_token,
        "session_id": session.id,
        "editor_url": f"/editor?session={session_token}",
        "expires_at": session.expiresAt.isoformat()
    }

@api_router.get("/woocommerce/session/{session_token}")
async def get_woocommerce_session(session_token: str):
    """Get session details by token"""
    session = await db.wc_sessions.find_one({"session_token": session_token}, {"_id": 0})
    if not session:
        raise HTTPException(status_code=404, detail="Session not found or expired")
    
    # Check expiration
    expires_at = datetime.fromisoformat(session['expiresAt']) if isinstance(session['expiresAt'], str) else session['expiresAt']
    if expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=410, detail="Session expired")
    
    return session

@api_router.post("/woocommerce/add-to-cart")
async def add_to_cart(input: AddToCartRequest):
    """Save design and add to WooCommerce cart"""
    # Get session
    session = await db.wc_sessions.find_one({"session_token": input.session_token}, {"_id": 0})
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    # Check expiration
    expires_at = datetime.fromisoformat(session['expiresAt']) if isinstance(session['expiresAt'], str) else session['expiresAt']
    if expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=410, detail="Session expired")
    
    # Save thumbnail if provided
    thumbnail_path = None
    if input.thumbnail_base64:
        try:
            # Decode and save thumbnail
            img_data = base64.b64decode(input.thumbnail_base64.split(',')[1] if ',' in input.thumbnail_base64 else input.thumbnail_base64)
            thumbnail_filename = f"{session['id']}_{uuid.uuid4()}.png"
            thumbnail_path = str(UPLOAD_DIR / thumbnail_filename)
            with open(thumbnail_path, 'wb') as f:
                f.write(img_data)
        except Exception as e:
            logger.error(f"Failed to save thumbnail: {e}")
    
    # Create customer design record
    design = CustomerDesign(
        session_id=session['id'],
        product_id=session['product_id'],
        product_name=session.get('product_name'),
        customer_id=session.get('customer_id'),
        customer_email=session.get('customer_email'),
        template_data=input.template_data,
        data_source=input.data_source,
        thumbnail_path=thumbnail_path,
        thumbnail_base64=input.thumbnail_base64[:100] + "..." if input.thumbnail_base64 and len(input.thumbnail_base64) > 100 else input.thumbnail_base64,
        status="added_to_cart"
    )
    
    doc = design.model_dump()
    doc['createdAt'] = doc['createdAt'].isoformat()
    doc['updatedAt'] = doc['updatedAt'].isoformat()
    
    await db.customer_designs.insert_one(doc)
    
    # Call WooCommerce API to add to cart (if configured)
    wc_response = None
    if WOOCOMMERCE_URL and WOOCOMMERCE_CONSUMER_KEY:
        try:
            import requests
            wc_response = requests.post(
                f"{WOOCOMMERCE_URL}/wp-json/wc/store/v1/cart/add-item",
                json={
                    "id": int(session['product_id']),
                    "quantity": 1,
                    "meta_data": [
                        {"key": "design_id", "value": design.id},
                        {"key": "customized", "value": "yes"}
                    ]
                },
                headers={
                    "Content-Type": "application/json"
                },
                auth=(WOOCOMMERCE_CONSUMER_KEY, WOOCOMMERCE_CONSUMER_SECRET),
                timeout=30
            )
            wc_response = wc_response.json()
        except Exception as e:
            logger.error(f"WooCommerce API error: {e}")
    
    return {
        "success": True,
        "design_id": design.id,
        "message": "Design saved and added to cart",
        "thumbnail_url": f"/api/designs/{design.id}/thumbnail" if thumbnail_path else None,
        "return_url": session.get('return_url'),
        "woocommerce_response": wc_response
    }

@api_router.post("/woocommerce/webhook/order-created")
async def handle_order_created(
    payload: Dict[str, Any],
    x_wc_webhook_signature: Optional[str] = Header(None)
):
    """Handle WooCommerce order created webhook"""
    # Verify webhook signature if secret is configured
    if WOOCOMMERCE_WEBHOOK_SECRET and x_wc_webhook_signature:
        # WooCommerce uses HMAC-SHA256
        expected_sig = base64.b64encode(
            hmac.new(
                WOOCOMMERCE_WEBHOOK_SECRET.encode(),
                json.dumps(payload).encode(),
                hashlib.sha256
            ).digest()
        ).decode()
        
        if not hmac.compare_digest(expected_sig, x_wc_webhook_signature):
            raise HTTPException(status_code=401, detail="Invalid webhook signature")
    
    # Extract order info
    order_id = payload.get('id')
    line_items = payload.get('line_items', [])
    
    # Update customer designs with order ID
    for item in line_items:
        meta_data = item.get('meta_data', [])
        for meta in meta_data:
            if meta.get('key') == 'design_id':
                design_id = meta.get('value')
                await db.customer_designs.update_one(
                    {"id": design_id},
                    {
                        "$set": {
                            "status": "ordered",
                            "wc_order_id": str(order_id),
                            "wc_order_item_id": str(item.get('id')),
                            "updatedAt": datetime.now(timezone.utc).isoformat()
                        }
                    }
                )
    
    return {"status": "ok"}

# ============== Admin Design Management Endpoints ==============

@api_router.get("/admin/designs")
async def get_all_designs(
    status: Optional[str] = None,
    page: int = Query(default=1, ge=1),
    limit: int = Query(default=20, le=100),
    request: Request = None,
    session_token: Optional[str] = Cookie(None),
    authorization: Optional[str] = Header(None)
):
    """Get all customer designs (admin only)"""
    user = await require_admin(request, session_token, authorization)
    query = {}
    if status:
        query["status"] = status
    
    skip = (page - 1) * limit
    
    designs = await db.customer_designs.find(query, {"_id": 0}).sort("createdAt", -1).skip(skip).limit(limit).to_list(limit)
    total = await db.customer_designs.count_documents(query)
    
    return {
        "designs": designs,
        "total": total,
        "page": page,
        "limit": limit,
        "pages": (total + limit - 1) // limit
    }

@api_router.get("/admin/designs/{design_id}")
async def get_design_detail(
    design_id: str,
    request: Request = None,
    session_token: Optional[str] = Cookie(None),
    authorization: Optional[str] = Header(None)
):
    """Get design details (admin only)"""
    user = await require_admin(request, session_token, authorization)
    design = await db.customer_designs.find_one({"id": design_id}, {"_id": 0})
    if not design:
        raise HTTPException(status_code=404, detail="Design not found")
    return design

@api_router.get("/admin/designs/{design_id}/export")
async def export_design(
    design_id: str,
    format: str = Query(default="png"),
    request: Request = None,
    session_token: Optional[str] = Cookie(None),
    authorization: Optional[str] = Header(None)
):
    """Export a customer design (admin only)"""
    user = await require_admin(request, session_token, authorization)
    design = await db.customer_designs.find_one({"id": design_id}, {"_id": 0})
    if not design:
        raise HTTPException(status_code=404, detail="Design not found")
    
    # Mark as exported
    await db.customer_designs.update_one(
        {"id": design_id},
        {
            "$set": {
                "exported": True,
                "exportedAt": datetime.now(timezone.utc).isoformat(),
                "exportedBy": user["username"],
                "updatedAt": datetime.now(timezone.utc).isoformat()
            }
        }
    )
    
    # Return template data for client-side export
    return {
        "design_id": design_id,
        "template": design["template_data"],
        "data_source": design.get("data_source"),
        "format": format,
        "product_id": design.get("product_id"),
        "order_id": design.get("wc_order_id")
    }

@api_router.post("/admin/designs/{design_id}/mark-exported")
async def mark_design_exported(design_id: str, user: dict = Depends(require_admin)):
    """Mark a design as exported"""
    result = await db.customer_designs.update_one(
        {"id": design_id},
        {
            "$set": {
                "exported": True,
                "exportedAt": datetime.now(timezone.utc).isoformat(),
                "exportedBy": user["username"],
                "status": "exported",
                "updatedAt": datetime.now(timezone.utc).isoformat()
            }
        }
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Design not found")
    
    return {"success": True, "message": "Design marked as exported"}

@api_router.get("/designs/{design_id}/thumbnail")
async def get_design_thumbnail(design_id: str):
    """Get design thumbnail image"""
    design = await db.customer_designs.find_one({"id": design_id}, {"_id": 0, "thumbnail_path": 1})
    if not design or not design.get("thumbnail_path"):
        raise HTTPException(status_code=404, detail="Thumbnail not found")
    
    thumbnail_path = Path(design["thumbnail_path"])
    if not thumbnail_path.exists():
        raise HTTPException(status_code=404, detail="Thumbnail file not found")
    
    return StreamingResponse(
        open(thumbnail_path, "rb"),
        media_type="image/png",
        headers={"Content-Disposition": f"inline; filename={design_id}.png"}
    )

# ============== Template Endpoints ==============

@api_router.get("/")
async def root():
    return {"message": "Template Editor API"}

@api_router.post("/templates", response_model=Template)
async def create_template(input: TemplateCreate, user: dict = Depends(require_admin)):
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
async def delete_template(template_id: str, user: dict = Depends(require_admin)):
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
        
        records = df.fillna('').to_dict('records')
        columns = list(df.columns)
        
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
            "preview": records[:5]
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
    """Generate export data for template"""
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
        "dataRows": data_rows if data_rows else [{}],
        "totalPages": len(data_rows) if data_rows else 1
    }

# ============== History Endpoints ==============

@api_router.post("/history")
async def save_history(templateId: str, action: str, snapshot: Dict[str, Any]):
    entry = HistoryEntry(
        templateId=templateId,
        action=action,
        snapshot=snapshot
    )
    doc = entry.model_dump()
    doc['timestamp'] = doc['timestamp'].isoformat()
    
    await db.history.insert_one(doc)
    
    count = await db.history.count_documents({"templateId": templateId})
    if count > 50:
        oldest = await db.history.find({"templateId": templateId}).sort("timestamp", 1).limit(count - 50).to_list(count - 50)
        ids_to_delete = [h['id'] for h in oldest]
        await db.history.delete_many({"id": {"$in": ids_to_delete}})
    
    return {"id": entry.id}

@api_router.get("/history/{template_id}")
async def get_history(template_id: str, limit: int = Query(default=50, le=100)):
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
    await db.history.delete_many({"templateId": template_id})
    return {"message": "History cleared"}

# ============== Template Download/Import ==============

@api_router.get("/templates/{template_id}/download")
async def download_template(template_id: str):
    template = await db.templates.find_one({"id": template_id}, {"_id": 0})
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    
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
    try:
        content = await file.read()
        template_data = json.loads(content.decode('utf-8'))
        
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

# ============== Handwriting Synthesis ==============

class HandwritingRequest(BaseModel):
    text: str
    style: Optional[int] = 9
    bias: Optional[float] = 0.75
    color: Optional[str] = "black"
    strokeWidth: Optional[int] = 2

@api_router.post("/handwriting/generate")
async def generate_handwriting(request: HandwritingRequest):
    """Generate handwriting SVG from text"""
    try:
        from handwriting_helper import generate_handwriting_svg_simple
        
        result = generate_handwriting_svg_simple(
            text=request.text,
            style=request.style,
            bias=request.bias,
            color=request.color,
            width=request.strokeWidth
        )
        
        return {
            "svg": result['svg'],
            "width": result['width'],
            "height": result['height'],
            "paths": result['paths']
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Handwriting generation error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to generate handwriting: {str(e)}")

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
