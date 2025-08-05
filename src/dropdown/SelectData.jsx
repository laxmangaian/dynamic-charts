import React, { useState, useEffect } from 'react';
import { Copy } from 'lucide-react';
import data from "./Data.json"

const SelectData = () => {

  const [selectedData, setSelectedData] = useState(data[0]);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (copied) {
      const timer = setTimeout(() => {
        setCopied(false);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [copied]);

  // Handler for dropdown selection
  const handleDropdownChange = (event) => {
    const selectedName = event.target.value;
    const item = data.find(d => d.name === selectedName);
    setSelectedData(item);
  };

  // Handler for the copy button
  const handleCopy = () => {
    if (!selectedData) return;

    // Convert the data object to a formatted JSON string
    const jsonString = JSON.stringify(selectedData.data, null, 2);

    // Use a temporary textarea to copy the text to the clipboard
    const textarea = document.createElement('textarea');
    textarea.value = jsonString;
    document.body.appendChild(textarea);
    textarea.select();
    try {
      document.execCommand('copy');
      setCopied(true);
    } catch (err) {
      console.error('Failed to copy text', err);
    }
    document.body.removeChild(textarea);
  };

  return (
    <div className=" flex items-center justify-center min-h-screen p-4 sm:p-6 lg:p-8 font-[Inter]">
      <div className="bg-white p-6 rounded-3xl shadow-2xl w-full max-w-lg space-y-6 transform transition-all duration-300 hover:scale-105">
        <h1 className="text-3xl font-bold text-gray-800 text-center">Data Viewer</h1>
        <p className="text-center text-gray-600">
          Select a data set from the dropdown to view its JSON and copy it.
        </p>

        {/* Dropdown for selecting data */}
        <div className="flex flex-col space-y-2">
          <label htmlFor="data-selector" className="text-gray-700 font-medium">Select Data:</label>
          <select
            id="data-selector"
            className="w-full p-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors duration-200 cursor-pointer text-gray-800"
            onChange={handleDropdownChange}
            value={selectedData?.name}
          >
            {data.map((item, index) => (
              <option key={index} value={item.name}>
                {item.name}
              </option>
            ))}
          </select>
        </div>

        {/* Display area for JSON data */}
        <div className="relative bg-gray-900 text-white p-4 rounded-xl shadow-inner min-h-[200px] overflow-auto border border-gray-700">
          <pre className="text-sm font-mono whitespace-pre-wrap break-words">
            {selectedData ? JSON.stringify(selectedData.data, null, 2) : 'Select an item to view its data.'}
          </pre>
          
          {/* Copy button with icon */}
          <button
            onClick={handleCopy}
            className="absolute top-2 right-2 p-2 bg-blue-600 text-white rounded-full shadow-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all duration-200 group"
            title="Copy to clipboard"
          >
            <Copy className="h-5 w-5 text-white group-hover:scale-110 transition-transform" />
          </button>
          
          {/* "Copied!" message */}
          {copied && (
            <div className="absolute top-2 left-1/2 -translate-x-1/2 p-2 bg-green-500 text-white text-xs rounded-lg shadow-lg animate-fade-in-out">
              Copied!
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SelectData;
