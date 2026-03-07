from datetime import datetime
from app.db.postgres_client import pg_client
from app.models.master_data import (
    Customer,
    ExtensionField,
    Product,
    ProductReference,
    Seller,
)




def _now() -> datetime:
    return datetime.utcnow()


def _assert_tenant_ownership(table: str, id_column: str, id_value: str, tenant_id: str) -> None:
    rows = pg_client.execute(f"SELECT tenant_id FROM {table} WHERE {id_column} = %s LIMIT 1", (id_value,))
    if rows and rows[0].get("tenant_id") not in {tenant_id, None}:
        raise ValueError(f"{table}.{id_column} belongs to another tenant")


def _fetch_all(table: str, columns: list[str], tenant_id: str) -> list[dict]:
    column_str = ", ".join(columns)
    rows = pg_client.execute(f"SELECT {column_str} FROM {table} WHERE tenant_id = %s ORDER BY updated_at DESC", (tenant_id,))
    return [dict(row) for row in rows]


def list_products(tenant_id: str = "default") -> list[dict]:
    columns = ["product_id", "sku", "name", "description", "family", "category", "price", "active", "created_at", "updated_at"]
    return _fetch_all("products", columns, tenant_id)


def list_customers(tenant_id: str = "default") -> list[dict]:
    columns = ["customer_id", "account_number", "name", "segment", "region", "industry", "active", "created_at", "updated_at"]
    return _fetch_all("customers", columns, tenant_id)


def list_sellers(tenant_id: str = "default") -> list[dict]:
    columns = ["seller_id", "name", "territory", "manager", "active", "created_at", "updated_at"]
    return _fetch_all("sellers", columns, tenant_id)


def upsert_product(product: Product, tenant_id: str = "default") -> dict:
    now = _now()
    _assert_tenant_ownership("products", "product_id", product.product_id, tenant_id)
    pg_client.execute(
        """
        INSERT INTO products (
            product_id, tenant_id, sku, name, description, family, category, price, active, updated_at
        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, CURRENT_TIMESTAMP)
        ON CONFLICT (product_id) DO UPDATE SET
            tenant_id = EXCLUDED.tenant_id,
            sku = EXCLUDED.sku,
            name = EXCLUDED.name,
            description = EXCLUDED.description,
            family = EXCLUDED.family,
            category = EXCLUDED.category,
            price = EXCLUDED.price,
            active = EXCLUDED.active,
            updated_at = CURRENT_TIMESTAMP;
        """,
        (
            product.product_id,
            tenant_id,
            product.sku,
            product.name,
            product.description,
            product.family,
            product.category,
            product.price,
            product.active,
        ),
    )
    return product.model_dump()


def delete_product(product_id: str, tenant_id: str = "default") -> dict:
    pg_client.execute("DELETE FROM products WHERE product_id = %s AND tenant_id = %s", (product_id, tenant_id))
    return {"deleted": product_id}


def upsert_customer(customer: Customer, tenant_id: str = "default") -> dict:
    _assert_tenant_ownership("customers", "customer_id", customer.customer_id, tenant_id)
    pg_client.execute(
        """
        INSERT INTO customers (
            customer_id, tenant_id, account_number, name, segment, region, industry, active, updated_at
        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, CURRENT_TIMESTAMP)
        ON CONFLICT (customer_id) DO UPDATE SET
            tenant_id = EXCLUDED.tenant_id,
            account_number = EXCLUDED.account_number,
            name = EXCLUDED.name,
            segment = EXCLUDED.segment,
            region = EXCLUDED.region,
            industry = EXCLUDED.industry,
            active = EXCLUDED.active,
            updated_at = CURRENT_TIMESTAMP;
        """,
        (
            customer.customer_id,
            tenant_id,
            customer.account_number,
            customer.name,
            customer.segment,
            customer.region,
            customer.industry,
            customer.active,
        ),
    )
    return customer.model_dump()


def delete_customer(customer_id: str, tenant_id: str = "default") -> dict:
    pg_client.execute("DELETE FROM customers WHERE customer_id = %s AND tenant_id = %s", (customer_id, tenant_id))
    return {"deleted": customer_id}


def upsert_seller(seller: Seller, tenant_id: str = "default") -> dict:
    _assert_tenant_ownership("sellers", "seller_id", seller.seller_id, tenant_id)
    pg_client.execute(
        """
        INSERT INTO sellers (
            seller_id, tenant_id, name, territory, manager, active, updated_at
        ) VALUES (%s, %s, %s, %s, %s, %s, CURRENT_TIMESTAMP)
        ON CONFLICT (seller_id) DO UPDATE SET
            tenant_id = EXCLUDED.tenant_id,
            name = EXCLUDED.name,
            territory = EXCLUDED.territory,
            manager = EXCLUDED.manager,
            active = EXCLUDED.active,
            updated_at = CURRENT_TIMESTAMP;
        """,
        (
            seller.seller_id,
            tenant_id,
            seller.name,
            seller.territory,
            seller.manager,
            seller.active,
        ),
    )
    return seller.model_dump()


def delete_seller(seller_id: str, tenant_id: str = "default") -> dict:
    pg_client.execute("DELETE FROM sellers WHERE seller_id = %s AND tenant_id = %s", (seller_id, tenant_id))
    return {"deleted": seller_id}


def list_extensions(table: str, fk_column: str, fk_value: str, tenant_id: str = "default") -> list[dict]:
    rows = pg_client.execute(
        f"SELECT extension_id, attribute_key, attribute_value, created_at FROM {table} WHERE {fk_column} = %s AND tenant_id = %s",
        (fk_value, tenant_id),
    )
    return [dict(row) for row in rows]


def save_extension(table: str, fk_column: str, extension: ExtensionField, fk_value: str, tenant_id: str = "default") -> dict:
    pg_client.execute(
        f"""
        INSERT INTO {table} (
            extension_id, tenant_id, {fk_column}, attribute_key, attribute_value, created_at
        ) VALUES (%s, %s, %s, %s, %s, CURRENT_TIMESTAMP)
        ON CONFLICT (extension_id) DO UPDATE SET
            tenant_id = EXCLUDED.tenant_id,
            attribute_key = EXCLUDED.attribute_key,
            attribute_value = EXCLUDED.attribute_value
        """,
        (extension.extension_id, tenant_id, fk_value, extension.attribute_key, extension.attribute_value),
    )
    return extension.model_dump()


def delete_extension(table: str, extension_id: str, tenant_id: str = "default") -> dict:
    pg_client.execute(f"DELETE FROM {table} WHERE extension_id = %s AND tenant_id = %s", (extension_id, tenant_id))
    return {"deleted": extension_id}


def list_references(product_id: str, tenant_id: str = "default") -> list[dict]:
    rows = pg_client.execute(
        """
        SELECT reference_id, reference_type, reference_value, created_at
        FROM product_references
        WHERE product_id = %s AND tenant_id = %s
        """,
        (product_id, tenant_id),
    )
    return [dict(row) for row in rows]


def save_reference(reference: ProductReference, tenant_id: str = "default") -> dict:
    pg_client.execute(
        """
        INSERT INTO product_references (
            reference_id, tenant_id, product_id, reference_type, reference_value, created_at
        ) VALUES (%s, %s, %s, %s, %s, CURRENT_TIMESTAMP)
        ON CONFLICT (reference_id) DO UPDATE SET
            tenant_id = EXCLUDED.tenant_id,
            reference_type = EXCLUDED.reference_type,
            reference_value = EXCLUDED.reference_value
        """,
        (
            reference.reference_id,
            tenant_id,
            reference.product_id,
            reference.reference_type,
            reference.reference_value,
        ),
    )
    return reference.model_dump()


def delete_reference(reference_id: str, tenant_id: str = "default") -> dict:
    pg_client.execute("DELETE FROM product_references WHERE reference_id = %s AND tenant_id = %s", (reference_id, tenant_id))
    return {"deleted": reference_id}


FAMILIES = ["Pricing", "Analytics", "Ops"]
CATEGORIES = ["Software", "Service", "Subscription"]
SEGMENTS = ["Enterprise", "MidMarket", "SMB"]
REGIONS = ["NA", "EMEA", "APAC", "LATAM"]
TERRITORIES = ["West", "East", "Global", "EMEA"]
INDUSTRIES = ["Healthcare", "Finance", "Retail", "Manufacturing", "Technology", "Energy"]
FIRST_NAMES = [
    "Liam",
    "Olivia",
    "Noah",
    "Emma",
    "Amelia",
    "James",
    "Sophia",
    "Benjamin",
    "Ava",
    "Ethan",
    "Mia",
    "Lucas",
]
LAST_NAMES = [
    "Anderson",
    "Patel",
    "Garcia",
    "Kim",
    "Nguyen",
    "Walker",
    "Diaz",
    "Lopez",
    "Taylor",
    "Murphy",
    "Clark",
    "Singh",
]
COMPANY_PREFIXES = [
    "Northstar",
    "Summit",
    "Bluewave",
    "Crescent",
    "Pioneer",
    "Redwood",
    "Apex",
    "Nimbus",
    "Atlas",
    "Sterling",
    "Velocity",
    "Prime",
]
COMPANY_SUFFIXES = [
    "Technologies",
    "Industries",
    "Logistics",
    "Healthcare",
    "Retail Group",
    "Manufacturing",
    "Systems",
    "Holdings",
    "Solutions",
    "Energy",
    "Foods",
    "Labs",
]
REAL_PRODUCT_NAMES = [
    "Enterprise Revenue Cloud",
    "Dynamic Price Optimizer",
    "Margin Intelligence Studio",
    "Quote Workflow Manager",
    "Channel Pricing Hub",
    "Contract Lifecycle Suite",
    "Deal Desk Automation",
    "Rebate Management Platform",
    "Promotions Effectiveness Engine",
    "Demand Forecast Workbench",
    "Sales Performance Insights",
    "Global Price Governance",
]


def reset_master_data(tenant_id: str = "default") -> dict:
    pg_client.execute("DELETE FROM product_references WHERE tenant_id = %s", (tenant_id,))
    pg_client.execute("DELETE FROM product_extensions WHERE tenant_id = %s", (tenant_id,))
    pg_client.execute("DELETE FROM customer_extensions WHERE tenant_id = %s", (tenant_id,))
    pg_client.execute("DELETE FROM seller_extensions WHERE tenant_id = %s", (tenant_id,))
    pg_client.execute("DELETE FROM products WHERE tenant_id = %s", (tenant_id,))
    pg_client.execute("DELETE FROM customers WHERE tenant_id = %s", (tenant_id,))
    pg_client.execute("DELETE FROM sellers WHERE tenant_id = %s", (tenant_id,))
    return {"cleared": True}


def seed_bulk_master_data(count: int = 100, clear_existing: bool = True, tenant_id: str = "default") -> dict:
    if clear_existing:
        reset_master_data(tenant_id=tenant_id)

    for i in range(1, count + 1):
        first = FIRST_NAMES[i % len(FIRST_NAMES)]
        last = LAST_NAMES[i % len(LAST_NAMES)]
        manager_first = FIRST_NAMES[(i + 3) % len(FIRST_NAMES)]
        manager_last = LAST_NAMES[(i + 5) % len(LAST_NAMES)]
        company = f"{COMPANY_PREFIXES[i % len(COMPANY_PREFIXES)]} {COMPANY_SUFFIXES[i % len(COMPANY_SUFFIXES)]}"
        product_name = REAL_PRODUCT_NAMES[i % len(REAL_PRODUCT_NAMES)]

        upsert_product(
            Product(
                product_id=f"P-{i:04d}",
                sku=f"SKU-{i:05d}",
                name=product_name,
                description=f"{product_name} for enterprise pricing and quoting operations",
                family=FAMILIES[i % len(FAMILIES)],
                category=CATEGORIES[i % len(CATEGORIES)],
                price=450.0 + float(i * 7),
            ),
            tenant_id=tenant_id,
        )
        upsert_customer(
            Customer(
                customer_id=f"CUST-{i:05d}",
                account_number=f"AC-{i:05d}",
                name=company,
                segment=SEGMENTS[i % len(SEGMENTS)],
                region=REGIONS[i % len(REGIONS)],
                industry=INDUSTRIES[i % len(INDUSTRIES)],
            ),
            tenant_id=tenant_id,
        )
        upsert_seller(
            Seller(
                seller_id=f"SELL-{i:05d}",
                name=f"{first} {last}",
                territory=TERRITORIES[i % len(TERRITORIES)],
                manager=f"{manager_first} {manager_last}",
            ),
            tenant_id=tenant_id,
        )
    return {"products": count, "customers": count, "sellers": count, "reset_before_seed": clear_existing}


def seed_master_data(clear_existing: bool = True, tenant_id: str = "default") -> dict:
    if clear_existing:
        reset_master_data(tenant_id=tenant_id)

    products = [
        Product(
            product_id="P-RVC",
            sku="RVC-1001",
            name="Enterprise Revenue Cloud",
            description="End-to-end revenue and price management platform",
            family="Pricing",
            category="Software",
            price=1450.0,
        ),
        Product(
            product_id="P-DPO",
            sku="DPO-2001",
            name="Dynamic Price Optimizer",
            description="AI-assisted pricing recommendation and optimization tool",
            family="Analytics",
            category="Software",
            price=1125.0,
        ),
        Product(
            product_id="P-RMP",
            sku="RMP-3001",
            name="Rebate Management Platform",
            description="Centralized rebate and incentives management for sales teams",
            family="Ops",
            category="Subscription",
            price=875.0,
        ),
    ]

    customers = [
        Customer(
            customer_id="CUST-10001",
            account_number="AC-10001",
            name="Northstar Technologies",
            segment="Enterprise",
            region="NA",
            industry="Technology",
        ),
        Customer(
            customer_id="CUST-10002",
            account_number="AC-10002",
            name="Summit Healthcare",
            segment="MidMarket",
            region="EMEA",
            industry="Healthcare",
        ),
        Customer(
            customer_id="CUST-10003",
            account_number="AC-10003",
            name="Bluewave Manufacturing",
            segment="SMB",
            region="APAC",
            industry="Manufacturing",
        ),
    ]

    sellers = [
        Seller(
            seller_id="SELL-10001",
            name="Liam Anderson",
            territory="West",
            manager="Sophia Kim",
        ),
        Seller(
            seller_id="SELL-10002",
            name="Olivia Patel",
            territory="EMEA",
            manager="James Walker",
        ),
        Seller(
            seller_id="SELL-10003",
            name="Noah Garcia",
            territory="East",
            manager="Emma Nguyen",
        ),
    ]

    for product in products:
        upsert_product(product, tenant_id=tenant_id)
    for customer in customers:
        upsert_customer(customer, tenant_id=tenant_id)
    for seller in sellers:
        upsert_seller(seller, tenant_id=tenant_id)

    return {
        "products": len(products),
        "customers": len(customers),
        "sellers": len(sellers),
        "reset_before_seed": clear_existing,
    }


def save_product(product: Product, tenant_id: str = "default") -> dict:
    return upsert_product(product, tenant_id=tenant_id)


def save_customer(customer: Customer, tenant_id: str = "default") -> dict:
    return upsert_customer(customer, tenant_id=tenant_id)


def save_seller(seller: Seller, tenant_id: str = "default") -> dict:
    return upsert_seller(seller, tenant_id=tenant_id)
