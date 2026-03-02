import ast
import operator
from collections.abc import Mapping
from typing import Any


class FormulaError(Exception):
    pass


class SafeFormulaEngine:
    OPS = {
        ast.Add: operator.add,
        ast.Sub: operator.sub,
        ast.Mult: operator.mul,
        ast.Div: operator.truediv,
        ast.Pow: operator.pow,
        ast.USub: operator.neg,
    }

    ALLOWED_FUNCTIONS = {
        "min": min,
        "max": max,
        "abs": abs,
        "round": round,
    }

    def evaluate(self, expression: str, context: Mapping[str, Any]) -> float:
        try:
            tree = ast.parse(expression, mode="eval")
            value = self._eval_node(tree.body, context)
            return float(value)
        except Exception as exc:
            raise FormulaError(f"Invalid formula '{expression}': {exc}") from exc

    def evaluate_formulas(
        self,
        formulas: list[dict[str, str]],
        base_context: dict[str, Any],
    ) -> dict[str, float]:
        context = dict(base_context)
        for formula in formulas:
            field = formula["target_field"]
            expression = formula["expression"]
            context[field] = self.evaluate(expression, context)
        return context

    def _eval_node(self, node: ast.AST, context: Mapping[str, Any]):
        if isinstance(node, ast.Constant):
            if isinstance(node.value, (int, float)):
                return node.value
            raise FormulaError("Only numeric constants are allowed")
        if isinstance(node, ast.Name):
            if node.id not in context:
                raise FormulaError(f"Unknown variable: {node.id}")
            return context[node.id]
        if isinstance(node, ast.BinOp):
            op_type = type(node.op)
            if op_type not in self.OPS:
                raise FormulaError(f"Unsupported operation: {op_type}")
            left = self._eval_node(node.left, context)
            right = self._eval_node(node.right, context)
            return self.OPS[op_type](left, right)
        if isinstance(node, ast.UnaryOp):
            op_type = type(node.op)
            if op_type not in self.OPS:
                raise FormulaError(f"Unsupported unary operation: {op_type}")
            return self.OPS[op_type](self._eval_node(node.operand, context))
        if isinstance(node, ast.Call):
            if not isinstance(node.func, ast.Name):
                raise FormulaError("Unsupported function call")
            fn_name = node.func.id
            if fn_name not in self.ALLOWED_FUNCTIONS:
                raise FormulaError(f"Function not allowed: {fn_name}")
            args = [self._eval_node(arg, context) for arg in node.args]
            return self.ALLOWED_FUNCTIONS[fn_name](*args)
        raise FormulaError(f"Unsupported expression node: {type(node).__name__}")
