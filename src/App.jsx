import { useState, useEffect } from "react"
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
  const [selectedColumns, setSelectedColumns] = useState([])
  const [mappings, setMappings] = useState([
    { shopifyKey: "title", sourceIndex: null, enabled: true }
  ])

  const [shopifyColumns, setShopifyColumns] = useState([])

  const [showConfirm, setShowConfirm] = useState(false)
  const [showErrorConfirm, setShowErrorConfirm] = useState(false)
  const [errorCsv, setErrorCsv] = useState(null)
  const [structureErrors, setStructureErrors] = useState([])
  useEffect(() => {
    fetch("https://csv-transformer-backend.onrender.com/api/shopify-columns/")/*"http://127.0.0.1:8000/api/shopify-columns/"*/
      .then(response => response.json())
      .then(data => {
        setShopifyColumns(data)
      })
      .catch(error => {
        console.error("Failed to load Shopify columns:", error)
      })
  }, [])

  function addMapping() {
    setMappings([
      ...mappings,
      { shopifyKey: "", sourceIndex: null, enabled: true }
    ])
  }

  function updateMapping(index, field, value) {
    setMappings(mappings.map((mapping, i) =>
      i === index
        ? { ...mapping, [field]: value }
        : mapping
    ))
  }

  function removeMapping(index) {
    setMappings(mappings.filter((_, i) => i !== index))
  }

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
    formData.append('mappings', JSON.stringify(mappings))
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
        if (window.gtag) {
          window.gtag('event', 'conversion_success')
          window.gtag('event', 'file_download')
        }
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
          setMappings([
            { shopifyKey: "title", sourceIndex: null, enabled: true }
          ])
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
            <h2>Match your columns</h2>
            <p>Choose a Shopify column and the matching supplier column.</p>

            {mappings.map((mapping, index) => {
              const column = shopifyColumns.find(
                item => item.key === mapping.shopifyKey
              )

              return (
                <div className="mapping-row" key={index}>
                  <select
                    value={mapping.shopifyKey}
                    onChange={event =>
                      updateMapping(index, "shopifyKey", event.target.value)
                    }
                  >
                    <option value="" disabled>Select Shopify column</option>

                    {shopifyColumns.map(column => {
                      const usedByAnotherRow = mappings.some(
                        (item, i) =>
                          i !== index &&
                          item.shopifyKey === column.key
                      )

                      return (
                        <option
                          key={column.key}
                          value={column.key}
                          disabled={usedByAnotherRow}
                        >
                          {column.label}
                        </option>
                      )
                    })}
                  </select>

                  {column?.type === "source" && (
                    <select
                      value={mapping.sourceIndex ?? ""}
                      onChange={event =>
                        updateMapping(
                          index,
                          "sourceIndex",
                          event.target.value === ""
                            ? null
                            : Number(event.target.value)
                        )
                      }
                    >
                      <option value="">Don't use</option>

                      {headers.map((header, headerIndex) => (
                        <option key={headerIndex} value={headerIndex}>
                          {header}
                        </option>
                      ))}
                    </select>
                  )}

                  {(column?.type === "generated" ||
                    column?.type === "default") && (
                    <select
                      value={mapping.enabled ? "true" : "false"}
                      onChange={event =>
                        updateMapping(
                          index,
                          "enabled",
                          event.target.value === "true"
                        )
                      }
                    >
                      <option value="true">Use</option>
                      <option value="false">Don't use</option>
                    </select>
                  )}

                  <button type="button" onClick={() => removeMapping(index)}>
                    Remove
                  </button>
                </div>
              )
            })}

            <button type="button" onClick={addMapping}>
              + Add mapping
            </button>
          </div>
        )}
      
      {file && mappings.some(
        item => item.shopifyKey && item.sourceIndex !== null
      ) &&
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

        <p>
          <strong>Validation and Beta Version</strong>
        </p>

        <p>
          This is an early version of the tool and is still being improved.
          Currently, error detection covers the following fields:
          <strong> Title, Variant SKU, Vendor, Variant Price, and Variant Inventory Qty</strong>.
          Other fields are not fully validated yet.
          Always review your output file before importing it into Shopify.
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

      <section id="contact">
        <h2>Contact &amp; Feedback</h2>

        <p>
          Have a question, found a problem, or have a suggestion?
          Send us a message.
        </p>

        <form
          action="https://formspree.io/f/mgorovbl"
          method="POST"
        >
          <div>
            <label htmlFor="contact-email">Your email (required)</label>
            <input
              id="contact-email"
              type="email"
              name="email"
              placeholder="you@example.com"
              required
            />
          </div>

          <div>
            <label htmlFor="contact-message">Message</label>
            <textarea
              id="contact-message"
              name="message"
              rows="5"
              placeholder="Write your message here..."
              required
            />
          </div>

          <button type="submit">Send Message</button>
        </form>


        <p>
          Prefer Telegram?
          {" "}
          <a
            href="https://t.me/ZEDKI17"
            target="_blank"
            rel="noopener noreferrer"
          >
            Contact me on Telegram
          </a>
        </p>

      </section>
    </div>
  )
}


export default App
