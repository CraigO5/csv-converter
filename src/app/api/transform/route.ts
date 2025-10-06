/**
 * -----------------------------------------
 * Transform Route (/api/transform)
 * -----------------------------------------
 * This Next.js API route accepts a single CSV file upload and returns a
 * cleaned and transformed CSV. It was adapted from an Express/Multer route
 * and modified to work in Next.js 13+ App Router style.
 *
 * Features:
 *  - Accepts CSV via form-data { file: <CSV file> }
 *  - Parses CSV into JSON using PapaParse
 *  - Validates required fields (LastName, FirstName, Campus, Batch)
 *  - Filters invalid batch years
 *  - Transforms data: trims whitespace, renames columns (LastName → last_name)
 *  - Returns cleaned CSV as a downloadable file
 *
 * Request:
 *  POST /api/transform
 *  Body: form-data { file: <CSV file> }
 *
 * Response:
 *  - 200 OK: Transformed CSV file (pisay_transformed.csv)
 *  - 400 Bad Request: No file uploaded
 *  - 500 Internal Server Error: Transformation failed
 *
 * Dependencies:
 *  - papaparse: CSV parsing/unparsing
 *  - formidable: File upload parsing for Next.js API
 *
 * Author: Nolan Dela Rosa (modified by Craig)
 * Date: October 5, 2025
 */

import { NextRequest, NextResponse } from "next/server";
import Papa from "papaparse";

interface CsvRow {
  LastName?: string;
  FirstName?: string;
  Campus?: string;
  Batch?: string;
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "File not found." }, { status: 404 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const csvString = Buffer.from(arrayBuffer).toString("utf8");
    const parsedData = Papa.parse<CsvRow>(csvString, { header: true });

    // validate and clean data
    const currentYear = new Date().getFullYear();

    const validRows = parsedData.data.filter((row) => {
      const hasRequiredFields =
        row.LastName && row.FirstName && row.Campus && row.Batch;
      const batchYear = Number(row.Batch);
      const validBatch =
        !isNaN(batchYear) && batchYear >= 1964 && batchYear <= currentYear;
      return hasRequiredFields && validBatch;
    });

    // normalize campus names
    const campusMap = {
      "Pisay Main": "MAIN",
      "Main Campus": "MAIN",
      Diliman: "MAIN",
      CVC: "CAGAYAN VALLEY",
      WVC: "WESTERN VISAYAS",
    };

    // sample transformation logic
    const transformedData = validRows.map((row) => ({
      last_name: row.LastName?.trim(),
      first_name: row.FirstName?.trim(),
      campus: row.Campus?.trim(),
      batch_year: row.Batch?.trim(),
    }));

    // convert back to CSV
    const outputCsv = Papa.unparse(transformedData);

    // send file response
    return new NextResponse(outputCsv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": 'attachment; filename="pisay_transformed.csv"',
      },
    });
  } catch (error) {
    console.error("Error transforming CSV: ", error);
    return NextResponse.json(
      { error: "Failed to transform file." },
      { status: 500 }
    );
  }
}
