from fastapi import APIRouter, HTTPException
from app.services.rag_service import RagService
from pydantic import BaseModel

class QueryRequest(BaseModel):
    query: str

class QueryResponse(BaseModel):
    response: str

router = APIRouter()
rag_service = RagService()

@router.post("/query", response_model=QueryResponse)
async def post_query(query_request: QueryRequest):
    print(f"Received query: {query_request.query}")
    try:
        response = rag_service.invoke_rag_chain_custom_prompt(query_request.query)
        return QueryResponse(response=response)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
