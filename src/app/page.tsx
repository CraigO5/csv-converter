"use client";

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import { useDropzone } from "react-dropzone";
import { Upload } from "lucide-react";

export default function Home() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isNormalizing, setIsNormalizing] = useState(false);

  // Used for drag and drop csv file section

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    multiple: false,
    accept: { "text/csv": [".csv"] },
    onDrop: (acceptedFiles) => {
      if (acceptedFiles && acceptedFiles[0]) {
        setSelectedFile(acceptedFiles[0]);
      }
    },
  });

  // Checks and sends .csv file to backend
  const handleUpload = async () => {
    if (!selectedFile) {
      alert("Please select a file first.");
      return;
    }

    setIsUploading(true);

    // send file to the server to
    // convert the file to Pisayian database format

    const formData = new FormData();
    formData.append("file", selectedFile);

    try {
      const response = await fetch("http://localhost:5001/api/transform", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`HTTP error. Status: ${response.status}`);
      }

      // convert the response to a blob (binary data)
      const blob = await response.blob();

      // automatically download the converted file
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = selectedFile.name;
      document.body.appendChild(a);
      a.click();
      a.remove();

      // cleanup
      window.URL.revokeObjectURL(url);

      alert("File cleaned successfully! Downloading.");

      // reset state so user can re-upload cleaned file
      setSelectedFile(null);
      document.querySelector('input[type="file"]').value = "";
    } catch (error) {
      console.error("Error", error);
      alert("File upload failed, please try again.");
    }

    setIsUploading(false);
  };

  const handleNormalize = async () => {
    if (!selectedFile) {
      alert("Please select a file first.");
      return;
    }

    setIsNormalizing(true);

    const formData = new FormData();
    formData.append("file", selectedFile);

    const res = await fetch("http://localhost:5001/api/normalize", {
      method: "POST",
      body: formData,
      mode: "cors",
      headers: { Accept: "application/zip" },
    });

    if (!res.ok) throw new Error("Request failed");

    // handle ZIP download
    const arrayBuffer = await res.arrayBuffer();
    const blob = new Blob([arrayBuffer], { type: "application/zip" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "normalized_output.zip";
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);

    alert("File normalized successfully! Downloading.");
    // reset state so user can re-upload cleaned file
    setSelectedFile(null);
    document.querySelector('input[type="file"]').value = "";

    setIsNormalizing(false);
  };

  return (
    <div className="flex flex-col min-h-screen font-sans bg-gradient-to-b from-yellow-50 to-red-50">
      {/* Header */}
      <header className="flex justify-center p-4">
        <Link
          href="https://www.pisayian.org/"
          target="_blank"
          rel="noopener noreferrer"
        >
          <Image
            className="justify-items-center"
            src="/pisayian_logo.png"
            alt="Pisayian logo"
            width={300}
            height={300}
            priority
          />
        </Link>
      </header>

      {/* Main */}
      <main className="flex-grow flex flex-col items-center mx-20">
        <div className="flex flex-col items-center gap-4 bg-white border border-neutral-400 rounded-xl py-10 px-10 md-px-10 max-w-150 drop-shadow-xl">
          <h1 className="text-3xl font-bold text-center">
            Pisayian CSV Converter
          </h1>
          <p className="text-center text-neutral-500">
            Click "Clean Data" to standardize and download your reformatted CSV.
            Then, re-upload the downloaded file and click "Normalize Data" to
            split it into structured tables.
          </p>

          {/* Dropzone with Icon */}
          <div
            {...getRootProps()}
            className={`border-2 border-dashed rounded-2xl p-10 w-full flex flex-col items-center justify-center gap-3 cursor-pointer transition-colors ${
              isDragActive
                ? "border-yellow-500 bg-yellow-50"
                : "border-neutral-300"
            }`}
          >
            <input {...getInputProps()} />
            <Upload className="w-12 h-12 text-yellow-500" />
            <p className="text-center">
              {selectedFile
                ? `Uploaded: ${selectedFile.name}`
                : "Drag and drop your CSV file here, or click to select"}
            </p>
          </div>

          <button
            className={`px-4 py-2 border rounded-full bg-yellow-300 border-yellow-500 hover:bg-yellow-400 transition-colors duration-150 active:bg-yellow-500 font-bold text-yellow-800 shadow-[0_4px_0_0_oklch(79.5%_0.184_86.047)] ${
              !selectedFile || isUploading
                ? "opacity-50 cursor-not-allowed"
                : ""
            }`}
            disabled={!selectedFile || isUploading}
            onClick={handleUpload}
          >
            {isUploading ? "Cleaning..." : "Clean Data"}
          </button>
          {/* Normalize Button */}
          {
            <button
              className={`px-4 py-2 border rounded-full bg-green-300 border-green-500 hover:bg-green-400 transition-colors duration-150 active:bg-green-500 font-bold text-green-800 shadow-[0_4px_0_0_oklch(79.2%_0.209_151.711)] ${
                !selectedFile || isUploading
                  ? "opacity-50 cursor-not-allowed"
                  : ""
              }`}
              disabled={!selectedFile || isUploading}
              onClick={handleNormalize}
            >
              {isNormalizing ? "Normalizing..." : "Normalize Data"}
            </button>
          }
        </div>
      </main>

      {/* Footer */}
      <footer className="flex justify-center items-center p-4 border-t border-neutral-300">
        <p className="text-sm text-neutral-600">
          Developed during{" "}
          <Link href="https://kapwacodefest.com" className="text-yellow-700">
            Kapwa Codefest
          </Link>
        </p>
      </footer>
    </div>
  );
}
