from sqlalchemy import create_engine, Column, String, Text, DateTime
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
import os
import datetime

# Get database URL from environment variable
DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    raise ValueError("DATABASE_URL environment variable is not set")

# Create SQLAlchemy engine
engine = create_engine(DATABASE_URL)

# Create session factory
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Create base class for declarative models
Base = declarative_base()

class CompanyData(Base):
    __tablename__ = "company_data"
    
    id = Column(String, primary_key=True)
    file_name = Column(String, nullable=False)
    company_name = Column(String, nullable=True)
    company_description = Column(Text, nullable=True)
    company_business_model = Column(String, nullable=True)
    company_industry = Column(String, nullable=True)
    management_team = Column(Text, nullable=True)
    revenue = Column(String, nullable=True)
    revenue_growth = Column(String, nullable=True)
    gross_profit = Column(String, nullable=True)
    ebitda = Column(String, nullable=True)
    capex = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

# Create all tables
Base.metadata.create_all(bind=engine)

# Dependency to get database session
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
