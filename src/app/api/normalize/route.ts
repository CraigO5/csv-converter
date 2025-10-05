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
import formidable from "formidable";
import Papa from "papaparse";
import archiver from "archiver";
import { PassThrough } from "stream";

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

    const data: any = await new Promise((resolve, reject) => {
      form.parse(req, (err, fields, files) => {
        if (err) reject(err);
        else resolve({ fields, files });
      });
    });

    const file = data.files?.file;
    if (!file)
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });

    const csvString = await file.toString("utf8"); // or fs.readFileSync(file.filepath, "utf8")
    const parsedData = Papa.parse(csvString, { header: true });
    const rows = parsedData.data;

    // prepare normalized datasets
    const alumni: any[] = [];
    const campuses: any[] = [];
    const alumniCampus: any[] = [];
    const campusSet = new Map<string, number>();

    const getValue = (row: any, ...keys: string[]) => {
      for (const k of keys) {
        if (row[k] !== undefined && row[k] !== null && row[k] !== "")
          return row[k].trim();
      }
      return "";
    };

    rows.forEach((row: any, index: number) => {
      const lastName = getValue(row, "LastName", "last_name");
      const firstName = getValue(row, "FirstName", "first_name");
      const campusName = getValue(row, "Campus", "campus");
      const batchYear = getValue(row, "Batch", "batch_year");

      const alumniId = index + 1;
      let campusId: number;

      if (!campusSet.has(campusName)) {
        campusId = campusSet.size + 1;
        campusSet.set(campusName, campusId);
        campuses.push({ campus_id: campusId, campus_name: campusName });
      } else {
        campusId = campusSet.get(campusName)!;
      }

      alumni.push({
        alumni_id: alumniId,
        last_name: lastName,
        first_name: firstName,
        batch_year: batchYear,
      });
      alumniCampus.push({ alumni_id: alumniId, campus_id: campusId });
    });

    // Create ZIP archive in memory
    const stream = new PassThrough();
    const archive = archiver("zip");
    archive.pipe(stream);

    archive.append(Papa.unparse(alumni), { name: "alumni.csv" });
    archive.append(Papa.unparse(campuses), { name: "campus.csv" });
    archive.append(Papa.unparse(alumniCampus), { name: "alumni_campus.csv" });

    archive.finalize();

    return new NextResponse(stream, {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": "attachment; filename=normalized_output.zip",
      },
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: "Normalization failed" },
      { status: 500 }
    );
  }
}
