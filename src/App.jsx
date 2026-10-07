import { useState } from "react"
import "./App.css"

function App() {

  const mappingFields = [
    { label: "Product name", key: "title" },
    { label: "SKU", key: "sku" },
    { label: "Stock", key: "stock" },
    { label: "Price", key: "price" },
    { label: "Vendor", key: "vendor" }
  ]
  const[file, setFile] = useState(null)
  const [headers, setHeaders] = useState([])
  const [mapping, setMapping] = useState({
    title: null,
    sku: null,
    stock: null,
    price: null,
    vendor: null
  })

  const [showConfirm, setShowConfirm] = useState(false)
  const [showErrorConfirm, setShowErrorConfirm] = useState(false)
  const [errorCsv, setErrorCsv] = useState(null)
  const [structureErrors, setStructureErrors] = useState([])

  function readHeaders(file) {
    const reader = new FileReader()

    reader.onload = (event) => {
      const lines = event.target.result.split('\n')
      const firstLine = lines[0]
      const secondLine = lines[1]
      if (!firstLine.trim()) {
        setHeaders([])
        alert("This CSV file is empty.")
        return
      }

      if (!secondLine || !secondLine.trim()) {
        setHeaders([])
        alert("This CSV file contains headers only.")
        return
      }
      const headers = firstLine.split(',').map(header => header.trim())

      setHeaders(headers)
    }

    reader.readAsText(file)
  }

  function isColumnUsed(index, currentField) {
    return Object.entries(mapping).some(([field, value]) => {
      return field !== currentField && value === index
    })
  }

  function downloadErrorCsv() {
    const blob = new Blob([errorCsv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = 'errors.csv'
    link.click()
  }

  function createStructureErrorText(errors) {
    let text = "CSV structure errors\n\n"

    errors.forEach(error => {
      text += `Row ${error.row}: Expected ${error.expected} values, but found ${error.actual}.\n`
    })

    return text
  }

  function downloadStructureErrors() {
    const text = createStructureErrorText(structureErrors)
    const blob = new Blob([text], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)

    const link = document.createElement('a')
    link.href = url
    link.download = "structure_errors.txt"
    link.click()
  }

  function transformFile(force = false) {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('mapping', JSON.stringify(mapping))
    formData.append('force', force)

    fetch("https://csv-transformer-backend.onrender.com/api/test/", { /*"http://127.0.0.1:8000/api/test/"*/
      method: 'POST',
      body: formData,
    })
    .then(response => {
      if (response.headers.get('content-type').includes('application/json')) {
        return response.json()
      }

      return response.blob()
    })
    .then(data => {
      if (data instanceof Blob) {
        const url = URL.createObjectURL(data)
        const link = document.createElement('a')
        link.href = url
        link.download = "transformed.csv"
        link.click()
      } else {
        if (data.structure_errors) {
          setStructureErrors(data.structure_errors)
          return
        }
        setErrorCsv(data.error_csv)
        setStructureErrors([])
        if (data.errors.length > 0) {
          setShowConfirm(true)
        }
      }
    })
  }
  return (
    <div className="app">
      <h1>CSV to Shopify</h1>
      <p>Convert your supplier CSV into a Shopify-ready CSV.</p>
      <p>Select a CSV file to get started.</p>
      <input 
        type="file" 
        accept=".csv"
        onChange={(event) => {
          const selectedFile = event.target.files[0]
          setFile(selectedFile)
          setMapping({
            title: null,
            sku: null,
            stock: null,
            price: null,
            vendor: null
          })
          setStructureErrors([])
          setErrorCsv(null)
          setShowConfirm(false)
          setShowErrorConfirm(false)

          readHeaders(selectedFile)
        }} 
      />
      {file && <p className="file-name">{file.name}</p>}
      {structureErrors.length > 0 && (
        <div>
          <p className="message">
            We found a problem with your CSV file. Please fix the file and try again.
          </p>

          <button className="error-button" onClick={downloadStructureErrors}>
            Download error details
          </button>
        </div>
      )}
        {headers.length > 0 && (
          <div className="mapping">
            <h2>Match your file columns</h2>
            <p>Select the column that contains each type of information.</p>
            
            {mappingFields.map((field) => (
              <div className="mapping-row" key={field.key}>
                <label>{field.label}: </label>

                <select
                  value={mapping[field.key] ?? ""}
                  onChange={(event) => {
                    setMapping({
                      ...mapping,
                      [field.key]: event.target.value === "" ? null : Number(event.target.value)
                    })
                  }}
                >
                  <option value="">Don't use</option>

                   {headers.map((header, index) => (
                      <option
                        key={index}
                        value={index}
                        disabled={isColumnUsed(index, field.key)}
                      >
                        {header}
                      </option>
                    ))}
                </select>
              </div>
            ))}
          </div>
        )}
      
      {file &&Object.values(mapping).some(value => value !== null) &&
      structureErrors.length === 0 && (
        <button className="transform-button" onClick={transformFile}>
          Transform
        </button>
      )}
      
      {showConfirm && (
        <div>
          <p className="message">
            Some values in your file are invalid. Do you want to create the file anyway?
          </p>
          <div className="message-buttons">
            <button onClick={() => transformFile(true)}>Create anyway</button>
            <button onClick={() => {
              setShowConfirm(false)
              setShowErrorConfirm(true)
            }}>Cancel</button>
          </div>
        </div>
      )}

      {showErrorConfirm && (
        <div>
          <p className="message">
            Would you like to download a file with the errors?
          </p>

          <div className="message-buttons">
            <button onClick={() => {
              downloadErrorCsv()
              setShowErrorConfirm(false)
            }}>Download</button>
            <button onClick={() => setShowErrorConfirm(false)}>Cancel</button>
          </div>
        </div>
      )}

      <section id="instructions">
        <h2>Before You Start</h2>

        <p>
          This tool is currently designed for converting CSV files
          containing simple products into a Shopify-ready CSV file.
        </p>

        <p>
          Products with options or multiple variants, such as Color or Size,
          are not supported yet.
        </p>

        <h3>Example</h3>

        <p>Supplier CSV:</p>

        <pre>
          {`Product Name,SKU,Stock,Price,Brand
          Brake Pad,BP001,15,25.50,ToyotaParts`}
        </pre>

        <p>Result:</p>

        <pre>
          {`Handle,Title,Vendor,Option1 Name,Option1 Value,Variant SKU,Variant Inventory Qty,Variant Price
          brake-pad,Brake Pad,ToyotaParts,Title,Default Title,BP001,15,25.50`}
        </pre>
      </section>
    </div>
  )
}

export default App
