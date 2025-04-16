"use client";
import React, { useState, useCallback, useMemo, useEffect } from "react";
import { useDropzone } from "react-dropzone";
import { fetchCompanyData, saveCompanyData } from "./api";

type SortDirection = "ascending" | "descending";

export interface CompanyData {
  id: string;
  fileName: string;
  companyName: string | null;
  companyNameSource: string | null;
  companyDescription: string | null;
  companyDescriptionSource: string | null;
  companyBusinessModel: string | null;
  companyBusinessModelSource: string | null;
  companyIndustry: string | null;
  companyIndustrySource: string | null;
  managementTeam: string | null;
  managementTeamSource: string | null;
  revenue: string | null;
  revenueSource: string | null;
  revenueGrowth: string | null;
  revenueGrowthSource: string | null;
  grossProfit: string | null;
  grossProfitSource: string | null;
  ebitda: string | null;
  ebitdaSource: string | null;
  capex: string | null;
  capexSource: string | null;
}

interface FileProgress {
  file: File;
  progress: number; // 0-100
  isProcessing: boolean;
  error?: string; // Optional error message
}

interface SortConfig {
  key: keyof CompanyData | null;
  direction: SortDirection;
}

const SortIcon: React.FC<{ direction: SortDirection | null }> = ({
  direction,
}) => {
  if (!direction) return <span className="w-3 h-3 ml-1 inline-block"></span>; // Placeholder for alignment when not sorted
  const iconClass = "w-3 h-3 ml-1 inline";

  if (direction === "ascending") {
    // Chevron Up SVG Icon
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={1.5}
        stroke="currentColor"
        className={iconClass}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="m4.5 15.75 7.5-7.5 7.5 7.5"
        />
      </svg>
    );
  } else {
    // Chevron Down SVG Icon
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={1.5}
        stroke="currentColor"
        className={iconClass}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="m19.5 8.25-7.5 7.5-7.5-7.5"
        />
      </svg>
    );
  }
};

const App: React.FC = () => {
  const [companyDataList, setCompanyDataList] = useState<CompanyData[]>([]);

  // Load all company data from Postgres on mount
  useEffect(() => {
    fetchCompanyData()
      .then((data) => setCompanyDataList(data))
      .catch((err) => {
        console.error("Failed to fetch company data:", err);
      });
  }, []);

  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [sortConfig, setSortConfig] = useState<SortConfig>({
    key: null,
    direction: "ascending",
  });
  const [fileProgress, setFileProgress] = useState<FileProgress[]>([]);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    setSelectedFiles((prevFiles) => [...prevFiles, ...acceptedFiles]);

    // Initialize file progress
    const initialProgress = acceptedFiles.map((file) => ({
      file,
      progress: 0,
      isProcessing: false,
    }));
    setFileProgress((prevProgress) => [...prevProgress, ...initialProgress]);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "application/pdf": [".pdf"], // Accept only PDF files
    },
    multiple: true, // Bulk upload
  });

  const removeSelectedFile = (fileToRemove: File) => {
    setSelectedFiles((prevFiles) =>
      prevFiles.filter((file) => file !== fileToRemove)
    );
    setFileProgress((prevProgress) =>
      prevProgress.filter((fp) => fp.file !== fileToRemove)
    );
  };

  function extractJsonFromMarkdown(markdown: string) {
    // Regular expression to match a code block labeled (backtick-formatted) as json
    const regex = /```json\s*([\s\S]*?)\s*```/i;
    const match = markdown.match(regex);
    if (!match) {
      throw new Error("No JSON code block found in the input.");
    }

    const jsonString = match[1].trim();
    try {
      return JSON.parse(jsonString);
    } catch (error) {
      if (error instanceof Error) {
        throw new Error("Failed to parse JSON: " + error.message);
      } else {
        throw new Error("Failed to parse JSON: Unknown error occurred");
      }
    }
  }

  function getSourceString(pages: number[]) {
    const incrementedPages = pages.map((page) => page + 1);
    return `Page(s) ${incrementedPages.join(", ")}`;
  }

  const handleUploadAndProcess = async () => {
    if (selectedFiles.length === 0) {
      console.warn("Please select PDF files to upload.");
      return;
    }

    setFileProgress((prevProgress) =>
      prevProgress.map((fp) => ({ ...fp, isProcessing: true, progress: 0 }))
    );

    const processedData: CompanyData[] = []; // All processed documents

    for (const file of selectedFiles) {
      const progressEntry = fileProgress.find((fp) => fp.file === file);
      if (!progressEntry) continue;

      try {
        console.log(`Uploading and processing: ${file.name}`);

        // Simulate progress
        await new Promise((resolve) => setTimeout(resolve, 100));
        setFileProgress((prevProgress) =>
          prevProgress.map((fp) =>
            fp.file === file ? { ...fp, progress: 50 } : fp
          )
        );

        const formData = new FormData();
        formData.append("file", file);

        const response = await fetch("http://localhost:8000/api/extract", {
          method: "POST",
          body: formData,
        });

        if (!response.ok) {
          throw new Error(`Failed to process file: ${file.name}`);
        }

        const pageContents: string[] = await response.json();
        console.log(`Contents of ${file.name}:`, pageContents);

        setFileProgress((prev) =>
          prev.map((fp) => (fp.file === file ? { ...fp, progress: 50 } : fp))
        );

        const columns = [
          "companyName",
          "companyDescription",
          "companyBusinessModel",
          "companyIndustry",
          "managementTeam",
          "revenue",
          "revenueGrowth",
          "grossProfit",
          "ebitda",
          "capex",
        ];

        const parseRes = await fetch("http://localhost:8000/api/parse", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ strings: pageContents, columns }),
        });
        if (!parseRes.ok) {
          throw new Error(`Parse failed: ${parseRes.statusText}`);
        }

        console.log("Parse response:", parseRes);

        const parsed = await parseRes.json();
        const jsonParsed = extractJsonFromMarkdown(parsed);
        console.log("Parsed JSON:", jsonParsed);

        const data: CompanyData = {
          id: crypto.randomUUID(),
          fileName: file.name,
          companyName: jsonParsed.companyName?.value ?? null,
          companyNameSource: jsonParsed.companyName?.source?.length
            ? getSourceString(jsonParsed.companyName.source)
            : null,
          companyDescription: jsonParsed.companyDescription?.value ?? null,
          companyDescriptionSource: jsonParsed.companyDescription?.source
            ?.length
            ? getSourceString(jsonParsed.companyDescription.source)
            : null,
          companyBusinessModel: jsonParsed.companyBusinessModel?.value ?? null,
          companyBusinessModelSource: jsonParsed.companyBusinessModel?.source
            ?.length
            ? getSourceString(jsonParsed.companyBusinessModel.source)
            : null,
          companyIndustry: jsonParsed.companyIndustry?.value ?? null,
          companyIndustrySource: jsonParsed.companyIndustry?.source?.length
            ? getSourceString(jsonParsed.companyIndustry.source)
            : null,
          managementTeam: jsonParsed.managementTeam?.value ?? null,
          managementTeamSource: jsonParsed.managementTeam?.source?.length
            ? getSourceString(jsonParsed.managementTeam.source)
            : null,
          revenue: jsonParsed.revenue?.value ?? null,
          revenueSource: jsonParsed.revenue?.source?.length
            ? getSourceString(jsonParsed.revenue.source)
            : null,
          revenueGrowth: jsonParsed.revenueGrowth?.value ?? null,
          revenueGrowthSource: jsonParsed.revenueGrowth?.source?.length
            ? getSourceString(jsonParsed.revenueGrowth.source)
            : null,
          grossProfit: jsonParsed.grossProfit?.value ?? null,
          grossProfitSource: jsonParsed.grossProfit?.source?.length
            ? getSourceString(jsonParsed.grossProfit.source)
            : null,
          ebitda: jsonParsed.ebitda?.value ?? null,
          ebitdaSource: jsonParsed.ebitda?.source?.length
            ? getSourceString(jsonParsed.ebitda.source)
            : null,
          capex: jsonParsed.capex?.value ?? null,
          capexSource: jsonParsed.capex?.source?.length
            ? getSourceString(jsonParsed.capex.source)
            : null,
        };

        // STEP 3: mark complete
        setFileProgress((prev) =>
          prev.map((fp) => (fp.file === file ? { ...fp, progress: 100 } : fp))
        );

        processedData.push(data);
      } catch (error: any) {
        console.error("Error processing file:", error);
        setFileProgress((prevProgress) =>
          prevProgress.map((fp) =>
            fp.file === file
              ? {
                  ...fp,
                  isProcessing: false,
                  error: error.message || "Processing failed",
                }
              : fp
          )
        );
      }
    }

    // Save each processed row to backend and update state
    for (const data of processedData) {
      try {
        await saveCompanyData(data);
      } catch (err) {
        console.error("Failed to save company data:", err);
      }
    }
    // After saving, fetch the latest data from backend
    fetchCompanyData()
      .then((data) => setCompanyDataList(data))
      .catch((err) => {
        console.error("Failed to fetch company data:", err);
      });
    setSelectedFiles([]);
    setFileProgress([]);
    console.log("Finished processing all selected files.");
  };

  const filteredAndSortedData = useMemo(() => {
    let filteredData = [...companyDataList];

    // Apply search
    if (searchTerm) {
      const lowerCaseSearchTerm = searchTerm.toLowerCase();
      filteredData = filteredData.filter((item) =>
        Object.values(item).some((value) =>
          value?.toString().toLowerCase().includes(lowerCaseSearchTerm)
        )
      );
    }

    // Apply sorting
    if (sortConfig.key !== null) {
      filteredData.sort((a, b) => {
        const aValue = a[sortConfig.key!];
        const bValue = b[sortConfig.key!];

        if (aValue == null && bValue == null) return 0;
        if (aValue == null)
          return sortConfig.direction === "ascending" ? -1 : 1;
        if (bValue == null)
          return sortConfig.direction === "ascending" ? 1 : -1;

        const comparison = aValue
          .toString()
          .localeCompare(bValue.toString(), undefined, {
            numeric: true,
            sensitivity: "base",
          });
        return sortConfig.direction === "ascending" ? comparison : -comparison;
      });
    }

    return filteredData;
  }, [companyDataList, searchTerm, sortConfig]);

  const requestSort = (key: keyof CompanyData) => {
    let direction: SortDirection = "ascending";
    if (sortConfig.key === key && sortConfig.direction === "ascending") {
      direction = "descending";
    }
    setSortConfig({ key, direction });
  };

  // --- Column Definitions for Table Header ---
  const columns: {
    key: keyof CompanyData;
    label: string;
    sortable: boolean;
    className?: string;
  }[] = [
    {
      key: "fileName",
      label: "File Name",
      sortable: true,
      className: "whitespace-nowrap",
    },
    {
      key: "companyName",
      label: "Company Name",
      sortable: true,
      className: "whitespace-nowrap",
    },
    { key: "companyDescription", label: "Description", sortable: true },
    {
      key: "companyBusinessModel",
      label: "Business Model",
      sortable: true,
      className: "whitespace-nowrap",
    },
    {
      key: "companyIndustry",
      label: "Industry",
      sortable: true,
      className: "whitespace-nowrap",
    },
    { key: "managementTeam", label: "Management", sortable: true }, // Renamed Label
    {
      key: "revenue",
      label: "Revenue",
      sortable: true,
      className: "whitespace-nowrap",
    },
    {
      key: "revenueGrowth",
      label: "Revenue Growth",
      sortable: true,
      className: "whitespace-nowrap",
    },
    {
      key: "grossProfit",
      label: "Gross Profit",
      sortable: true,
      className: "whitespace-nowrap",
    },
    {
      key: "ebitda",
      label: "EBITDA",
      sortable: true,
      className: "whitespace-nowrap",
    },
    {
      key: "capex",
      label: "Capex",
      sortable: true,
      className: "whitespace-nowrap",
    },
  ];

  // --- Rendering ---
  return (
    <div className="min-h-screen bg-gray-50 p-8 font-sans">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-gray-800">Matrix 2.0</h1>
        <p className="text-gray-600">
          Import files to extract and organize data
        </p>
      </header>

      {/* File Upload Section */}
      <section className="mb-8 p-6 bg-white border border-gray-200 rounded-lg shadow-sm">
        <h2 className="text-xl font-semibold text-gray-700 mb-4">
          Upload PDFs
        </h2>
        {/* Dropzone */}
        <div
          {...getRootProps()}
          className={`flex flex-col items-center justify-center p-10 border-2 border-dashed rounded-lg cursor-pointer transition-colors duration-200 ease-in-out
            ${
              isDragActive
                ? "border-blue-500 bg-blue-50"
                : "border-gray-300 hover:border-gray-400 bg-gray-50"
            }`}
          suppressHydrationWarning={true}
        >
          <input suppressHydrationWarning={true} {...getInputProps()} />
          {/* Upload Cloud SVG Icon */}
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
            className="w-12 h-12 text-gray-400 mb-3"
            suppressHydrationWarning={true}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 16.5V9.75m0 0 3 3m-3-3-3 3M6.75 19.5a4.5 4.5 0 0 1-1.41-8.775 5.25 5.25 0 0 1 10.233-2.33 3 3 0 0 1 3.758 3.848A3.752 3.752 0 0 1 18 19.5H6.75Z"
            />
          </svg>
          {isDragActive ? (
            <p className="text-blue-600 font-medium">Drop the files here ...</p>
          ) : (
            <p className="text-gray-500 text-center">
              Drag & drop some PDF files here, or{" "}
              <span className="text-blue-600 font-medium">
                click to select files
              </span>
            </p>
          )}
          <p className="text-xs text-gray-400 mt-2">Maximum file size: 50MB</p>
        </div>

        {/* Display selected files and progress */}
        {selectedFiles.length > 0 && (
          <div className="mt-6">
            <h3 className="text-lg font-medium text-gray-700 mb-2">
              Selected Files:
            </h3>
            <ul className="space-y-4">
              {selectedFiles.map((file) => {
                const progressData = fileProgress.find(
                  (fp) => fp.file === file
                );
                const progress = progressData ? progressData.progress : 0;
                const isProcessing = progressData
                  ? progressData.isProcessing
                  : false;
                const error = progressData?.error;

                return (
                  <li
                    key={file.name}
                    className="flex items-center justify-between p-2 bg-gray-100 rounded-md text-sm"
                  >
                    <div className="flex items-center space-x-2 overflow-hidden flex-1">
                      {/* File Text SVG Icon */}
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                        strokeWidth={1.5}
                        stroke="currentColor"
                        className="w-4 h-4 text-gray-500 flex-shrink-0"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z"
                        />
                      </svg>
                      <span
                        className="text-gray-900 truncate"
                        title={file.name}
                      >
                        {file.name}
                      </span>
                      <span className="text-gray-500 text-xs flex-shrink-0">
                        ({(file.size / 1024 / 1024).toFixed(2)} MB)
                      </span>
                    </div>
                    {/* Progress Bar */}
                    <div className="w-40 ml-4">
                      {isProcessing ? (
                        <div className="bg-gray-200 rounded-full h-2.5">
                          <div
                            className="bg-blue-600 h-2.5 rounded-full"
                            style={{ width: `${progress}%` }}
                            role="progressbar"
                            aria-valuenow={progress}
                            aria-valuemin={0}
                            aria-valuemax={100}
                          ></div>
                        </div>
                      ) : (
                        <span className="text-gray-500 text-sm">
                          {error ? (
                            <span className="text-red-500">Error</span>
                          ) : (
                            "Ready to upload"
                          )}
                        </span>
                      )}
                    </div>
                    {/* Remove button */}
                    <button
                      onClick={() => removeSelectedFile(file)}
                      className="p-1 text-gray-400 hover:text-red-500 transition-colors rounded-full focus:outline-none focus:ring-2 focus:ring-red-400 focus:ring-offset-1"
                      aria-label={`Remove ${file.name}`}
                    >
                      {/* X Mark SVG Icon */}
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                        strokeWidth={1.5}
                        stroke="currentColor"
                        className="w-4 h-4"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M6 18 18 6M6 6l12 12"
                        />
                      </svg>
                    </button>
                  </li>
                );
              })}
            </ul>
            <button
              onClick={handleUploadAndProcess}
              disabled={
                selectedFiles.length === 0 ||
                fileProgress.some((fp) => fp.isProcessing)
              }
              className="mt-4 px-6 py-2 bg-blue-600 text-white font-semibold rounded-lg shadow-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Upload and Process {selectedFiles.length} File(s)
            </button>
          </div>
        )}
      </section>

      {/* Data Table Section */}
      <section className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
        <div className="flex justify-between items-center p-4 sm:p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-700">
            Extracted Company Data
          </h2>
          {/* Search Bar */}
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              {/* Search SVG Icon */}
              <svg
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={1.5}
                stroke="currentColor"
                className="w-5 h-5 text-gray-400"
                suppressHydrationWarning={true}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z"
                />
              </svg>
            </div>
            <input
              type="text"
              placeholder="Search table..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="block w-full pl-10 pr-3 py-2 border border-gray-300 text-gray-900 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm transition duration-150 ease-in-out"
            />
          </div>
        </div>

        {/* Table Container for Scrolling */}
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                {/* Generate Table Headers Dynamically */}
                {columns.map((col) => (
                  <th
                    key={col.key}
                    scope="col"
                    className={`px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider ${
                      col.className || ""
                    } ${
                      col.sortable ? "cursor-pointer hover:bg-gray-100" : ""
                    }`}
                    onClick={() => col.sortable && requestSort(col.key)}
                  >
                    <span className="inline-flex items-center">
                      {" "}
                      {/* Wrapper for alignment */}
                      {col.label}
                      {/* Add Sort Icon */}
                      {col.sortable && (
                        <SortIcon
                          direction={
                            sortConfig.key === col.key
                              ? sortConfig.direction
                              : null
                          }
                        />
                      )}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {/* Render filtered and sorted table rows */}
              {filteredAndSortedData.length === 0 ? (
                <tr>
                  <td
                    colSpan={columns.length}
                    className="px-6 py-10 text-center text-gray-500 text-sm"
                  >
                    {companyDataList.length > 0
                      ? "No matching records found."
                      : "Upload PDF files to see extracted data here."}
                  </td>
                </tr>
              ) : (
                filteredAndSortedData.map((data) => (
                  <tr
                    key={data.id}
                    // className="hover:bg-gray-50 transition-colors"
                  >
                    {/* Render cells based on column definition order */}
                    <td
                      className="px-4 py-4 whitespace-nowrap text-sm text-gray-600 font-medium truncate"
                      title={data.fileName}
                    >
                      {data.fileName.replace(".pdf", "")}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                      {data.companyName ?? "---"}
                    </td>
                    <td
                      className="
                        px-4 py-4 text-sm text-gray-600 max-w-xs truncate
                        cursor-pointer
                        hover:bg-gray-100
                        transition-colors duration-150
                      "
                      title={
                        data.companyDescriptionSource
                          ? "Source: " + data.companyDescriptionSource
                          : "No source available"
                      }
                    >
                      {data.companyDescription ?? "---"}
                    </td>
                    <td
                      className="
                        px-4 py-4 text-sm text-gray-600 max-w-xs truncate
                        cursor-pointer
                        hover:bg-gray-100
                        transition-colors duration-150
                      "
                      title={
                        data.companyBusinessModelSource
                          ? "Source: " + data.companyBusinessModelSource
                          : "No source available"
                      }
                    >
                      {data.companyBusinessModel ?? "---"}
                    </td>

                    <td
                      className="
                        px-4 py-4 text-sm text-gray-600 max-w-xs truncate
                        cursor-pointer
                        hover:bg-gray-100
                        transition-colors duration-150
                      "
                      title={
                        data.companyIndustrySource
                          ? "Source: " + data.companyIndustrySource
                          : "No source available"
                      }
                    >
                      {data.companyIndustry ?? "---"}
                    </td>

                    <td
                      className="
                        px-4 py-4 text-sm text-gray-600 max-w-xs truncate
                        cursor-pointer
                        hover:bg-gray-100
                        transition-colors duration-150
                      "
                      title={
                        data.managementTeamSource
                          ? "Source: " + data.managementTeamSource
                          : "No source available"
                      }
                    >
                      {data.managementTeam ?? "---"}
                    </td>

                    <td
                      className="
                        px-4 py-4 text-sm text-gray-600 max-w-xs truncate
                        cursor-pointer
                        hover:bg-gray-100
                        transition-colors duration-150
                      "
                      title={
                        data.revenueSource
                          ? "Source: " + data.revenueSource
                          : "No source available"
                      }
                    >
                      {data.revenue ?? "---"}
                    </td>

                    <td
                      className="
                        px-4 py-4 text-sm text-gray-600 max-w-xs truncate
                        cursor-pointer
                        hover:bg-gray-100
                        transition-colors duration-150
                      "
                      title={
                        data.revenueGrowthSource
                          ? "Source: " + data.revenueGrowthSource
                          : "No source available"
                      }
                    >
                      {data.revenueGrowth ?? "---"}
                    </td>

                    <td
                      className="
                        px-4 py-4 text-sm text-gray-600 max-w-xs truncate
                        cursor-pointer
                        hover:bg-gray-100
                        transition-colors duration-150
                      "
                      title={
                        data.grossProfitSource
                          ? "Source: " + data.grossProfitSource
                          : "No source available"
                      }
                    >
                      {data.grossProfit ?? "---"}
                    </td>

                    <td
                      className="
                        px-4 py-4 text-sm text-gray-600 max-w-xs truncate
                        cursor-pointer
                        hover:bg-gray-100
                        transition-colors duration-150
                      "
                      title={
                        data.ebitdaSource
                          ? "Source: " + data.ebitdaSource
                          : "No source available"
                      }
                    >
                      {data.ebitda ?? "---"}
                    </td>

                    <td
                      className="
                        px-4 py-4 text-sm text-gray-600 max-w-xs truncate
                        cursor-pointer
                        hover:bg-gray-100
                        transition-colors duration-150
                      "
                      title={
                        data.capexSource
                          ? "Source: " + data.capexSource
                          : "No source available"
                      }
                    >
                      {data.capex ?? "---"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Footer or additional info */}
      <footer className="mt-12 text-center text-sm text-gray-500">
        Powered by Tej & Prosights
      </footer>
    </div>
  );
};

export default App; // Export the main component
