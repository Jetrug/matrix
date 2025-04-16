from fastapi import FastAPI, UploadFile, File, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from pyzerox import zerox
from openai import OpenAI
import sys
import os
import json
import aiofiles
from typing import List, Optional
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from backend.database import CompanyData, get_db

app = FastAPI()
llm = OpenAI()

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # Your frontend's origin
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- CompanyData Pydantic schema ---
class CompanyDataSchema(BaseModel):
    id: str
    file_name: str
    company_name: Optional[str] = None
    company_description: Optional[str] = None
    company_business_model: Optional[str] = None
    company_industry: Optional[str] = None
    management_team: Optional[str] = None
    revenue: Optional[str] = None
    revenue_growth: Optional[str] = None
    gross_profit: Optional[str] = None
    ebitda: Optional[str] = None
    capex: Optional[str] = None

    model_config = {
        "from_attributes": True,
        "populate_by_name": True,
        "alias_generator": lambda s: "".join(
            [s.split("_")[0]] + [w.capitalize() for w in s.split("_")[1:]]
        ),
    }

# Initialize ZeroX
# custom_system_prompt = "For the following PDF file, extract the company name, description, business model, industry, management team, revenue, revenue growth, gross profit, EBITDA, CAPEX. Return the data in JSON format."
custom_system_prompt = "For the following PDF file, extract key company information and most importantly hard numerical/financial figures. Exclude other content from the page, cap each page's word count at 25"
model = "gpt-4o"

@app.get("/")
def read_root():
    return {"message": "Import files to extract and organize data"}

@app.post("/api/extract")
async def extract_data(file: UploadFile = File(...)):
    kwargs = {}

    ## process only some pages or all
    select_pages = None ## None for all, but could be int or list(int) page numbers (1 indexed)

    output_dir = "./output_test" ## directory to save the consolidated markdown file
    
    # Save the uploaded file to a temporary location
    temp_file_path = f"./temp_{file.filename}"
    async with aiofiles.open(temp_file_path, 'wb') as out_file:
        content = await file.read()  # Read all content at once
        await out_file.write(content)  # Write all content at once

    try:
        result = await zerox(file_path=temp_file_path, model=model, output_dir=output_dir,
                            custom_system_prompt=custom_system_prompt,select_pages=select_pages, **kwargs)
        pages = result.pages
        page_contents = []
        for page in pages:
            page_contents.append(page.content)
            
        return page_contents
    finally:
        # Delete the temporary file
        os.remove(temp_file_path)

@app.post("/api/parse")
async def parse_data(strings: list[str], columns: list[str]):
    try:
        print("Parsing strings with OpenAI")
        # Ensure the OpenAI API key is set
        if "OPENAI_API_KEY" not in os.environ:
            raise HTTPException(status_code=500, detail="OpenAI API key not set")

        prompt = (
            "Extract key company information and hard numerical/financial figures from the following text. Try to get the following fields along with a confidence score (%) and a source (array index within Text) for each. Return output in JSON format with key=field and obj having props value,confidence,source. If no value can be explicitly matched, use a 'best guess' based on full context, reflect this in the confidence score and add another field 'guess' = true. If guess can not be made, use empty string for value. For percentage fields, use only the number followed by % (assume or convert YoY) and for monetary fields, use the currency followed by the figure followed by K/M/B if applicable\n\n"
            #   Cap output to 100 words.\n\n"
            f"Fields: {json.dumps(columns)}\n\n"
            f"Text: {json.dumps(strings)}\n"
        )

        response = llm.responses.create(
            model="gpt-4o",
            # instructions="You are a formatting assistant that responds only in strict JSON formatted strings, beginning with '{' and ending with '}'",
            input=prompt,
        )
        return response.output_text

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# --- GET endpoint to fetch all company data ---
@app.get("/api/company-data", response_model=List[CompanyDataSchema])
def get_company_data(db: Session = Depends(get_db)):
    db_objs = db.query(CompanyData).order_by(CompanyData.created_at.desc()).all()
    return [CompanyDataSchema.from_orm(obj) for obj in db_objs]

# --- POST endpoint to add new company data ---
@app.post("/api/company-data", response_model=CompanyDataSchema)
def create_company_data(data: CompanyDataSchema, db: Session = Depends(get_db)):
    db_obj = CompanyData(
        id=data.id,
        file_name=data.file_name,
        company_name=data.company_name,
        company_description=data.company_description,
        company_business_model=data.company_business_model,
        company_industry=data.company_industry,
        management_team=data.management_team,
        revenue=data.revenue,
        revenue_growth=data.revenue_growth,
        gross_profit=data.gross_profit,
        ebitda=data.ebitda,
        capex=data.capex,
    )
    db.add(db_obj)
    db.commit()
    db.refresh(db_obj)
    return CompanyDataSchema.from_orm(db_obj)
