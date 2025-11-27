'use client';

import { useState, useEffect } from 'react';
import { FileText, AlertCircle } from 'lucide-react';

interface CSVViewerProps {
  csvPath?: string;
  csvData?: string;
}

export default function CSVViewer({ csvPath, csvData }: CSVViewerProps) {
  const [data, setData] = useState<string[][]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadCSV = async () => {
      try {
        let csvText = csvData;
        
        if (!csvText && csvPath) {
          // Fetch the CSV file
          const response = await fetch(csvPath);
          const buffer = await response.arrayBuffer();
          
          // Try different encodings
          const decoder = new TextDecoder('utf-16le'); // Try UTF-16 Little Endian first
          csvText = decoder.decode(buffer);
          
          // Check if it looks correct, if not try other encodings
          if (csvText.includes('�') || csvText.charCodeAt(0) === 65279) { // BOM check
            // Try UTF-16 Big Endian
            const decoderBE = new TextDecoder('utf-16be');
            const altText = decoderBE.decode(buffer);
            if (altText.includes('�') < csvText.includes('�')) {
              csvText = altText;
            }
            
            // If still bad, try UTF-8
            if (csvText.includes('�')) {
              const decoderUTF8 = new TextDecoder('utf-8');
              csvText = decoderUTF8.decode(buffer);
            }
          }
          
          // Remove BOM if present
          if (csvText.charCodeAt(0) === 0xFEFF) {
            csvText = csvText.substring(1);
          }
        }

        if (!csvText) {
          throw new Error('No CSV data provided');
        }

        // Parse CSV
        const parsedRows = parseCSV(csvText);
        if (parsedRows.length > 0) {
          setHeaders(parsedRows[0]);
          setData(parsedRows.slice(1));
        }
        setLoading(false);
      } catch (err) {
        console.error('Error loading CSV:', err);
        setError(err instanceof Error ? err.message : 'Failed to load CSV');
        setLoading(false);
      }
    };

    loadCSV();
  }, [csvPath, csvData]);

  // Parse CSV properly handling quotes and multi-line values
  const parseCSV = (text: string): string[][] => {
    const lines: string[] = [];
    const rows: string[][] = [];
    let inQuotes = false;
    let currentLine = '';
    
    // First, handle multi-line values by properly joining lines
    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      const nextChar = text[i + 1];
      
      if (char === '"') {
        inQuotes = !inQuotes;
        currentLine += char;
      } else if (char === '\n' && !inQuotes) {
        if (currentLine.trim()) {
          lines.push(currentLine);
        }
        currentLine = '';
      } else if (char === '\r' && nextChar === '\n' && !inQuotes) {
        if (currentLine.trim()) {
          lines.push(currentLine);
        }
        currentLine = '';
        i++; // Skip the \n
      } else {
        currentLine += char;
      }
    }
    
    if (currentLine.trim()) {
      lines.push(currentLine);
    }
    
    // Now parse each line
    lines.forEach((line: string) => {
      const row: string[] = [];
      let current = '';
      let inQuotes = false;
      
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        
        if (char === '"') {
          if (inQuotes && line[i + 1] === '"') {
            // Handle escaped quotes
            current += '"';
            i++;
          } else {
            inQuotes = !inQuotes;
          }
        } else if (char === ',' && !inQuotes) {
          row.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      
      if (current || row.length > 0) {
        row.push(current.trim());
      }
      
      if (row.length > 0) {
        rows.push(row);
      }
    });
    
    return rows;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center">
        <AlertCircle className="w-5 h-5 text-red-600 mr-2" />
        <span className="text-red-800">Error loading CSV: {error}</span>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-8 text-center">
        <FileText className="w-12 h-12 text-gray-400 mx-auto mb-3" />
        <p className="text-gray-600">No data available</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full bg-white border border-gray-200 rounded-lg overflow-hidden">
        <thead className="bg-gray-50">
          <tr>
            {headers.map((header, index) => (
              <th
                key={index}
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-b"
              >
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200">
          {data.map((row, rowIndex) => (
            <tr key={rowIndex} className="hover:bg-gray-50">
              {row.map((cell, cellIndex) => (
                <td key={cellIndex} className="px-6 py-4 text-sm text-gray-900">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
} 