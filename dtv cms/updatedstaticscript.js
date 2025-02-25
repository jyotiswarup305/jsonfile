const axios = require('axios');
const XLSX = require('xlsx');
const fs = require('fs');

// ----- Configuration -----
const API_TOKEN = '8GFqpipyQRRx49qmGbvZkQtt-256793--N9xR2wLrXw2Bcwotbe5';
const SPACE_ID = 1021485;
const BASE_URL = `https://api-us.storyblok.com/v1/spaces/${SPACE_ID}`;

// ----- Read Excel File -----
const workbook = XLSX.readFile('attributes.xlsx');
const sheetName = workbook.SheetNames[0];
const sheet = workbook.Sheets[sheetName];
const attributeUpdates = XLSX.utils.sheet_to_json(sheet)
  .filter(row => row.Component && row.Attribute); // Clean empty rows

// ----- Read Components JSON -----
const componentsData = JSON.parse(fs.readFileSync('Components.json', 'utf-8'));

// ----- Function to Update a Component's Attribute Type -----
async function updateComponentAttribute(componentName, attributeName) {
  const cleanComponent = componentName?.toString().trim();
  const cleanAttribute = attributeName?.toString().trim();

  if (!cleanComponent || !cleanAttribute) {
    console.log('Skipping invalid row - missing required fields');
    return false;
  }

  const component = componentsData.components.find(comp => comp.name === cleanComponent);
  if (!component) {
    console.log(`Component "${cleanComponent}" not found`);
    return false;
  }

  if (!component.schema?.[cleanAttribute]) {
    console.log(`Attribute "${cleanAttribute}" missing in ${cleanComponent}`);
    return false;
  }

  const attribute = component.schema[cleanAttribute];
  
  // Enhanced type checking
  if (attribute.type === 'textarea') {
    console.log(`Skipping "${cleanAttribute}" in ${cleanComponent} - already textarea`);
    return false;
  }
  
  if (attribute.type !== 'text') {
    console.log(`Skipping "${cleanAttribute}" in ${cleanComponent} - type is ${attribute.type}`);
    return false;
  }

  // Proceed with update
  attribute.type = 'textarea';
  
  try {
    await axios.put(`${BASE_URL}/components/${component.id}`, component, {
      headers: {
        'Authorization': API_TOKEN,
        'Content-Type': 'application/json'
      }
    });
    console.log(`Updated ${cleanComponent} -> ${cleanAttribute}`);
    return true;
  } catch (error) {
    console.error(`Failed to update ${cleanComponent}: ${error.message}`);
    return false;
  }
}

// ----- Process Updates -----
async function processUpdates() {
  console.log(`Processing ${attributeUpdates.length} rows`);
  
  const results = {
    updated: 0,
    skipped: {
      missing_fields: 0,
      missing_component: 0,
      missing_attribute: 0,
      wrong_type: 0,
      existing_textarea: 0
    }
  };

  for (const [index, row] of attributeUpdates.entries()) {
    const outcome = await updateComponentAttribute(row.Component, row.Attribute);
    outcome ? results.updated++ : results.skipped[outcome.reason]++;
  }

  console.log('\nFinal Report:');
  console.log(`Successful updates: ${results.updated}`);
  console.log(`Skipped due to:
    - Missing fields: ${results.skipped.missing_fields}
    - Missing component: ${results.skipped.missing_component}
    - Missing attribute: ${results.skipped.missing_attribute}
    - Existing textarea: ${results.skipped.existing_textarea}
    - Other types: ${results.skipped.wrong_type}`);
}

processUpdates();