from fastapi import APIRouter, Depends

from app.core.security import require_auth
from app.services.analytics_service import (
    get_bar_data,
    get_chart_drilldown,
    get_scatter_data,
    get_time_series_data,
    get_waterfall_data,
)

router = APIRouter(prefix="/analytics", tags=["analytics"], dependencies=[Depends(require_auth)])


@router.get("/waterfall")
def waterfall():
    return {"chart_type": "waterfall", "data": get_waterfall_data()}


@router.get("/scatter")
def scatter(limit: int = 500):
    return {"chart_type": "scatter", "data": get_scatter_data(limit=limit)}


@router.get("/bar")
def bar():
    return {"chart_type": "bar", "data": get_bar_data()}


@router.get("/time-series")
def time_series():
    return {"chart_type": "time_series", "data": get_time_series_data()}


@router.get("/drilldown")
def drilldown(chart_type: str, key: str):
    return {"chart_type": chart_type, "key": key, "rows": get_chart_drilldown(chart_type, key)}
