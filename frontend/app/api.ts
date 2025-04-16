import { CompanyData } from "./page";

export async function fetchCompanyData(): Promise<CompanyData[]> {
  const res = await fetch("http://localhost:8000/api/company-data");
  if (!res.ok) throw new Error("Failed to fetch company data");
  return await res.json();
}

export async function saveCompanyData(data: CompanyData): Promise<CompanyData> {
  const res = await fetch("http://localhost:8000/api/company-data", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to save company data");
  return await res.json();
}
