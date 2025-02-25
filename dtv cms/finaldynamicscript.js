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

// ----- Function to Update or Create a Component's Attribute Type -----
async function updateComponentAttribute(components, componentName, attributeName) {
  const cleanComponent = componentName?.toString().trim();
  const cleanAttribute = attributeName?.toString().trim();

  if (!cleanComponent || !cleanAttribute) {
    return { updated: false, created: false, reason: 'missing_fields' };
  }

  const componentIndex = components.findIndex(comp => comp.name === cleanComponent);
  if (componentIndex === -1) {
    return { updated: false, created: false, reason: 'missing_component' };
  }
  const component = components[componentIndex];

  // If the attribute doesn't exist, we'll create it with type 'textarea'
  if (!component.schema?.[cleanAttribute]) {
    const updatedComponent = JSON.parse(JSON.stringify(component));
    updatedComponent.schema = updatedComponent.schema || {};
    updatedComponent.schema[cleanAttribute] = { type: 'textarea' };

    try {
      const response = await axios.put(`${BASE_URL}/components/${component.id}`, updatedComponent, {
        headers: {
          'Authorization': API_TOKEN,
          'Content-Type': 'application/json'
        }
      });
      // Update the local copy after successful creation
      components[componentIndex] = response.data.component || updatedComponent;
      return { updated: false, created: true };
    } catch (error) {
      console.error(`Failed to create attribute '${cleanAttribute}' in component '${cleanComponent}': ${error.message}`);
      return { updated: false, created: false, reason: 'api_error' };
    }
  }

  // Attribute exists: check its type.
  const attribute = component.schema[cleanAttribute];

  if (attribute.type === 'textarea') {
    return { updated: false, created: false, reason: 'existing_textarea' };
  }

  if (attribute.type !== 'text') {
    return { updated: false, created: false, reason: 'wrong_type' };
  }

  // Update attribute from text to textarea.
  const updatedComponent = JSON.parse(JSON.stringify(component));
  updatedComponent.schema[cleanAttribute].type = 'textarea';

  try {
    const response = await axios.put(`${BASE_URL}/components/${component.id}`, updatedComponent, {
      headers: {
        'Authorization': API_TOKEN,
        'Content-Type': 'application/json'
      }
    });
    // Update the local copy after successful update
    components[componentIndex] = response.data.component || updatedComponent;
    return { updated: true, created: false };
  } catch (error) {
    console.error(`Failed to update component '${cleanComponent}': ${error.message}`);
    return { updated: false, created: false, reason: 'api_error' };
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
    components = response.data.components;
    console.log(`Successfully fetched ${components.length} components from API`);
  } catch (error) {
    console.error('Failed to fetch components:', error.message);
    return;
  }

  const results = {
    updated: 0,
    created: 0,
    skipped: {
      missing_fields: 0,
      missing_component: 0,
      wrong_type: 0,
      existing_textarea: 0,
      api_error: 0
    }
  };

  for (const [index, row] of attributeUpdates.entries()) {
    const compName = row.Component;
    const attrName = row.Attribute;
    console.log(`Processing row ${index + 1}/${attributeUpdates.length}: Component '${compName}', Attribute '${attrName}'`);
    
    const result = await updateComponentAttribute(components, compName, attrName);
    
    if (result.updated) {
      console.log(`✓ Updated: Component '${compName}'—attribute '${attrName}' set to textarea.`);
      results.updated++;
    } else if (result.created) {
      console.log(`✓ Created: Attribute '${attrName}' for component '${compName}' with type textarea.`);
      results.created++;
    } else {
      console.log(`✗ Skipped: Component '${compName}'—${result.reason.replace(/_/g, ' ')}.`);
      results.skipped[result.reason] = (results.skipped[result.reason] || 0) + 1;
    }
  }

  console.log('\nFinal Report:');
  console.log(`Successful updates: ${results.updated}`);
  console.log(`Successful creations: ${results.created}`);
  Object.entries(results.skipped).forEach(([reason, count]) => {
    console.log(`- ${reason.replace(/_/g, ' ')}: ${count}`);
  });
}

processUpdates();
