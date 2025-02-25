const axios = require('axios');
const rawComponents = require('./response.json');

const oauthToken = '8GFqpipyQRRx49qmGbvZkQtt-256793--N9xR2wLrXw2Bcwotbe5';
const spaceId = '1021485';
const BASE_URL = `https://api-us.storyblok.com/v1/spaces/${spaceId}`;

// Transform components to include only required fields
const components = rawComponents.map(component => ({
  name: component.name,
  display_name: component.display_name,
  schema: component.schema,
  is_root: component.is_root,
  is_nestable: component.is_nestable,
  component_group_uuid: component.component_group_uuid
}));

async function getExistingComponents() {
  try {
    const response = await axios.get(`${BASE_URL}/components`, {
      headers: { 'Authorization': oauthToken }
    });
    return response.data.components.reduce((acc, component) => {
      acc[component.name] = {
        id: component.id,
        existingGroupId: component.component_group_uuid
      };
      return acc;
    }, {});
  } catch (error) {
    console.error('Error fetching components:', error.response?.data || error.message);
    return {};
  }
}

async function createOrUpdateComponents() {
  try {
    const existingComponents = await getExistingComponents();
    
    for (const component of components) {
      try {
        if (existingComponents[component.name]) {
          // Component exists - update group if needed
          const existing = existingComponents[component.name];
          if (existing.existingGroupId !== component.component_group_uuid) {
            await axios.put(`${BASE_URL}/components/${existing.id}`, component, {
              headers: { 'Authorization': oauthToken, 'Content-Type': 'application/json' }
            });
            console.log(`Component "${component.name}" moved to group ${component.component_group_uuid}`);
          } else {
            console.log(`Component "${component.name}" already in correct group`);
          }
        } else {
          // Component doesn't exist - create new
          await axios.post(`${BASE_URL}/components`, component, {
            headers: { 'Authorization': oauthToken, 'Content-Type': 'application/json' }
          });
          console.log(`Component "${component.name}" created`);
        }
      } catch (error) {
        console.error(`Error processing "${component.name}":`, error.response?.data || error.message);
      }
    }
  } catch (error) {
    console.error('Unexpected error:', error);
  }
}

createOrUpdateComponents();