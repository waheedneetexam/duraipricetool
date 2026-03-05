from fastapi import APIRouter, Depends, HTTPException

from app.core.security import AuthContext, require_auth
from app.models.master_data import (
    Customer,
    ExtensionField,
    Product,
    ProductReference,
    Seller,
)
from app.services.master_data_service import (
    delete_customer,
    delete_extension,
    delete_product,
    delete_reference,
    delete_seller,
    list_customers,
    list_extensions,
    list_products,
    list_references,
    list_sellers,
    save_customer,
    save_extension,
    save_product,
    save_reference,
    save_seller,
    seed_bulk_master_data,
    seed_master_data,
)
from app.services.audit_service import log_action

router = APIRouter(prefix="/master", tags=["master"], dependencies=[Depends(require_auth)])


@router.get("/products")
def products_list(context: AuthContext = Depends(require_auth)):
    return {"success": True, "data": list_products(tenant_id=context.tenant_id)}


def create_product(payload: Product, context: AuthContext = Depends(require_auth)):
    data = save_product(payload, tenant_id=context.tenant_id)
    log_action(
        actor_user_id=context.user_id,
        actor_tenant_id=context.tenant_id,
        target_type="product",
        target_id=payload.product_id,
        action="create_product",
        detail={"product_id": payload.product_id, "name": payload.name}
    )
    return {"success": True, "data": data}


@router.put("/products/{product_id}")
def update_product(product_id: str, payload: Product, context: AuthContext = Depends(require_auth)):
    if product_id != payload.product_id:
        raise HTTPException(status_code=400, detail="ID mismatch")
    data = save_product(payload, tenant_id=context.tenant_id)
    log_action(
        actor_user_id=context.user_id,
        actor_tenant_id=context.tenant_id,
        target_type="product",
        target_id=product_id,
        action="update_product",
        detail={"product_id": product_id, "name": payload.name}
    )
    return {"success": True, "data": data}


@router.delete("/products/{product_id}")
def remove_product(product_id: str, context: AuthContext = Depends(require_auth)):
    data = delete_product(product_id, tenant_id=context.tenant_id)
    log_action(
        actor_user_id=context.user_id,
        actor_tenant_id=context.tenant_id,
        target_type="product",
        target_id=product_id,
        action="delete_product",
        detail={"product_id": product_id}
    )
    return {"success": True, "data": data}


@router.get("/customers")
def customers_list(context: AuthContext = Depends(require_auth)):
    return {"success": True, "data": list_customers(tenant_id=context.tenant_id)}


@router.post("/customers")
def create_customer(payload: Customer, context: AuthContext = Depends(require_auth)):
    data = save_customer(payload, tenant_id=context.tenant_id)
    log_action(
        actor_user_id=context.user_id,
        actor_tenant_id=context.tenant_id,
        target_type="customer",
        target_id=payload.customer_id,
        action="create_customer",
        detail={"customer_id": payload.customer_id, "name": payload.customer_name}
    )
    return {"success": True, "data": data}


@router.put("/customers/{customer_id}")
def update_customer(customer_id: str, payload: Customer, context: AuthContext = Depends(require_auth)):
    if customer_id != payload.customer_id:
        raise HTTPException(status_code=400, detail="ID mismatch")
    data = save_customer(payload, tenant_id=context.tenant_id)
    log_action(
        actor_user_id=context.user_id,
        actor_tenant_id=context.tenant_id,
        target_type="customer",
        target_id=customer_id,
        action="update_customer",
        detail={"customer_id": customer_id, "name": payload.customer_name}
    )
    return {"success": True, "data": data}


@router.delete("/customers/{customer_id}")
def remove_customer(customer_id: str, context: AuthContext = Depends(require_auth)):
    data = delete_customer(customer_id, tenant_id=context.tenant_id)
    log_action(
        actor_user_id=context.user_id,
        actor_tenant_id=context.tenant_id,
        target_type="customer",
        target_id=customer_id,
        action="delete_customer",
        detail={"customer_id": customer_id}
    )
    return {"success": True, "data": data}


@router.get("/sellers")
def sellers_list(context: AuthContext = Depends(require_auth)):
    return {"success": True, "data": list_sellers(tenant_id=context.tenant_id)}


@router.post("/sellers")
def create_seller(payload: Seller, context: AuthContext = Depends(require_auth)):
    return {"success": True, "data": save_seller(payload, tenant_id=context.tenant_id)}


@router.put("/sellers/{seller_id}")
def update_seller(seller_id: str, payload: Seller, context: AuthContext = Depends(require_auth)):
    if seller_id != payload.seller_id:
        raise HTTPException(status_code=400, detail="ID mismatch")
    return {"success": True, "data": save_seller(payload, tenant_id=context.tenant_id)}


@router.delete("/sellers/{seller_id}")
def remove_seller(seller_id: str, context: AuthContext = Depends(require_auth)):
    return {"success": True, "data": delete_seller(seller_id, tenant_id=context.tenant_id)}


@router.get("/products/{product_id}/extensions")
def product_extensions(product_id: str, context: AuthContext = Depends(require_auth)):
    return {
        "success": True,
        "data": list_extensions("product_extensions", "product_id", product_id, tenant_id=context.tenant_id),
    }


@router.post("/products/{product_id}/extensions")
def add_product_extension(product_id: str, payload: ExtensionField, context: AuthContext = Depends(require_auth)):
    return {
        "success": True,
        "data": save_extension("product_extensions", "product_id", payload, product_id, tenant_id=context.tenant_id),
    }


@router.delete("/products/extensions/{extension_id}")
def delete_product_extension(extension_id: str, context: AuthContext = Depends(require_auth)):
    return {"success": True, "data": delete_extension("product_extensions", extension_id, tenant_id=context.tenant_id)}


@router.get("/customers/{customer_id}/extensions")
def customer_extensions(customer_id: str, context: AuthContext = Depends(require_auth)):
    return {
        "success": True,
        "data": list_extensions("customer_extensions", "customer_id", customer_id, tenant_id=context.tenant_id),
    }


@router.post("/customers/{customer_id}/extensions")
def add_customer_extension(customer_id: str, payload: ExtensionField, context: AuthContext = Depends(require_auth)):
    return {
        "success": True,
        "data": save_extension("customer_extensions", "customer_id", payload, customer_id, tenant_id=context.tenant_id),
    }


@router.delete("/customers/extensions/{extension_id}")
def delete_customer_extension(extension_id: str, context: AuthContext = Depends(require_auth)):
    return {"success": True, "data": delete_extension("customer_extensions", extension_id, tenant_id=context.tenant_id)}


@router.get("/sellers/{seller_id}/extensions")
def seller_extensions(seller_id: str, context: AuthContext = Depends(require_auth)):
    return {
        "success": True,
        "data": list_extensions("seller_extensions", "seller_id", seller_id, tenant_id=context.tenant_id),
    }


@router.post("/sellers/{seller_id}/extensions")
def add_seller_extension(seller_id: str, payload: ExtensionField, context: AuthContext = Depends(require_auth)):
    return {
        "success": True,
        "data": save_extension("seller_extensions", "seller_id", payload, seller_id, tenant_id=context.tenant_id),
    }


@router.delete("/sellers/extensions/{extension_id}")
def delete_seller_extension(extension_id: str, context: AuthContext = Depends(require_auth)):
    return {"success": True, "data": delete_extension("seller_extensions", extension_id, tenant_id=context.tenant_id)}


@router.get("/products/{product_id}/references")
def product_refs(product_id: str, context: AuthContext = Depends(require_auth)):
    return {"success": True, "data": list_references(product_id, tenant_id=context.tenant_id)}


@router.post("/products/{product_id}/references")
def add_product_reference(product_id: str, payload: ProductReference, context: AuthContext = Depends(require_auth)):
    if payload.product_id != product_id:
        raise HTTPException(status_code=400, detail="ID mismatch")
    return {"success": True, "data": save_reference(payload, tenant_id=context.tenant_id)}


@router.delete("/products/references/{reference_id}")
def delete_ref(reference_id: str, context: AuthContext = Depends(require_auth)):
    return {"success": True, "data": delete_reference(reference_id, tenant_id=context.tenant_id)}


@router.post("/seed-sample")
def seed_master_seed(context: AuthContext = Depends(require_auth)):
    return {"success": True, "data": seed_master_data(tenant_id=context.tenant_id)}


@router.post("/seed-sample-large")
def seed_master_seed_large(context: AuthContext = Depends(require_auth)):
    return {"success": True, "data": seed_bulk_master_data(100, tenant_id=context.tenant_id)}
