const axios = require('axios');
const rawComponents = require('./responsecomponentgroups.json');
const oauthToken = '8GFqpipyQRRx49qmGbvZkQtt-256793--N9xR2wLrXw2Bcwotbe5';
const spaceId = '1021485';
const BASE_URL = `https://api-us.storyblok.com/v1/spaces/${spaceId}`;

const groups = rawComponents.map(component => ({
    name: component.name
  }));

async function createGroups() {
  try {
    for (const group of groups) {
      try {
        const response = await axios.post(`${BASE_URL}/component_groups/`, {
          component_group: {
            name: group.name
          }
        }, {
          headers: {
            'Authorization': oauthToken,
            'Content-Type': 'application/json'
          }
        });
        console.log(`Group "${group.name}" created with UUID: ${response.data.component_group.uuid}`);
      } catch (error) {
        console.error(`Error creating group "${group.name}":`, error.response?.data || error.message);
      }
    }
  } catch (error) {
    console.error('Unexpected error:', error);
  }
}

createGroups();