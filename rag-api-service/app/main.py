from fastapi import FastAPI
from app.api.routes import query

app = FastAPI()

app.include_router(query.router)
