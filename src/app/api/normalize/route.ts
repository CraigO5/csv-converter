/**
 * -----------------------------------------
 * Normalize Route (/api/normalize)
 * -----------------------------------------
 * This Next.js API route accepts a raw alumni CSV file and returns a ZIP
 * containing three normalized CSVs: alumni, campus, and alumni_campus.
 * Adapted from an Express/Multer/Archiver route and modified to work with
 * Next.js 13+ App Router and streaming responses.
 *
 * Features:
 *  - Accepts CSV via form-data { file: <CSV file> }
 *  - Parses CSV into JSON using PapaParse
 *  - Splits data into three normalized tables:
 *      1. alumni.csv         → Unique alumni with IDs, names, batch years
 *      2. campus.csv         → Deduplicated list of campuses
 *      3. alumni_campus.csv  → Junction table linking alumni to campuses
 *  - Converts tables back to CSV and bundles them into a ZIP
 *  - Streams ZIP file as a downloadable response
 *
 * Request:
 *  POST /api/normalize
 *  Body: form-data { file: <CSV file> }
 *
 * Response:
 *  - 200 OK: ZIP file containing normalized CSVs
 *  - 400 Bad Request: No file uploaded
 *  - 500 Internal Server Error: Normalization failed
 *
 * Dependencies:
 *  - papaparse: CSV parsing/unparsing
 *  - archiver: Create ZIP archive
 *  - formidable: File upload parsing for Next.js API
 *
 * Author: Nolan Dela Rosa (modified by Craig)
 * Date: October 5, 2025
 */

import { NextRequest, NextResponse } from "next/server";
import Papa from "papaparse";
import { zipSync, strToU8 } from "fflate";
type CsvRow = Record<string, string | null | undefined>;

interface Alumni {
  alumni_id: number;
  last_name: string;
  first_name: string;
  batch_year: string;
}

interface Campus {
  campus_id: number;
  campus_name: string;
}

interface AlumniCampus {
  alumni_id: number;
  campus_id: number;
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
    const data = parsedData.data;

    // prepare arrays for normalized datasets
    const alumni: Alumni[] = [];
    const campuses: Campus[] = [];
    const alumniCampus: AlumniCampus[] = [];
    const campusSet = new Map();

    const getValue = (row: CsvRow, ...keys: string[]): string => {
      for (const k of keys) {
        const val = row[k];
        if (val !== undefined && val !== null && val !== "") {
          return val.trim();
        }
      }
      return "";
    };

    data.forEach((row, index) => {
      const lastName = getValue(row, "LastName", "last_name");
      const firstName = getValue(row, "FirstName", "first_name");
      const campusName = getValue(row, "Campus", "campus");
      const batchYear = getValue(row, "Batch", "batch_year");

      // assign numeric IDs
      const alumniId = index + 1;
      let campusId;

      if (!campusSet.has(campusName)) {
        campusId = campusSet.size + 1;
        campusSet.set(campusName, campusId);
        campuses.push({
          campus_id: campusId,
          campus_name: campusName,
        });
      } else {
        campusId = campusSet.get(campusName);
      }

      // alumni table
      alumni.push({
        alumni_id: alumniId,
        last_name: lastName,
        first_name: firstName,
        batch_year: batchYear,
      });

      // relationship table
      alumniCampus.push({
        alumni_id: alumniId,
        campus_id: campusId,
      });
    });

    const files = {
      "alumni.csv": Papa.unparse(alumni),
      "campus.csv": Papa.unparse(campuses),
      "alumni_campus.csv": Papa.unparse(alumniCampus),
    };

    // create ZIP archive
    const zip = zipSync(
      Object.fromEntries(
        Object.entries(files).map(([name, content]) => [name, strToU8(content)])
      )
    );

    return new NextResponse(zip.buffer as ArrayBuffer, {
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": "attachment; filename=normalized_output.zip",
      },
    });
  } catch (error) {
    console.error("Error normalizing CSV: ", error);
    return NextResponse.json(
      { error: "Failed to normalize file." },
      { status: 500 }
    );
  }
}
