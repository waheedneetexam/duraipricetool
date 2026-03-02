from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class Product(BaseModel):
    product_id: str
    sku: str
    name: str
    description: Optional[str] = None
    family: Optional[str] = None
    category: Optional[str] = None
    price: float = 0.0
    active: bool = True
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class Customer(BaseModel):
    customer_id: str
    account_number: Optional[str]
    name: str
    segment: Optional[str]
    region: Optional[str]
    industry: Optional[str]
    active: bool = True
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class Seller(BaseModel):
    seller_id: str
    name: str
    territory: Optional[str]
    manager: Optional[str]
    active: bool = True
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class ExtensionField(BaseModel):
    extension_id: str
    entity_id: str
    attribute_key: str
    attribute_value: str
    created_at: Optional[datetime] = None


class ProductReference(BaseModel):
    reference_id: str
    product_id: str
    reference_type: str
    reference_value: str
    created_at: Optional[datetime] = None
