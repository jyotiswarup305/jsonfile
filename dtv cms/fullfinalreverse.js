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

// ----- Function to Revert Custom Attributes to Text -----
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

  // Create new attribute as text if it doesn't exist
  if (!component.schema?.[cleanAttribute]) {
    const updatedComponent = JSON.parse(JSON.stringify(component));
    updatedComponent.schema = updatedComponent.schema || {};
    updatedComponent.schema[cleanAttribute] = { type: 'text' };

    try {
      const response = await axios.put(`${BASE_URL}/components/${component.id}`, updatedComponent, {
        headers: {
          'Authorization': API_TOKEN,
          'Content-Type': 'application/json'
        }
      });
      components[componentIndex] = response.data.component || updatedComponent;
      return { updated: false, created: true };
    } catch (error) {
      console.error(`Failed to create attribute '${cleanAttribute}' in component '${cleanComponent}': ${error.message}`);
      return { updated: false, created: false, reason: 'api_error' };
    }
  }

  const attribute = component.schema[cleanAttribute];

  // Skip if already text
  if (attribute.type === 'text') {
    return { updated: false, created: false, reason: 'existing_text' };
  }

  // Only modify custom attributes with specific config
  if (attribute.type !== 'custom' || 
      attribute.field_type !== 'Acquia-Connector-trimmed' ||
      !Array.isArray(attribute.options)) {
    return { updated: false, created: false, reason: 'wrong_config' };
  }

  // Revert to text and remove custom fields
  const updatedComponent = JSON.parse(JSON.stringify(component));
  updatedComponent.schema[cleanAttribute] = { type: 'text' };

  try {
    const response = await axios.put(`${BASE_URL}/components/${component.id}`, updatedComponent, {
      headers: {
        'Authorization': API_TOKEN,
        'Content-Type': 'application/json'
      }
    });
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
      existing_text: 0,
      wrong_config: 0,
      api_error: 0
    }
  };

  for (const [index, row] of attributeUpdates.entries()) {
    const compName = row.Component;
    const attrName = row.Attribute;
    console.log(`Processing row ${index + 1}/${attributeUpdates.length}: Component '${compName}', Attribute '${attrName}'`);
    
    const result = await updateComponentAttribute(components, compName, attrName);
    
    if (result.updated) {
      console.log(`✓ Reverted: Component '${compName}'—attribute '${attrName}' to text.`);
      results.updated++;
    } else if (result.created) {
      console.log(`✓ Created: Attribute '${attrName}' for component '${compName}' as text.`);
      results.created++;
    } else {
      console.log(`✗ Skipped: Component '${compName}'—${result.reason.replace(/_/g, ' ')}.`);
      results.skipped[result.reason] = (results.skipped[result.reason] || 0) + 1;
    }
  }

  console.log('\nFinal Report:');
  console.log(`Successful reverts: ${results.updated}`);
  console.log(`New text attributes: ${results.created}`);
  Object.entries(results.skipped).forEach(([reason, count]) => {
    console.log(`- ${reason.replace(/_/g, ' ')}: ${count}`);
  });
}

processUpdates();