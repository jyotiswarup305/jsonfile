const axios = require('axios');
const XLSX = require('xlsx');
const fs = require('fs');

// ----- Configuration -----
const API_TOKEN = '8GFqpipyQRRx49qmGbvZkQtt-256793--N9xR2wLrXw2Bcwotbe5'; // Replace with your actual API token
const SPACE_ID = 1021485;
const BASE_URL = `https://api-us.storyblok.com/v1/spaces/${SPACE_ID}`;

// ----- Read Excel File -----
const workbook = XLSX.readFile('attributes.xlsx');
const sheetName = workbook.SheetNames[0];
const sheet = workbook.Sheets[sheetName];
const attributeUpdates = XLSX.utils.sheet_to_json(sheet);
// Expecting the excel to have columns like "Component" and "Attribute"

// ----- Read Components JSON -----
const componentsData = JSON.parse(fs.readFileSync('Components.json', 'utf-8'));

// ----- Function to Update a Component's Attribute Type -----
async function updateComponentAttribute(componentName, attributeName) {
  // Find the component from Components.json
  const component = componentsData.components.find(comp => comp.name === componentName);
  if (!component) {
    console.log(`Component ${componentName} not found.`);
    return;
  }
  
  // Check if the attribute exists in the component's schema
  if (!component.schema || !component.schema[attributeName]) {
    console.log(`Attribute ${attributeName} not found in component ${componentName}.`);
    return;
  }
  
  // Change the attribute type from "text" to "textarea"
  if (component.schema[attributeName].type === 'text') {
    component.schema[attributeName].type = 'textarea';
  } else {
    console.log(`Attribute ${attributeName} in component ${componentName} is not of type "text".`);
    return;
  }
  
  // Prepare the URL for updating this component
  const url = `${BASE_URL}/components/${component.id}`;
  
  try {
    const response = await axios.put(url, component, {
      headers: {
        'Authorization': API_TOKEN,  // Depending on your API, this might be "Token" instead
        'Content-Type': 'application/json'
      }
    });
    console.log(`Successfully updated ${componentName} -> ${attributeName}:`, response.data);
  } catch (error) {
    console.error(`Error updating component ${componentName}:`, error.response ? error.response.data : error.message);
  }
}

// ----- Process All Updates from Excel -----
async function processUpdates() {
  for (const row of attributeUpdates) {
    // Adjust these keys if your excel columns have different names
    const componentName = row.Component;
    const attributeName = row.Attribute;
    if (componentName && attributeName) {
      await updateComponentAttribute(componentName, attributeName);
    } else {
      console.log('Missing component name or attribute name in row:', row);
    }
  }
}

processUpdates();
