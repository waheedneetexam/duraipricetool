import json
import logging
from openai import OpenAI
from app.core.config import OPENAI_API_KEY

logger = logging.getLogger(__name__)

def evaluate_pricing_template(template_text: str) -> dict:
    if not OPENAI_API_KEY:
        raise ValueError("OPENAI_API_KEY is not configured in .env")
        
    client = OpenAI(api_key=OPENAI_API_KEY)
    
    prompt = f"""
    You are an AI pricing logic generator for a B2B SaaS quoting engine.
    Analyze the following natural language pricing template:
    "{template_text}"
    
    Return a JSON object that extracts exactly which components this template touches.
    The final JSON must follow this exact schema:
    {{
        "quote_header_fields": boolean,
        "line_item_fields": boolean,
        "pricing_rules": boolean,
        "table_dependencies": boolean,
        "calculation_priorities": boolean,
        "confidence": float (from 0.0 to 100.0),
        "summary": "string describing your analysis"
    }}
    """
    
    try:
        response = client.chat.completions.create(
            model='gpt-4o',
            messages=[{"role": "user", "content": prompt}],
            response_format={"type": "json_object"},
            temperature=0.1
        )
        data = json.loads(response.choices[0].message.content)
        return {
            "summary": data.get("summary", "Analysis complete."),
            "confidence": float(data.get("confidence", 95.0)),
            "sectionsDetected": {
                "headerFields": 1 if data.get("quote_header_fields") else 0,
                "lineItemFields": 1 if data.get("line_item_fields") else 0,
                "pricingRules": 1 if data.get("pricing_rules") else 0,
                "tableDependencies": 1 if data.get("table_dependencies") else 0,
                "calculationPriorities": 1 if data.get("calculation_priorities") else 0,
            }
        }
    except Exception as e:
        logger.error(f"Failed to process template via AI: {e}")
        raise ValueError("Failed to process template via AI.")

def generate_field_logic(scope: str, field_key: str, logic_text: str, available_columns: list[str]) -> dict:
    if not OPENAI_API_KEY:
        raise ValueError("OPENAI_API_KEY is not configured in .env")
        
    client = OpenAI(api_key=OPENAI_API_KEY)
    
    prompt = f"""
    You are an AI generating Python AST-compatible mathematical formulas for a pricing engine.
    Target Field: {scope}.{field_key}
    Available Columns/Variables: {available_columns}
    
    Natural Language Logic: "{logic_text}"
    
    Your task is to translate the natural language into a pure math string formula that can be evaluated using standard operators (+, -, *, /), constants, and variables.
    Supported variables are ONLY the ones provided in Available Columns wrapper.
    Do NOT output any markdown, ONLY output a valid JSON object.
    
    Format:
    {{
        "formula": "string (e.g., list_price * (1 - discount_percent))",
        "explanation": "string explaining how the formula maps to the logic",
        "dependencies": ["list of variables used"]
    }}
    """
    
    try:
        response = client.chat.completions.create(
            model='gpt-4o',
            messages=[{"role": "user", "content": prompt}],
            response_format={"type": "json_object"},
            temperature=0.0
        )
        data = json.loads(response.choices[0].message.content)
        return {
            "generated_code": data.get("formula", ""),
            "explanation": data.get("explanation", ""),
            "dependencies": {
                "tables": [],
                "columns": data.get("dependencies", [])
            }
        }
    except Exception as e:
        logger.error(f"Failed to generate logic via AI: {e}")
        raise ValueError("Failed to generate logic via AI.")
