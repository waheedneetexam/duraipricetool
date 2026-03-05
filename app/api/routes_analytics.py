from fastapi import APIRouter, Depends

from app.core.security import AuthContext, require_auth
from app.services.analytics_service import (
    get_bar_data,
    get_chart_drilldown,
    get_scatter_data,
    get_time_series_data,
    get_waterfall_data,
)

router = APIRouter(prefix="/analytics", tags=["analytics"], dependencies=[Depends(require_auth)])


@router.get("/waterfall")
def waterfall(context: AuthContext = Depends(require_auth)):
    return {"chart_type": "waterfall", "data": get_waterfall_data(tenant_id=context.tenant_id)}


@router.get("/scatter")
def scatter(limit: int = 500, context: AuthContext = Depends(require_auth)):
    return {"chart_type": "scatter", "data": get_scatter_data(limit=limit, tenant_id=context.tenant_id)}


@router.get("/bar")
def bar(context: AuthContext = Depends(require_auth)):
    return {"chart_type": "bar", "data": get_bar_data(tenant_id=context.tenant_id)}


@router.get("/time-series")
def time_series(context: AuthContext = Depends(require_auth)):
    return {"chart_type": "time_series", "data": get_time_series_data(tenant_id=context.tenant_id)}


@router.get("/drilldown")
def drilldown(chart_type: str, key: str, context: AuthContext = Depends(require_auth)):
    return {"chart_type": chart_type, "key": key, "rows": get_chart_drilldown(chart_type, key, tenant_id=context.tenant_id)}
