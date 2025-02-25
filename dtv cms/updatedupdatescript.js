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
  .filter(row => row.Component && row.Attribute);

// ----- Function to Update a Component's Attribute Type -----
async function updateComponentAttribute(components, componentName, attributeName) {
  const cleanComponent = componentName?.toString().trim();
  const cleanAttribute = attributeName?.toString().trim();

  if (!cleanComponent || !cleanAttribute) {
    return { updated: false, reason: 'missing_fields' };
  }

  const component = components.find(comp => comp.name === cleanComponent);
  if (!component) {
    return { updated: false, reason: 'missing_component' };
  }

  if (!component.schema?.[cleanAttribute]) {
    return { updated: false, reason: 'missing_attribute' };
  }

  const attribute = component.schema[cleanAttribute];
  
  if (attribute.type === 'textarea') {
    return { updated: false, reason: 'existing_textarea' };
  }
  
  if (attribute.type !== 'text') {
    return { updated: false, reason: 'wrong_type' };
  }

  // Clone component to avoid mutating the original
  const updatedComponent = JSON.parse(JSON.stringify(component));
  updatedComponent.schema[cleanAttribute].type = 'textarea';

  try {
    await axios.put(`${BASE_URL}/components/${component.id}`, updatedComponent, {
      headers: {
        'Authorization': API_TOKEN,
        'Content-Type': 'application/json'
      }
    });
    return { updated: true };
  } catch (error) {
    console.error(`Failed to update ${cleanComponent}: ${error.message}`);
    return { updated: false, reason: 'api_error' };
  }
}

// ----- Process Updates -----
async function processUpdates() {
  console.log(`Processing ${attributeUpdates.length} rows`);
  
  // Fetch components from Storyblok API
  let components;
  try {
    const response = await axios.get(`${BASE_URL}/components`, {
      headers: { 'Authorization': API_TOKEN }
    });
    components = response.data;
    console.log(`Successfully fetched ${components.length} components from API`);
  } catch (error) {
    console.error('Failed to fetch components:', error.message);
    return;
  }

  const results = {
    updated: 0,
    skipped: {
      missing_fields: 0,
      missing_component: 0,
      missing_attribute: 0,
      wrong_type: 0,
      existing_textarea: 0,
      api_error: 0
    }
  };

  for (const [index, row] of attributeUpdates.entries()) {
    console.log(`Processing row ${index + 1}/${attributeUpdates.length}`);
    const result = await updateComponentAttribute(components, row.Component, row.Attribute);
    
    if (result.updated) {
      results.updated++;
    } else {
      const reason = result.reason || 'unknown';
      results.skipped[reason] = (results.skipped[reason] || 0) + 1;
    }
  }

  console.log('\nFinal Report:');
  console.log(`Successful updates: ${results.updated}`);
  Object.entries(results.skipped).forEach(([reason, count]) => {
    console.log(`- ${reason.replace(/_/g, ' ')}: ${count}`);
  });
}

processUpdates();