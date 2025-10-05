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
import formidable from "formidable";
import Papa from "papaparse";

// Disable Next.js default body parsing so we can handle multipart/form-data
export const config = {
  api: {
    bodyParser: false,
  },
};

export async function POST(req: NextRequest) {
  try {
    const form = new formidable.IncomingForm({
      multiples: false,
      keepExtensions: true,
    });

    // parse the incoming form
    const data: any = await new Promise((resolve, reject) => {
      form.parse(req, (err, fields, files) => {
        if (err) reject(err);
        else resolve({ fields, files });
      });
    });

    const file = data.files?.file;
    if (!file)
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });

    // read file as string
    const csvString = await file.toString("utf8"); // or fs.readFileSync(file.filepath, "utf8") for Node
    const parsedData = Papa.parse(csvString, { header: true });

    // validate and clean data
    const currentYear = new Date().getFullYear();

    const validRows = parsedData.data.filter((row: any) => {
      const hasRequiredFields =
        row.LastName && row.FirstName && row.Campus && row.Batch;
      const validBatch =
        !isNaN(row.Batch) && row.Batch >= 1964 && row.Batch <= currentYear;
      return hasRequiredFields && validBatch;
    });

    // transform rows
    const transformedData = validRows.map((row: any) => ({
      last_name: row.LastName?.trim(),
      first_name: row.FirstName?.trim(),
      campus: row.Campus?.trim(),
      batch_year: row.Batch?.trim(),
    }));

    const outputCsv = Papa.unparse(transformedData);

    return new NextResponse(outputCsv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": 'attachment; filename="pisay_transformed.csv"',
      },
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: "Transformation failed" },
      { status: 500 }
    );
  }
}
