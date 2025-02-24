import json
import pandas as pd # type: ignore
import requests # type: ignore

def read_json_from_url(url):
    headers = {
        'Authorization': 'TOKEN',  # Replace with your actual token
        'Content-Type': 'application/json'
    }
    response = requests.get(url, headers=headers, verify=False)
    response.raise_for_status()  # Raise an error for bad status codes
    return response.json()

def extract_dtvassets(data, story_id):
    result = []
    
    def extract_from_dict(d):
        for key, value in d.items():
            if isinstance(value, str) and 'dtvassets' in value:
                result.append({'Key': key, 'Component': d.get('component', ''), 'Value': value, 'StoryID': story_id})
            elif isinstance(value, dict):
                extract_from_dict(value)
            elif isinstance(value, list):
                extract_from_list(value)
    
    def extract_from_list(l):
        for item in l:
            if isinstance(item, dict):
                extract_from_dict(item)
    
    if isinstance(data, dict):
        extract_from_dict(data)
    elif isinstance(data, list):
        extract_from_list(data)
    
    return result

def export_to_excel(data, filename):
    df = pd.DataFrame(data)
    
    # Create a Pandas Excel writer using XlsxWriter as the engine.
    with pd.ExcelWriter(filename, engine='xlsxwriter') as writer:
        # Write the first sheet with Component, Key, Value, and StoryID
        df.to_excel(writer, sheet_name='Sheet1', index=False, columns=['Component', 'Key', 'Value', 'StoryID'])
        
        # Write the second sheet with only Component and Key
        df[['Component', 'Key']].to_excel(writer, sheet_name='Sheet2', index=False)


# Read the JSON file
with open(r'Input.json', 'rb') as file:
    data = json.load(file)

# Extract the ids from the nested structure
ids = [item['id'] for item in data['links'].values()]

i = 0
max_length = len(ids)

all_extracted_data = []
while i < max_length: 
    url = f'https://api-us.storyblok.com/v1/spaces/{spaceid}/stories/{ids[i]}'
    data = read_json_from_url(url)
    print(f"Index {i} ---- story ID: {ids[i]}")
    extracted_data = extract_dtvassets(data, ids[i])
    all_extracted_data.extend(extracted_data)
    i += 1

export_to_excel(all_extracted_data, r'output.xlsx')
