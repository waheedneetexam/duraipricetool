const fs = require('fs');

async function testUpload() {
  const tableId = 'products';
  // Create dummy CSV
  const csvContent = "SKU,Product_Name,Price,Is_Active\nSW-123,Test Software,100,true\n";
  fs.writeFileSync('test.csv', csvContent);

  const formData = new FormData();
  const fileBlob = new Blob([fs.readFileSync('test.csv')], { type: 'text/csv' });
  formData.append('file', fileBlob, 'test.csv');
  
  const mapping = {
    "sku": "SKU",
    "name": "Product_Name",
    "price": "Price",
    "active": "Is_Active"
  };
  
  formData.append('mapping_json', JSON.stringify(mapping));
  formData.append('update_duplicates', 'true');
  
  // Note: auth is disabled/bypassed for dev testing. Let's see if we get a 200 or 401. 
  // We'll pass a dummy token anyway since routes_admin requires auth.
  try {
    const res = await fetch(`http://localhost:8000/api/v1/admin/tables/${tableId}/upload-csv`, {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer test_token'
      },
      body: formData
    });
    
    const data = await res.json();
    console.log(JSON.stringify(data, null, 2));
  } catch(e) {
    console.error(e);
  }
}

testUpload();
