"""
TRIVENI optional extraction backend (FastAPI).

The prototype works fully without this service: the browser runs a deterministic demo
pipeline. When this service is running AND an OPENAI_API_KEY is set, the frontend sends the
complaint text here and uses the model's structured extraction (summary, category, urgency,
reasoning, routing score). Related-report matching always stays in the deterministic pipeline,
so the model can never invent links between complaints, and it cannot take any action.

Run:  uvicorn server.main:app --port 8000      (from the project root)
"""
from __future__ import annotations

import json
import os
from typing import Literal

import httpx
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, ValidationError

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "").strip()
OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
ALLOWED_ORIGINS = [o.strip() for o in os.getenv("ALLOWED_ORIGINS", "http://localhost:5173,http://localhost:4173").split(",") if o.strip()]

app = FastAPI(title="TRIVENI demo extraction API", version="0.1.0")
app.add_middleware(CORSMiddleware, allow_origins=ALLOWED_ORIGINS, allow_methods=["POST", "GET"], allow_headers=["Content-Type"])

Category = Literal["power", "water", "road", "sanitation", "streetlight", "anganwadi", "other"]
Priority = Literal["P1", "P2", "P3", "P4"]


class AnalyzeIn(BaseModel):
    text: str = Field(min_length=3, max_length=4000)
    location: str = Field(default="", max_length=300)


class AnalyzeOut(BaseModel):
    complaint_summary: str = Field(max_length=300)
    complaint_summary_hi: str = Field(default="", max_length=300)
    language: Literal["hi", "en"]
    issue_category: Category
    urgency: Priority
    reasoning: list[str] = Field(default_factory=list, max_length=6)
    routing_confidence: float = Field(ge=0, le=1)
    human_review_required: bool


SYSTEM = """You structure citizen complaints from Uttar Pradesh for a DEMO prototype.
Return only JSON matching the schema. Rules:
- complaint_summary: one plain English sentence. complaint_summary_hi: the same in Hindi.
- issue_category: one of power, water, road, sanitation, streetlight, anganwadi, other.
- urgency: P1 for any fire, electrical, injury or child-safety hazard; P2 for an essential
  service (power, water) down for 2+ days or affecting many households; P3 otherwise; P4 trivial.
- reasoning: up to 4 short sentences quoting words from the complaint.
- routing_confidence: your honest 0-1 estimate that issue_category is right. Use < 0.75
  when the responsible department is genuinely ambiguous.
- human_review_required: true if confidence < 0.75 or the location is unclear.
Never invent facts that are not in the complaint."""

SCHEMA = {
    "name": "triveni_case",
    "strict": True,
    "schema": {
        "type": "object",
        "additionalProperties": False,
        "required": ["complaint_summary", "complaint_summary_hi", "language", "issue_category", "urgency",
                     "reasoning", "routing_confidence", "human_review_required"],
        "properties": {
            "complaint_summary": {"type": "string"},
            "complaint_summary_hi": {"type": "string"},
            "language": {"type": "string", "enum": ["hi", "en"]},
            "issue_category": {"type": "string", "enum": ["power", "water", "road", "sanitation", "streetlight", "anganwadi", "other"]},
            "urgency": {"type": "string", "enum": ["P1", "P2", "P3", "P4"]},
            "reasoning": {"type": "array", "items": {"type": "string"}},
            "routing_confidence": {"type": "number"},
            "human_review_required": {"type": "boolean"},
        },
    },
}


@app.get("/api/health")
def health():
    return {"ok": True, "llm_configured": bool(OPENAI_API_KEY), "model": OPENAI_MODEL if OPENAI_API_KEY else None}


@app.post("/api/analyze", response_model=AnalyzeOut)
async def analyze(body: AnalyzeIn):
    if not OPENAI_API_KEY:
        # 503 tells the frontend to use its deterministic demo pipeline.
        raise HTTPException(status_code=503, detail="LLM not configured; use the demo pipeline.")
    payload = {
        "model": OPENAI_MODEL,
        "temperature": 0,
        "response_format": {"type": "json_schema", "json_schema": SCHEMA},
        "messages": [
            {"role": "system", "content": SYSTEM},
            {"role": "user", "content": f"Location field: {body.location}\nComplaint: {body.text}"},
        ],
    }
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            r = await client.post("https://api.openai.com/v1/chat/completions",
                                  headers={"Authorization": f"Bearer {OPENAI_API_KEY}"}, json=payload)
        r.raise_for_status()
        content = r.json()["choices"][0]["message"]["content"]
        return AnalyzeOut.model_validate(json.loads(content))
    except (httpx.HTTPError, KeyError, json.JSONDecodeError, ValidationError) as e:
        raise HTTPException(status_code=502, detail=f"Model call failed or returned invalid output: {type(e).__name__}") from e
